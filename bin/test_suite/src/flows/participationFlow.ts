import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import type { Browser, Page } from "playwright";
import type { TestRunner } from "../lib/runner.js";
import { newContext, waitForHydration, collectPublicPageErrors } from "../lib/browser.js";
import { ParticipationRequestSchema, type ParticipationInput } from "../../../../src/frontend/shared/participation.js";

async function enterFunnel(page: Page, base: string) {
  await page.goto(`${base}/contact`, { waitUntil: "domcontentloaded" });
  await waitForHydration(page);
  await page.evaluate(async () => {
    const element = document.querySelector<
      Element & {
        __vue_app__?: { config: { globalProperties: { $router: { push: (path: string) => Promise<unknown> } } } };
      }
    >("#__nuxt, #nuxt-root");
    if (!element?.__vue_app__) throw new Error("Nuxt application is not ready");
    await element.__vue_app__.config.globalProperties.$router.push("/mitmachen");
  });
  await page.locator('[data-participation-path="build"]').waitFor();
}
async function proof(page: Page) {
  const widget = page.locator("altcha-widget");
  if (await widget.count())
    await widget.evaluate((element) =>
      element.dispatchEvent(new CustomEvent("statechange", { detail: { state: "verified", payload: "test-proof" } })),
    );
}
async function fillContact(page: Page) {
  await page.locator("#participation-first-name").fill("Erika");
  await page.locator("#participation-last-name").fill("Beispiel");
  await page.locator("#participation-email").fill("join@example.test");
  for (const checkbox of await page.locator('input[type="checkbox"]').all()) await checkbox.check();
  await proof(page);
}
async function fits(page: Page) {
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    true,
    "Funnel must fit the viewport",
  );
}

/** Deterministic UI transport fixtures: no real accounts, appointments or email are created by this flow. */
export async function runParticipationFlow(runner: TestRunner, base: string, browser: Browser) {
  await runner.step(
    "Participation: harmonised account/booking, preserved answers, duplicate errors and responsive themes",
    async () => {
      await mkdir("../../.reports/participation", { recursive: true });
      for (const width of [1280, 320])
        for (const dark of [false, true]) {
          const context = await newContext(browser, {
            viewport: { width, height: 1000 },
            timezoneId: "Europe/Berlin",
            reducedMotion: "reduce",
            colorScheme: dark ? "dark" : "light",
          });
          const page = await context.newPage();
          const errors = collectPublicPageErrors(page);
          const area = randomUUID(),
            project = randomUUID();
          const agreements = [
            {
              id: randomUUID(),
              type: "terms_of_service",
              version: "2026.11",
              legalText: "Aktuelle Test-AGB",
              digest: "a".repeat(64),
            },
            {
              id: randomUUID(),
              type: "data_protection",
              version: "2026.12",
              legalText: "Aktueller Test-Datenschutz",
              digest: "b".repeat(64),
            },
          ];
          const options = {
            areas: [{ id: area, key: "technik", label: "Technik" }],
            projects: [{ id: project, title: "Testprojekt", description: "Ein konkreter Beitrag", area }],
            agreements,
            personalOnboardingAvailable: true,
          };
          const submitted: ParticipationInput[] = [];
          let duplicate = false;
          const future = new Date(Date.now() + 2 * 86400000);
          future.setUTCHours(13, 0, 0, 0);
          const slot = future.toISOString();
          await page.route("**/api/participation/options", (route) => route.fulfill({ json: options }));
          await page.route("**/api/participation/slots?*", (route) => route.fulfill({ json: { slots: [slot] } }));
          await page.route("**/api/participation/register", async (route) => {
            const body = ParticipationRequestSchema.parse(route.request().postDataJSON());
            submitted.push(body.registration);
            assert.equal(route.request().headers()["x-slk-participation"], "1");
            if (duplicate) {
              await route.fulfill({ status: 409, json: { code: "duplicate_email" } });
              return;
            }
            await route.fulfill({
              json: {
                success: true,
                accountCreated: true,
                accountConfirmationSent: true,
                booking:
                  body.registration.mode === "personal"
                    ? {
                        uid: "fixture-booking",
                        status: "accepted",
                        start: slot,
                        end: new Date(future.getTime() + 1200000).toISOString(),
                      }
                    : null,
              },
            });
          });
          try {
            await enterFunnel(page, base);
            await page.evaluate(
              (value) => document.documentElement.setAttribute("data-theme", value),
              dark ? "staedteChallengeDark" : "staedteChallenge",
            );
            await fits(page);
            if (width === 1280 && !dark)
              await page.screenshot({ path: "../../.reports/participation/entry-desktop.png", fullPage: true });
            await page.locator('[data-participation-path="local"]').click();
            assert.equal(await page.getByRole("button", { name: "Weiter", exact: true }).isDisabled(), true);
            await page.getByRole("button", { name: /Ranking/ }).click();
            await page.getByRole("button", { name: /Wahlcheck/ }).click();
            await page.getByRole("button", { name: "Weiter", exact: true }).click();
            await page.locator("#participation-municipality").fill("Freiburg im Breisgau");
            await page.getByRole("button", { name: "Weiter", exact: true }).click();
            await page.locator('input[value="account"]').check();
            await fillContact(page);
            await fits(page);
            await page.getByRole("button", { name: "Zurück", exact: true }).click();
            assert.equal(await page.locator("#participation-municipality").inputValue(), "Freiburg im Breisgau");
            await page.getByRole("button", { name: "Weiter", exact: true }).click();
            assert.equal(await page.locator("#participation-email").inputValue(), "join@example.test");
            await proof(page);
            await page.getByRole("button", { name: "Konto erstellen", exact: true }).click();
            await page.getByRole("heading", { name: "Dein Konto ist angelegt.", exact: true }).waitFor();
            assert.equal(submitted.length, 1);
            assert.equal(submitted[0]!.mode, "account");
            assert.equal(submitted[0]!.intent.path, "local");
            assert.equal(submitted[0]!.agreements.length, 2);
            // Fresh navigation discards the completed form's in-memory identity data.
            await enterFunnel(page, base);
            await page.locator('[data-participation-path="build"]').click();
            await page.getByRole("button", { name: /Testprojekt/ }).click();
            await page.getByRole("button", { name: "Weiter", exact: true }).click();
            await fillContact(page);
            if (future.getUTCMonth() !== new Date().getUTCMonth())
              await page.getByRole("button", { name: "Nächster Monat", exact: true }).click();
            const dateLabel = new Intl.DateTimeFormat("de-DE", { dateStyle: "full", timeZone: "UTC" }).format(future);
            await page.getByRole("button", { name: dateLabel, exact: true }).click();
            await page
              .getByRole("button", {
                name: new Intl.DateTimeFormat("de-DE", {
                  timeZone: "Europe/Berlin",
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(future),
                exact: true,
              })
              .click();
            await fits(page);
            if (width === 320 && dark)
              await page.screenshot({ path: "../../.reports/participation/final-mobile-dark.png", fullPage: true });
            await page.getByRole("button", { name: /Termin.*Konto/ }).click();
            await page
              .getByRole("heading", { name: "Dein Termin steht. Dein Konto ist angelegt.", exact: true })
              .waitFor();
            assert.equal(submitted[1]!.mode, "personal");
            assert.equal(submitted[1]!.email, submitted[0]!.email);
            assert.equal(submitted[1]!.intent.path, "build");
            // Existing accounts receive a meaningful error and can edit the form afterwards.
            duplicate = true;
            await enterFunnel(page, base);
            await page.locator('[data-participation-path="build"]').click();
            await page.getByRole("button", { name: "Einstieg gemeinsam finden", exact: true }).click();
            await page.getByRole("button", { name: "Weiter", exact: true }).click();
            await page.locator('input[value="account"]').check();
            await fillContact(page);
            await page.getByRole("button", { name: "Konto erstellen", exact: true }).click();
            await page
              .getByRole("alert")
              .filter({ hasText: /existiert bereits ein Konto/ })
              .waitFor();
            assert.equal(await page.locator("#participation-email").isDisabled(), false);
            await fits(page);
            assert.deepEqual(errors, []);
          } finally {
            await context.close();
          }
        }
    },
  );
}

import type { Browser } from "playwright";
import { assert } from "../lib/assert.js";
import { newContext, waitForHydration, collectPublicPageErrors } from "../lib/browser.js";
import type { TestRunner } from "../lib/runner.js";

export async function runSharedStateFlow(runner: TestRunner, frontendUrl: string, browser: Browser): Promise<void> {
  await runContactFeedbackFlow(runner, frontendUrl, browser);
  await runner.step(
    "Shared state: German, English and Italian SSR/hydration, theme persistence and search controls",
    async () => {
      await Promise.all(
        ["de-DE", "en-GB", "it-IT"].map(async (locale) => {
          const context = await newContext(browser, {
            locale: locale === "it-IT" ? "en-GB" : locale,
            colorScheme: "light",
          });
          try {
            // A saved preference must override the browser's language as well.
            if (locale === "it-IT") await context.addCookies([{ name: "slk_locale", value: locale, url: frontendUrl }]);
            const page = await context.newPage();
            const errors = collectPublicPageErrors(page);
            const response = await page.goto(`${frontendUrl}/tools?language-check=1#language-check`, {
              waitUntil: "domcontentloaded",
            });
            if (!response) throw new Error(`${locale}: navigation returned no response`);
            assert(response.ok(), `${locale}: public SSR returns 200`);
            assert(
              new RegExp(`<html[^>]+lang=["']${locale}["']`).test(await response.text()),
              `${locale}: SSR language matches request`,
            );
            await waitForHydration(page);
            const injected = await page.evaluate(() => {
              type Root = Element & {
                __vue_app__?: {
                  config: {
                    globalProperties: { $nuxt?: { $locale: string; $t: (key: string) => string; $directus?: unknown } };
                  };
                };
              };
              const app = [...document.querySelectorAll<Root>("#nuxt-root, #__nuxt")]
                .map((root) => root.__vue_app__?.config.globalProperties.$nuxt)
                .find(Boolean);
              return { locale: app?.$locale, translated: app?.$t("search.input_placeholder"), sdk: !!app?.$directus };
            });
            assert(injected.locale === locale, `${locale}: browser reuses SSR locale`);
            assert(
              injected.translated && injected.translated !== "search.input_placeholder",
              `${locale}: translations are hydrated`,
            );
            assert(!injected.sdk, `${locale}: public SDK is absent`);
            assert(
              (await page.locator("[data-translation-legal-note]").count()) === (locale === "de-DE" ? 0 : 1),
              `${locale}: only non-German footers contain the legal note`,
            );
            assert(
              (await page.locator("main [data-translation-legal-note]").count()) === 0,
              `${locale}: no prominent content disclaimer`,
            );
            if (locale !== "de-DE")
              assert(
                (await page.locator("footer [data-translation-legal-note]").count()) === 1,
                `${locale}: legal note stays in footer`,
              );

            await page.locator(".settings-trigger:visible").first().click();
            const toggle = page.locator(".theme-toggle:visible").first();
            await toggle.click();
            await page.waitForFunction(() => document.documentElement.dataset.theme === "staedteChallengeDark");
            assert(
              (await page.evaluate(() => localStorage.getItem("slk_theme_preference"))) === "dark",
              `${locale}: theme preference persists`,
            );
            await page.reload({ waitUntil: "domcontentloaded" });
            await waitForHydration(page);
            await page.waitForFunction(() => document.documentElement.dataset.theme === "staedteChallengeDark");
            const input = page.locator("header input:visible").first();
            await input.click();
            await page.locator('[role="dialog"]:visible').waitFor();
            await page.keyboard.press("Escape");
            await page.locator('[role="dialog"]:visible').waitFor({ state: "hidden" });
            const nextLanguage =
              locale === "de-DE"
                ? { locale: "en-GB", label: "EN" }
                : locale === "en-GB"
                  ? { locale: "it-IT", label: "IT" }
                  : { locale: "de-DE", label: "DE" };
            const previousUrl = page.url();
            await page.locator(".settings-trigger:visible").first().click();
            const [reload] = await Promise.all([
              page.waitForNavigation({ waitUntil: "domcontentloaded" }),
              page.locator('header [role="group"]:visible button').filter({ hasText: nextLanguage.label }).click(),
            ]);
            await waitForHydration(page);
            const actualLocale = await page.locator("html").getAttribute("lang");
            const savedLocale = (await context.cookies()).find((cookie) => cookie.name === "slk_locale")?.value;
            const requestLocale = /(?:^|;\s*)slk_locale=([^;]*)/.exec(
              (await reload?.request().headerValue("cookie")) ?? "",
            )?.[1];
            assert(
              actualLocale === nextLanguage.locale,
              `${locale}: selector reloads into ${nextLanguage.locale} (HTML=${actualLocale}, saved=${savedLocale}, request=${requestLocale})`,
            );
            assert(page.url() === previousUrl, `${locale}: switching preserves the route, query and fragment`);
            assert(savedLocale === nextLanguage.locale, `${locale}: selector persists the chosen locale`);
            assert(
              errors.length === 0,
              `${locale}: no public request, runtime or hydration errors: ${errors.join("; ")}`,
            );
          } finally {
            await context.close();
          }
        }),
      );
    },
  );
  await runner.step("Onboarding calendar: lazy native iframe, translated title and closing on mobile", async () => {
    const context = await newContext(browser, { viewport: { width: 390, height: 844 } });
    try {
      const page = await context.newPage();
      await page.route("https://app.cal.com/**", (route) =>
        route.fulfill({ contentType: "text/html", body: "<html><body>Calendar fixture</body></html>" }),
      );
      await page.goto(frontendUrl + "/municipalities", { waitUntil: "domcontentloaded" });
      await waitForHydration(page);
      const frame = page.locator('iframe[src*="app.cal.com/stadt-land-klima/onboarding"]');
      assert((await frame.count()) === 0, "Calendar is not loaded before an explicit click");
      await page.locator("button:visible").filter({ hasText: "Termin buchen" }).first().click();
      await frame.waitFor({ state: "visible" });
      assert(!!(await frame.getAttribute("title")), "Calendar has a translated accessible title");
      assert(
        (await frame.getAttribute("referrerpolicy")) === "no-referrer",
        "Calendar does not receive invitation/preview referrers",
      );
      assert(
        !(await page.locator('script[src*="cal.com"]').count()),
        "No third-party script runs in the parent origin",
      );
      await page.locator("button:visible").filter({ hasText: "✕" }).last().click();
      await frame.waitFor({ state: "detached" });
      assert((await page.evaluate(() => document.body.style.overflow)) !== "hidden", "Closing restores scrolling");
    } finally {
      await context.close();
    }
  });
}

export async function runContactFeedbackFlow(runner: TestRunner, frontendUrl: string, browser: Browser): Promise<void> {
  await runner.step(
    "Contact form: translated department categories and accessible localteam onboarding guidance",
    async () => {
      for (const scenario of [
        { locale: "de-DE", colorScheme: "light" as const, width: 1440 },
        { locale: "de-DE", colorScheme: "dark" as const, width: 390 },
        { locale: "en-GB", colorScheme: "dark" as const, width: 1440 },
        { locale: "it-IT", colorScheme: "light" as const, width: 390 },
      ]) {
        const context = await newContext(browser, {
          locale: scenario.locale,
          colorScheme: scenario.colorScheme,
          viewport: { width: scenario.width, height: 900 },
          reducedMotion: "reduce",
        });
        try {
          await context.addCookies([{ name: "slk_locale", value: scenario.locale, url: frontendUrl }]);
          const page = await context.newPage();
          const errors = collectPublicPageErrors(page);
          let calendarRequests = 0;
          await page.route("https://app.cal.com/**", (route) => {
            calendarRequests++;
            return route.fulfill({ contentType: "text/html", body: "<html><body>Calendar fixture</body></html>" });
          });
          const response = await page.goto(`${frontendUrl}/contact?type=onboarding`, { waitUntil: "domcontentloaded" });
          assert(response?.ok(), "Contact route responds successfully");
          await waitForHydration(page);
          const category = page.locator("#feedback-type");
          const hint = page.locator("#feedback-onboarding-hint");
          await hint.waitFor();
          assert((await category.inputValue()) === "onboarding", "New category supports direct links");
          const options = await category
            .locator("option")
            .evaluateAll((nodes) => nodes.map((node) => (node as HTMLOptionElement).value));
          assert(
            options.includes("press") && options.includes("onboarding") && options.length === 9,
            "Both new categories coexist with the existing six",
          );
          assert(
            await category.evaluate((element) => element.nextElementSibling?.id === "feedback-onboarding-hint"),
            "Warning appears immediately below category selection",
          );
          assert(
            (await hint.locator('a[href="/register_localteam"]').count()) === 1,
            "Warning links to self-registration",
          );
          const text = await hint.innerText();
          assert(!text.includes("feedback.onboarding.") && text.length > 150, "Warning is translated");
          const expected = {
            "de-DE": "technisches Problem",
            "en-GB": "technical problem",
            "it-IT": "problema tecnico",
          };
          assert(
            text.includes(expected[scenario.locale as keyof typeof expected]),
            "Warning limits contact to registration problems in the selected language",
          );
          assert(calendarRequests === 0, "Calendar stays unloaded before choosing personal onboarding");
          const appointment = hint.getByRole("button");
          await appointment.focus();
          await page.keyboard.press("Enter");
          const dialog = page.locator("dialog[open]");
          await dialog.waitFor();
          const calendar = dialog.locator("iframe");
          await calendar.waitFor();
          assert(
            (await calendar.getAttribute("src"))?.includes("app.cal.com/stadt-land-klima/onboarding"),
            "Personal onboarding uses the existing calendar",
          );
          assert(!!(await calendar.getAttribute("title")), "Calendar has an accessible title");
          await page.keyboard.press("Escape");
          await dialog.waitFor({ state: "hidden" });
          assert(
            await appointment.evaluate((element) => element === document.activeElement),
            "Closing returns keyboard focus to the booking action",
          );
          await appointment.click();
          await dialog.waitFor();
          await dialog.getByRole("button").click();
          await dialog.waitFor({ state: "hidden" });
          await category.selectOption("press");
          await hint.waitFor({ state: "hidden" });
          assert((await category.inputValue()) === "press", "Press selection hides localteam-only guidance");
          assert(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
            "Contact form fits narrow and desktop layouts",
          );
          assert(errors.length === 0, `Contact form has no runtime or hydration errors: ${errors.join("; ")}`);
        } finally {
          await context.close();
        }
      }
    },
  );
}

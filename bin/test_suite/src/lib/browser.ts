import { chromium, type Browser, type BrowserContext, type BrowserContextOptions, type Page } from "playwright";
import { assert, assertIncludes, assertNotIncludes } from "./assert.js";

export async function launchBrowser(headless: boolean): Promise<Browser> {
  return chromium.launch({ headless });
}

export async function newContext(browser: Browser, options: BrowserContextOptions = {}): Promise<BrowserContext> {
  return browser.newContext({
    locale: "de-DE",
    viewport: { width: 1440, height: 1000 },
    ignoreHTTPSErrors: true,
    ...options,
  });
}

export async function visibleText(page: Page): Promise<string> {
  return page.locator("body").innerText({ timeout: 20_000 });
}

/** Wait for Nuxt interaction readiness without waiting for tiles or analytics. */
export async function waitForHydration(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      type Root = Element & { __vue_app__?: { config: { globalProperties: { $nuxt?: { isHydrating: boolean } } } } };
      return [...document.querySelectorAll<Root>("#nuxt-root, #__nuxt")].some(
        (root) => root.__vue_app__?.config.globalProperties.$nuxt?.isHydrating === false,
      );
    },
    undefined,
    { timeout: 15_000 },
  );
}

export function collectPublicPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (/hydration.*mismatch|mismatch.*hydration/i.test(message.text())) errors.push("Vue hydration mismatch");
  });
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.pathname.startsWith("/api/public/") && response.status() >= 400)
      errors.push(`HTTP ${response.status()} ${url.pathname}`);
  });
  return errors;
}

export async function loginDirectus(page: Page, backendUrl: string, email: string, password: string): Promise<void> {
  await page.goto(`${backendUrl}/admin/login`, { waitUntil: "networkidle" });
  await page.getByPlaceholder("E-Mail").fill(email);
  await page.getByPlaceholder("Passwort").fill(password);
  await page.getByRole("button", { name: /login/i }).click();
  await page.waitForURL((url) => !url.pathname.endsWith("/login"), { timeout: 20_000 });
  await page.waitForLoadState("networkidle").catch(() => undefined);
}

export async function gotoDirectusContent(
  page: Page,
  backendUrl: string,
  collection: string,
  id?: string | number,
): Promise<string> {
  const path = id === undefined ? `/admin/content/${collection}` : `/admin/content/${collection}/${id}`;
  await page.goto(`${backendUrl}${path}`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(600);
  return visibleText(page);
}

export async function assertDirectusPageContains(page: Page, needles: string[], message: string): Promise<string> {
  const text = await visibleText(page);
  for (const needle of needles) assertIncludes(text, needle, message);
  return text;
}

export async function assertDirectusPageNotContains(page: Page, needles: string[], message: string): Promise<string> {
  const text = await visibleText(page);
  for (const needle of needles) assertNotIncludes(text, needle, message);
  return text;
}

export async function clickButton(page: Page, name: string | RegExp): Promise<void> {
  const button = page.getByRole("button", { name });
  await button.waitFor({ state: "visible", timeout: 15_000 });
  await button.click();
}

export async function assertCheckboxCount(page: Page, min: number, message: string): Promise<void> {
  const count = await page.locator('input[type="checkbox"]').count();
  assert(count >= min, `${message}. Expected at least ${min} checkbox input(s), found ${count}.`);
}

/** Establish the same HttpOnly website session as the login modal, without storing JWTs. */
export async function loginWebsite(context: BrowserContext, origin: string, email: string, password: string) {
  const response = await context.request.post(`${origin}/api/editor/session/login`, {
    headers: { Origin: new URL(origin).origin, "x-slk-editor": "1" },
    data: { email, password },
  });
  assert(response.ok(), `Website login must succeed (HTTP ${response.status()})`);
  const body: unknown = await response.json();
  assert(
    !JSON.stringify(body).includes("access_token") && !JSON.stringify(body).includes("refresh_token"),
    "Website login must not return CMS credentials",
  );
}

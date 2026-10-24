import type { Page } from "playwright";

export async function solveMathChallenge(page: Page) {
  const input = page.locator('input[inputmode="numeric"]').first();
  await input.waitFor();
  await page.waitForFunction(() => {
    const field = document.querySelector('input[inputmode="numeric"]');
    const numbers = field?.closest("div")?.querySelector("label")?.textContent?.match(/\d+/g)?.map(Number) || [];
    return numbers.length >= 2 && numbers[0]! >= 10 && numbers[1]! > 0;
  });
  const answer = await input.evaluate((field) => {
    const numbers = field.closest("div")!.querySelector("label")!.textContent!.match(/\d+/g)!.map(Number);
    return String(numbers[0]! + numbers[1]!);
  });
  await input.fill(answer);
}
export async function solveNativeAltcha(page: Page) {
  await page.locator("altcha-widget").waitFor({ state: "attached" });
  await page.evaluate(async () => {
    await customElements.whenDefined("altcha-widget");
    const widget = document.querySelector("altcha-widget") as HTMLElement & {
      verify(): Promise<void>;
      getState(): string;
    };
    await widget.verify();
  });
  await page.waitForFunction(
    () => (document.querySelector("altcha-widget") as HTMLElement & { getState(): string })?.getState() === "verified",
  );
}

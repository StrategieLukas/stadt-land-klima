import assert from "node:assert/strict";
import type { Page } from "playwright";

export async function assertMunicipalityDetailLayout(page: Page): Promise<void> {
  const hero = page.locator("header").filter({ has: page.locator("h1") });
  assert.equal(await hero.locator("form, button, nav, a.canonical-button").count(), 0);

  const actions = page.getByTestId("municipality-sidebar-actions").filter({ visible: true });
  const cards = actions.locator("a");
  assert.equal(await cards.count(), 3);
  const styles = await cards.evaluateAll((links) =>
    links.map((link) => {
      const style = getComputedStyle(link);
      const heading = link.querySelector("h3");
      if (!heading) throw new Error("Every sidebar action needs the same heading layout");
      return {
        width: link.getBoundingClientRect().width,
        padding: style.padding,
        radius: style.borderRadius,
        shadow: style.boxShadow,
        display: style.display,
        gap: style.gap,
        font: getComputedStyle(heading).font,
      };
    }),
  );
  assert.deepEqual(styles[2], styles[0], "History must match the statistics card's geometry and typography");
  assert.deepEqual(styles[2], styles[1], "History must match the elections card's geometry and typography");

  const summary = page.getByTestId("municipality-assessment-summary").filter({ visible: true });
  assert.equal(await summary.count(), 1, "Only the current responsive assessment summary is visible");
  const contrast = await summary.evaluate((card) => {
    const heading = card.querySelector("h3");
    if (!heading) throw new Error("The rating card must identify the assessment");
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Contrast verification requires a canvas context");
    const ancestors: Element[] = [];
    for (let element: Element | null = card; element; element = element.parentElement) ancestors.unshift(element);
    const colors = ["white", ...ancestors.map((element) => getComputedStyle(element).backgroundColor)];
    for (const color of colors) {
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
    }
    const luminances: number[] = [];
    for (const color of ["transparent", getComputedStyle(heading).color]) {
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      const linear = Array.from(context.getImageData(0, 0, 1, 1).data.slice(0, 3)).map((channel) => {
        const value = channel / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      });
      luminances.push(linear[0]! * 0.2126 + linear[1]! * 0.7152 + linear[2]! * 0.0722);
    }
    const [background, foreground] = luminances as [number, number];
    return (Math.max(background, foreground) + 0.05) / (Math.min(background, foreground) + 0.05);
  });
  assert(contrast >= 4.5, "Rating card headings must remain readable in both themes");
  const form = summary.locator('form[action^="/api/pdf/municipality/"]');
  assert.equal(await form.count(), 1, "PDF belongs inside the restored rating card");
  assert.equal(await form.getAttribute("method"), "post");
  assert.equal(await form.getAttribute("target"), "_blank");
  assert.equal(await form.locator("xpath=ancestor::a").count(), 0, "The PDF action cannot be inside a link");
  const button = form.getByRole("button", { name: "PDF", exact: true });
  assert.equal(await button.count(), 1);
  assert.equal(await button.getAttribute("type"), "submit");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
}

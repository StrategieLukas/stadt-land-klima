import assert from "node:assert/strict";
import type { Locator, Page } from "playwright";

const accents = {
  green: "#1da64a",
  "dark-green": "#339737",
  "bright-green": "#AFCA0B",
  blue: "#16bae7",
  dark: "#006e94",
  gray: "#505050",
  orange: "#f39200",
  red: "#e30613",
  yellow: "#ffc80c",
};

/** Check the real component CSS, including global theme overrides and interaction states. */
export async function assertCanonicalButtonStyles(page: Page): Promise<void> {
  const dark = await page.evaluate(() => document.documentElement.dataset.theme === "staedteChallengeDark");
  const transitionOverride = await page.addStyleTag({ content: ".canonical-button { transition: none !important; }" });
  const sampleId = "canonical-button-style-samples";
  try {
    // Clone a rendered component so its scoped selectors and actual icon/label markup remain active.
    await page
      .locator(".canonical-button:visible")
      .first()
      .evaluate(
        (source, { accents, sampleId }) => {
          const samples = document.createElement("section");
          samples.id = sampleId;
          samples.style.cssText = "display:flex;flex-wrap:wrap;gap:12px;padding:16px";
          for (const [name, color] of Object.entries(accents)) {
            const sample = source.cloneNode(true) as HTMLElement;
            sample.removeAttribute("id");
            sample.setAttribute("data-accent", name);
            sample.className =
              source.className.replace(/\btext-(?:white|black|gray)\b/g, "") +
              ` canonical-button--auto-text ${name === "yellow" ? "text-gray" : "text-white"}`;
            sample.style.setProperty("--btn-color", color);
            samples.append(sample);
          }
          for (const textColor of ["white", "black"]) {
            const sample = source.cloneNode(true) as HTMLElement;
            sample.removeAttribute("id");
            sample.dataset.accent = `override-${textColor}`;
            sample.className =
              source.className.replace(/\btext-(?:white|black|gray)\b|\bcanonical-button--auto-text\b/g, "") +
              ` text-${textColor}`;
            sample.style.setProperty("--btn-color", accents["bright-green"]);
            samples.append(sample);
          }
          for (const label of [
            "Maßnahmenkatalog herunterladen (v1.0)",
            "Download the measures catalogue (v1.0)",
            "Scarica il catalogo delle misure (v1.0)",
          ]) {
            const container = document.createElement("div");
            container.style.cssText = "width:240px;max-width:100%";
            const sample = source.cloneNode(true) as HTMLElement;
            sample.removeAttribute("id");
            sample.dataset.accent = "long-label";
            sample.lastElementChild!.textContent = label;
            container.append(sample);
            samples.append(container);
          }
          const disabled = document.createElement("button");
          for (const attr of source.attributes) disabled.setAttribute(attr.name, attr.value);
          disabled.removeAttribute("id");
          disabled.removeAttribute("href");
          disabled.innerHTML = source.innerHTML;
          disabled.disabled = true;
          disabled.dataset.accent = "disabled";
          samples.append(disabled);
          document.body.append(samples);
        },
        { accents, sampleId },
      );

    async function check(button: Locator, accent: string, textColor?: string) {
      await page.mouse.move(0, 0);
      await button.evaluate((element) => (element as HTMLElement).blur());
      const expected = await button.evaluate(
        (element, { accent, dark }) => {
          const probe = document.createElement("span");
          const fill = dark ? `color-mix(in srgb, ${accent} 55%, var(--slk-surface, #17212b))` : accent;
          const edge = dark ? `color-mix(in srgb, ${fill} 80%, ${accent})` : "rgb(255 255 255 / 20%)";
          probe.style.backgroundColor = fill;
          probe.style.boxShadow = `inset 0 0 0 1px ${edge}, 0 1px 2px rgb(0 0 0 / ${dark ? "30%" : "5%"})`;
          probe.style.outlineColor = dark ? `color-mix(in srgb, ${fill} 60%, white)` : accent;
          element.parentElement!.append(probe);
          const result = {
            fill: getComputedStyle(probe).backgroundColor,
            shadow: getComputedStyle(probe).boxShadow,
            focus: getComputedStyle(probe).outlineColor,
          };
          probe.remove();
          return result;
        },
        { accent, dark },
      );
      const styles = () =>
        button.evaluate((element) => {
          const style = getComputedStyle(element);
          return {
            fill: style.backgroundColor,
            shadow: style.boxShadow,
            outline: style.outlineColor,
            text: getComputedStyle(element.lastElementChild!).color,
            focusVisible: element.matches(":focus-visible"),
          };
        });
      const rest = await styles();
      assert.equal(rest.fill, expected.fill, `${accent}: rendered fill`);
      assert.equal(rest.shadow, expected.shadow, `${accent}: one tonal inset edge and shared shadow`);
      assert.equal(rest.outline, "rgba(0, 0, 0, 0)", `${accent}: no resting outline`);
      if (textColor) assert.equal(rest.text, textColor, `${accent}: label color survives global theme rules`);
      await button.hover();
      assert.equal((await styles()).outline, expected.fill, `${accent}: hover matches the rendered fill`);
      await page.keyboard.press("Tab");
      await button.focus();
      const focused = await styles();
      assert(focused.focusVisible, `${accent}: keyboard focus is visible`);
      assert.equal(focused.outline, expected.focus, `${accent}: distinct keyboard focus color`);
      assert.equal(focused.fill, rest.fill, `${accent}: interaction preserves fill`);
      assert.equal(focused.shadow, rest.shadow, `${accent}: interaction preserves tonal edge`);
    }

    for (const [name, color] of Object.entries(accents)) {
      await check(
        page.locator(`#${sampleId} [data-accent="${name}"]`),
        color,
        !dark && name === "yellow" ? "rgb(80, 80, 80)" : "rgb(255, 255, 255)",
      );
    }
    for (const textColor of ["white", "black"]) {
      await check(
        page.locator(`#${sampleId} [data-accent="override-${textColor}"]`),
        accents["bright-green"],
        textColor === "white" ? "rgb(255, 255, 255)" : "rgb(0, 0, 0)",
      );
    }
    // Exercise the actual login and donation actions shown in the reported screenshots.
    for (const [href, color] of [
      ["/backend", accents["bright-green"]],
      ["/spenden", accents.orange],
    ] as const) {
      const button = page.locator(`a.canonical-button[href="${href}"][style*="${color}"]:visible`).first();
      await check(button, color, "rgb(255, 255, 255)");
    }
    const disabled = page.locator(`#${sampleId} [data-accent="disabled"]`);
    await disabled.hover({ force: true });
    const state = await disabled.evaluate((element) => ({
      outline: getComputedStyle(element).outlineColor,
      opacity: getComputedStyle(element).opacity,
      cursor: getComputedStyle(element).cursor,
    }));
    assert.deepEqual(state, { outline: "rgba(0, 0, 0, 0)", opacity: "0.5", cursor: "not-allowed" });
    for (const layout of await page.locator(`#${sampleId} [data-accent="long-label"]`).evaluateAll((elements) =>
      elements.map((element) => ({
        width: element.getBoundingClientRect().width,
        parentWidth: element.parentElement!.clientWidth,
        labelWidth: element.lastElementChild!.clientWidth,
        labelScrollWidth: element.lastElementChild!.scrollWidth,
      })),
    )) {
      assert(layout.width <= layout.parentWidth + 1, "Translated actions fit narrow containers");
      assert(layout.labelScrollWidth <= layout.labelWidth + 1, "Long translated labels wrap without clipping");
    }
  } finally {
    await page.locator(`#${sampleId}`).evaluateAll((elements) => elements.forEach((element) => element.remove()));
    await transitionOverride.evaluate((element) => element.parentNode?.removeChild(element));
  }
}

import { parseDocument, DomUtils } from "htmlparser2";
import render from "dom-serializer";
import { sanitizeHtml } from "./sanitizeHtml";

/** Preserve authored legacy content without restoring arbitrary inline layout CSS. */
export function legacyCmsHtml(
  raw: string | null | undefined,
  cmsBase: string,
  stepIcons: readonly string[] = [],
): string {
  if (!raw) return "";
  const document = parseDocument(raw);
  const base = cmsBase.replace(/\/+$/, "");
  const elements = DomUtils.getElementsByTagName("*", document.children, true);
  for (const element of elements) {
    for (const attribute of ["src", "href", "poster"]) {
      const value = element.attribs[attribute];
      if (!value || !base) continue;
      const relative = /^\/backend\/(.*)$/.exec(value);
      const absolute =
        /^https:\/\/(?:www\.)?stadt-land-klima\.de\/backend\/(.*)$/.exec(value) ??
        /^https:\/\/future\.stadt-land-klima\.de\/backend\/(.*)$/.exec(value);
      const suffix = relative?.[1] ?? absolute?.[1];
      if (suffix !== undefined) element.attribs[attribute] = `${base}/${suffix}`;
    }
    if (
      element.name === "img" &&
      (/b6b05d62-54e5-4801-94de-010b77017355|04467726-931d-47c0-a7a4-8ed4d9811232/.test(element.attribs.src || "") ||
        /illustrationen.*anmeldung/i.test(element.attribs.alt || ""))
    ) {
      element.attribs.class = `${element.attribs.class || ""} slk-cms-illustration`.trim();
    }
    const step = /^mitmachen_([1-6])$/.exec(element.attribs.id || "");
    if (!step) continue;
    const children = element.children.filter((child) => "attribs" in child);
    const marker = children.find((child) => /^\d+\.$/.test(DomUtils.textContent(child).trim()));
    if (!marker) continue;
    const body = DomUtils.nextElementSibling(marker);
    if (!body || body.name !== "div") continue;
    const row = DomUtils.getElementsByTagName(
      "div",
      parseDocument('<div class="slk-cms-step-row"></div>').children,
    )[0]!;
    DomUtils.replaceElement(marker, row);
    DomUtils.appendChild(row, marker);
    DomUtils.removeElement(body);
    DomUtils.appendChild(row, body);
    marker.attribs.class = "slk-cms-step-marker";
    body.attribs.class = "slk-cms-step-body";
    const icon = stepIcons[Number(step[1]) - 1];
    if (icon) {
      const image = DomUtils.getElementsByTagName("img", parseDocument("<img>").children)[0]!;
      image.attribs = { src: icon, alt: "", width: "40", height: "40" };
      for (const child of [...marker.children]) DomUtils.removeElement(child);
      DomUtils.appendChild(marker, image);
      marker.attribs["aria-hidden"] = "true";
    }
  }
  return sanitizeHtml(render(document));
}

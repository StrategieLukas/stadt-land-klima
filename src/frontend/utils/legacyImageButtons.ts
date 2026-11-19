import { ElementType, type parseDocument } from "htmlparser2";
import type { TranslationKey } from "~/shared/translationKeys";

export type CmsHtmlNode = ReturnType<typeof parseDocument>["children"][number];

// These legacy CMS assets contain outlined/rasterized words, not translatable text.
// Match their stable IDs, never translated alt text, filenames or link destinations.
const buttons: Record<string, { labelKey: TranslationKey; iconSlug: string }> = {
  "bbe7a633-d03b-4dff-a675-af7230555da5": { labelKey: "cms.cta.ranking", iconSlug: "icon_map_view" },
  "6e20397d-50b3-46fe-be6e-4fa425c65eb5": { labelKey: "cms.cta.become_checker", iconSlug: "icon_klimachecker" },
  "5f04e035-d7ff-4c15-800a-d28ce4956dec": { labelKey: "cms.cta.become_checker", iconSlug: "icon_klimachecker" },
  "c14be5d6-8dc5-41de-848d-681d708a1706": { labelKey: "cms.cta.workshop", iconSlug: "icon_team" },
  "a1763346-ee1b-4cee-a6c1-99d1d2dd15bb": { labelKey: "cms.cta.localteam", iconSlug: "icon_team" },
  "96e3fc8f-4124-4da7-9bc4-413af717153d": { labelKey: "cms.cta.onboarding", iconSlug: "icon_team" },
  "fb9a0d2a-1628-4a89-9717-c0e792350176": { labelKey: "cms.cta.about", iconSlug: "icon_info" },
  "7027974b-c07a-4a05-9ee7-99caf1ad8b7b": { labelKey: "cms.cta.projects", iconSlug: "icon_impact" },
  "b0905ebe-4d25-4201-abfb-e54989a97af0": { labelKey: "cms.cta.measures", iconSlug: "icon_evaluation_criteria" },
  "cc924238-d714-46f6-abd5-03f9d2d53b5f": { labelKey: "cms.cta.partners", iconSlug: "icon_team" },
  "8e0556d9-ba23-46b9-bbb2-493dcb99b1cb": { labelKey: "cms.cta.newsletter", iconSlug: "icon_newsletter_click" },
  "8814f616-eeec-4bc9-a101-7d3dce6aa6ff": { labelKey: "cms.cta.team", iconSlug: "icon_team" },
  "5c615caa-8411-463b-8181-49e114025b50": { labelKey: "cms.cta.contact", iconSlug: "icon_info" },
  "11fe2af6-d9d5-441c-acd8-a145d5ff5035": { labelKey: "cms.cta.donate", iconSlug: "icon_hand_holding_heart" },
  "18c82d29-2b63-4e44-8e24-08aa73503175": { labelKey: "cms.cta.signal", iconSlug: "icon_signal" },
  "7020103c-7cd6-49db-9efa-de2d674adc3b": { labelKey: "cms.cta.handbook", iconSlug: "icon_hint" },
};
const siteOrigin = "https://www.stadt-land-klima.de";
const legacyOrigins = new Set([siteOrigin, "https://stadt-land-klima.de", "https://future.stadt-land-klima.de"]);

export function legacyImageButton(node: CmsHtmlNode, cmsBase: string) {
  if (node.type !== ElementType.Tag || node.name !== "a" || !node.attribs.href) return undefined;
  const children = node.children.filter((child) => child.type !== ElementType.Text || child.data.trim());
  const image = children[0];
  if (children.length !== 1 || image?.type !== ElementType.Tag || image.name !== "img") return undefined;
  const src = image.attribs.src;
  if (!src || src.startsWith("//")) return undefined;
  try {
    const url = new URL(src, siteOrigin);
    const base = new URL(cmsBase, siteOrigin);
    if (!["http:", "https:"].includes(url.protocol)) return undefined;
    const prefix = url.origin === base.origin ? `${base.pathname.replace(/\/+$/, "")}/assets/` : "";
    const path =
      prefix && url.pathname.startsWith(prefix)
        ? url.pathname.slice(prefix.length)
        : legacyOrigins.has(url.origin) && url.pathname.startsWith("/backend/assets/")
          ? url.pathname.slice("/backend/assets/".length)
          : "";
    const id = /^([a-f0-9-]{36})(?:\/[^/]+)?$/i.exec(path)?.[1]?.toLowerCase();
    return id ? buttons[id] : undefined;
  } catch {
    return undefined;
  }
}

import { sanitizeText } from "../utils/sanitizeHtml";
import { resolveSiteOrigin } from "./serviceUrl";
import type { EditorBlock } from "./editorBlocks";
export { resolveSiteOrigin } from "./serviceUrl";

export const SITE_NAME = "Stadt.Land.Klima!";

/** Strip markup, hidden executable content, CMS placeholders and duplicate whitespace. */
export function metadataText(value: string | null | undefined, limit = 180): string {
  const plain = sanitizeText((value ?? "").replace(/<\/(?:p|div|h[1-6]|li|blockquote)>|<br\s*\/?>/gi, " "))
    .replace(/\[\[\[[\s\S]*?\]\]\]/g, "")
    .replace(/\p{Cc}/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  const characters = Array.from(plain);
  if (characters.length <= limit) return plain;
  const shortened = characters.slice(0, limit - 1).join("");
  const boundary = shortened.lastIndexOf(" ");
  return `${boundary > limit * 0.6 ? shortened.slice(0, boundary) : shortened}…`;
}

export function metadataTitle(value: string | null | undefined): string {
  const title = metadataText(value, 110);
  return !title || title === SITE_NAME || title.endsWith(` - ${SITE_NAME}`)
    ? title || SITE_NAME
    : `${title} - ${SITE_NAME}`;
}

/** A strict query allowlist prevents tracking, preview tokens and user answers becoming public identifiers. */
export function canonicalUrl(origin: string, path: string, query: Readonly<Record<string, unknown>>): string {
  const url = new URL(resolveSiteOrigin(origin));
  // Assign pathname instead of resolving path: a //evil.example path must stay on our origin.
  url.pathname = path.replace(/\/+$/, "") || "/";
  const version = query.v;
  if (typeof version === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(version)) url.searchParams.set("v", version);
  return url.href;
}

export function isPrivateSeoRoute(path: string, query: Readonly<Record<string, unknown>>): boolean {
  return (
    /^\/(?:elections\/thesen|login|logout|account|admin|backend)(?:\/|$)/.test(path) ||
    Object.keys(query).some((key) => /^(?:blokkli|preview|access_token|token|auth)/i.test(key))
  );
}

/** Published prose only: ignore button labels, form fields, embeds and referenced/private entities. */
export function contentDescription(contents: string | null | undefined, blocks: readonly EditorBlock[]): string {
  const legacy = metadataText(contents);
  if (legacy) return legacy;
  const excerpts: string[] = [];
  function visit(items: readonly EditorBlock[], depth: number): void {
    if (depth > 32 || excerpts.join(" ").length > 600) return;
    for (const block of items) {
      if (block.bundle === "text" || block.bundle === "richtext") excerpts.push(block.props.content ?? "");
      if (block.bundle === "hero" || block.bundle === "municipality_search_hero" || block.bundle === "landing_page")
        excerpts.push(block.props.subtitle ?? "");
      if (block.bundle === "container" || block.bundle === "hero") visit(block.props.blocks ?? [], depth + 1);
    }
  }
  visit(blocks, 0);
  return metadataText(excerpts.join(" "));
}

/** Only public raster CMS assets are eligible; never accept arbitrary or signed URLs. */
export function socialAssetUrl(
  cmsUrl: string,
  asset: { id: string; type?: string | null | undefined } | string | null | undefined,
  siteUrl: string,
): string | null {
  const id = typeof asset === "string" ? asset : asset?.id;
  if (!id || !/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(id)) return null;
  if (typeof asset === "object" && asset?.type && !/^image\/(?:jpeg|png|webp|avif)$/i.test(asset.type)) return null;
  try {
    const base = new URL(cmsUrl, resolveSiteOrigin(siteUrl));
    if (!["http:", "https:"].includes(base.protocol) || base.username || base.password || base.search || base.hash)
      return null;
    base.pathname = `${base.pathname.replace(/\/+$/, "")}/assets/${id}`;
    base.search = new URLSearchParams({ width: "1200", height: "630", fit: "cover", format: "jpg" }).toString();
    return base.href;
  } catch {
    return null;
  }
}

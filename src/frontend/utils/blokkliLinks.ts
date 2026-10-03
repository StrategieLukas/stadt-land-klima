/**
 * Return a human-readable, stable DOM id for a block when an editor supplied
 * an anchor, while retaining the UUID-based id for existing deep links.
 */
export function getBlokkliBlockId(anchor: unknown, uuid: string): string {
  if (typeof anchor !== "string") return `block-${uuid}`;

  const normalized = anchor
    .trim()
    .replace(/^#+/, "")
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}_:.-]/gu, "");

  return normalized || `block-${uuid}`;
}

/** Keep hash and query links on the current page; make page slugs absolute. */
export function resolveBlokkliInternalLink(link: unknown): string {
  if (typeof link !== "string") return "#";

  const normalized = link.trim();
  if (!normalized) return "#";
  if (normalized.startsWith("#") || normalized.startsWith("?")) return normalized;

  return `/${normalized.replace(/^\/+/, "")}`;
}

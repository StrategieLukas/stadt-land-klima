import type { NavigationItem } from "../types/components/navigation.js";

export function navigationDropdownLayout(item: NavigationItem): "preview" | "cards" | "list" {
  if (item.dropdown_layout) return item.dropdown_layout;
  const images = (item.children ?? []).filter((child) => child.image_id).length;
  return images === 0 ? "list" : images <= 2 ? "cards" : "preview";
}
export function navigationDestination(item: NavigationItem) {
  if (item.link_type === "page") {
    const slug = (item.page_slug ?? "").replace(/^\/+/, "");
    if (/^[a-zA-Z0-9_/-]*$/.test(slug) && !slug.includes("..")) return { type: "page" as const, href: `/${slug}` };
  }
  if (item.link_type === "external" && item.external_url) {
    try {
      const url = new URL(item.external_url);
      if (["https:", "http:"].includes(url.protocol) && !url.username && !url.password)
        return { type: "external" as const, href: url.href };
    } catch {
      /* Invalid CMS destinations render as text. */
    }
  }
  return { type: "none" as const, href: undefined };
}

import type { RouteLocationRaw } from "vue-router";
import type { AreaCta } from "~/shared/contracts/search";
export interface NavigationItem {
  id: string | number;
  label?: string | null;
  name?: string | null;
  title?: string | null;
  description?: string | null;
  translation_key?: string | null;
  link_type?: "page" | "external" | "none";
  page_slug?: string | null;
  slug?: string | null;
  external_url?: string | null;
  open_new_tab?: boolean;
  image_id?: string | null;
  icon?: string | null;
  links?: NavigationItem[];
  children?: NavigationItem[] | null;
}
export interface NavigationPage {
  id: string;
  slug: string;
  name: string;
  sort_order?: number | null;
  icon_svg?: string;
  label?: string | null;
  translation_key?: string | null;
}
export interface AreaResult {
  ars: string;
  name: string;
  prefix?: string;
  level?: number | null;
  population?: number | string | null;
  stateLabel?: string | null;
  typeLabel?: string | null;
  ctaType?: AreaCta;
  scoreDisplay?: string | null;
  scoreTotalColorClass?: string | null;
  _slug?: string | null;
  _oldCatalogName?: string | null;
  isMunicipality?: boolean;
  url?: string | null;
}
export type AreaChipAction = { action: "mitmachen" | "update" | "gruenden"; ars: string; result: AreaResult };
export type AreaRouteBuilder = (area: AreaResult) => RouteLocationRaw | null | undefined;

import type { RouteLocationRaw } from "vue-router";
import type { AreaCta } from "~/shared/contracts/search";
export interface NavigationItem {
  id: string | number;
  label?: string | null | undefined;
  name?: string | null | undefined;
  title?: string | null | undefined;
  description?: string | null | undefined;
  translation_key?: string | null | undefined;
  link_type?: "page" | "external" | "none" | undefined;
  page_slug?: string | null | undefined;
  slug?: string | null | undefined;
  external_url?: string | null | undefined;
  open_new_tab?: boolean | undefined;
  image_id?: string | null | undefined;
  icon?: string | null | undefined;
  links?: NavigationItem[] | undefined;
  children?: NavigationItem[] | null | undefined;
}
export interface NavigationPage {
  id: string;
  slug: string;
  name: string;
  sort_order?: number | null | undefined;
  icon_svg?: string | null | undefined;
  label?: string | null | undefined;
  translation_key?: string | null | undefined;
}
export interface AreaResult {
  ars: string;
  name: string;
  prefix?: string | undefined;
  level?: number | null | undefined;
  population?: number | string | null | undefined;
  stateLabel?: string | null | undefined;
  typeLabel?: string | null | undefined;
  ctaType?: AreaCta | undefined;
  scoreDisplay?: string | null | undefined;
  scoreTotalColorClass?: string | null | undefined;
  _slug?: string | null | undefined;
  _oldCatalogName?: string | null | undefined;
  isMunicipality?: boolean | undefined;
  url?: string | null | undefined;
}
export type AreaChipAction = { action: "mitmachen" | "update" | "gruenden"; ars: string; result: AreaResult };
export type AreaRouteBuilder = (area: AreaResult) => RouteLocationRaw | null | undefined;

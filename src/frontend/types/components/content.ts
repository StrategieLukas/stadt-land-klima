import type { Measure } from "./municipality";
export type Asset = string | { id: string; type?: string | null | undefined } | null;
export interface Organisation {
  id?: string | number | undefined;
  name?: string | null | undefined;
  link?: string | null | undefined;
  logo?: Asset | undefined;
  instagram?: string | null | undefined;
  linkedin?: string | null | undefined;
}
export interface Project {
  id: number;
  slug: string;
  title: string;
  author?: string | null | undefined;
  date?: string | Date | null | undefined;
  municipality_name?: string | null | undefined;
  municipality_slug?: string | null | undefined;
  state?: string | null | undefined;
  abstract?: string | null | undefined;
  image_id?: string | null | undefined;
  image_is_raster?: boolean | null | undefined;
  image_credits?: string | null | undefined;
  organisation?: Organisation | null | undefined;
  measures?: Pick<Measure, "id" | "measure_id" | "name" | "slug">[] | null | undefined;
}

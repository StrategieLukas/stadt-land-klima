import type { Measure } from "./municipality";
export type Asset = string | { id: string; type?: string | null } | null;
export interface Organisation {
  id?: string | number;
  name?: string | null;
  link?: string | null;
  logo?: Asset;
  instagram?: string | null;
  linkedin?: string | null;
}
export interface Project {
  id: string;
  slug: string;
  title: string;
  author?: string | null;
  date?: string | Date | null;
  municipality_name?: string | null;
  municipality_slug?: string | null;
  state?: string | null;
  abstract?: string | null;
  image_id?: string | null;
  image_is_raster?: boolean | null;
  image_credits?: string | null;
  organisation?: Organisation | null;
  measures?: Measure[] | null;
}

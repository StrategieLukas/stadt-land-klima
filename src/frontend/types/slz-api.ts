export type LayoutHint = "default" | "full_width" | "split" | "kpi_map" | "image_text";

export interface RenderElement {
  plot_id: string;
  type: "map" | "kpi" | "histogram" | "bar_chart" | "pie_chart" | "time_series" | "image" | "table" | "graph" | "altair";
  step?: number;
  title?: Record<string, string>;
  description?: Record<string, string>;
  vegalite_spec: object | null;
  field?: string;
  unit?: Record<string, string>;
  label?: Record<string, string>;
  population_normalized?: boolean;
  is_percentage?: boolean;
  thresholds?: Record<string, number>;
  src_url?: string;
  image_field?: string;
  [key: string]: unknown;
}

export interface NarrativeStep {
  index: number;
  title: Record<string, string>;
  description: Record<string, string>;
  plot_ids: string[];
  layout: LayoutHint;
}

export interface TemporalExtent {
  start: string;
  end: string | null;
  resolution: string;
}

export interface CollectionRenderConfig {
  layer_type?: string;
  color_field?: string;
  threshold_bar?: {
    thresholds?: Record<string, number>;
  };
}

export interface CollectionCoverImage {
  type?: "slk_backend_asset" | "url" | string;
  asset_uuid?: string | null;
  assetUuid?: string | null;
  uuid?: string | null;
  id?: string | null;
  url?: string | null;
  src?: string | null;
  href?: string | null;
  attribution?: Record<string, string> | string | null;
  attribution_key?: Record<string, string> | string | null;
  attributionKey?: Record<string, string> | string | null;
}

export interface Collection {
  id: string;
  title: Record<string, string>;
  description: Record<string, string>;
  sector: string | null;
  sector_label?: Record<string, string> | string;
  sectorLabel?: Record<string, string> | string;
  sector_display?: string;
  sectorDisplay?: string;
  cover_image_url?: string | null;
  coverImageUrl?: string | null;
  cover_image?: CollectionCoverImage | null;
  coverImage?: CollectionCoverImage | null;
  source_attributions?: SourceAttribution[];
  sourceAttributions?: SourceAttribution[];
  iconify_str?: string | null;
  iconifyStr?: string | null;
  tags?: string[];
  temporal_extent?: TemporalExtent | null;
  temporalExtent?: TemporalExtent | null;
  narrative_steps?: NarrativeStep[];
  narrativeSteps?: NarrativeStep[];
  render_elements?: RenderElement[];
  renderElements?: RenderElement[];
  hasNarrativeSteps?: boolean;
  render_config?: CollectionRenderConfig;
  renderConfig?: CollectionRenderConfig;
}

export interface SourceAttribution {
  source?: Record<string, string> | string | null;
  attribution?: string | null;
  source_url?: string | null;
  sourceUrl?: string | null;
  license_name?: string | null;
  licenseName?: string | null;
  license_url?: string | null;
  licenseUrl?: string | null;
  role?: Record<string, string> | string | null;
}

export interface SummaryAggregate {
  id?: number;
  total?: number;
  sum?: number;
  count?: number;
  mean?: number;
  avg?: number;
  value?: number;
  metadata?: {
    attribution?: string;
    attribution_url?: string;
    license_name?: string;
    license_url?: string;
    effective_date?: string;
  };
  [key: string]: unknown;
}

export interface CollectionSummary {
  aggregate: SummaryAggregate;
  kpi_values?: Record<string, { value: number | null; raw_value?: number | null; precision?: number | null }>;
  kpiValues?: Record<string, { value: number | null; raw_value?: number | null; precision?: number | null }>;
  source_attributions?: SourceAttribution[];
  sourceAttributions?: SourceAttribution[];
  area?: string;
  area_population?: number | null;
  areaPopulation?: number | null;
}

export interface AdministrativeArea {
  ars: string;
  name: string;
  level: number;
  prefix: string;
  population: number | null;
  geo_center?: { lat: number; lon: number } | null;
  geo_area?: object | string | null;
  contained_by?: AdministrativeArea[];
}

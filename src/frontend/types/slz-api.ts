import type { EditableSpec } from "~/shared/visualization";
import type { GeoData } from "~/shared/contracts/geometry";
export type LayoutHint = "default" | "full_width" | "split" | "kpi_map" | "image_text";

export interface RenderElement {
  plot_id: string;
  type:
    "map" | "kpi" | "histogram" | "bar_chart" | "pie_chart" | "time_series" | "image" | "table" | "graph" | "altair";
  step?: number | undefined;
  title?: Record<string, string> | undefined;
  description?: Record<string, string> | undefined;
  vegalite_spec: EditableSpec | null;
  maplibre_spec?: MapLibreRenderSpec | null | undefined;
  maplibreSpec?: MapLibreRenderSpec | null | undefined;
  field?: string | undefined;
  unit?: Record<string, string> | undefined;
  label?: Record<string, string> | undefined;
  population_normalized?: boolean | undefined;
  is_percentage?: boolean | undefined;
  thresholds?: Record<string, number> | undefined;
  src_url?: string | undefined;
  image_field?: string | undefined;
  [key: string]: unknown;
}

export interface MapLibreRenderSpec {
  renderer?: string | undefined;
  version?: number | undefined;
  style?: Record<string, unknown> | undefined;
  sources?: {
    features?: {
      data?: string | Record<string, unknown> | null | undefined;
      [key: string]: unknown;
    } | undefined;
    density?: {
      url_template?: string | undefined;
      urlTemplate?: string | undefined;
      [key: string]: unknown;
    } | undefined;
    [key: string]: Record<string, unknown> | undefined;
  } | undefined;
  layers?: Array<Record<string, unknown>> | undefined;
  tooltip_fields?: Array<
    string | { field?: string | undefined; label?: string | Record<string, string> | undefined; title?: string | Record<string, string> | undefined }
  > | undefined;
  tooltipFields?: Array<
    string | { field?: string | undefined; label?: string | Record<string, string> | undefined; title?: string | Record<string, string> | undefined }
  > | undefined;
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
  kpi?: unknown;
  primary_kpi?: unknown;
  primaryKpi?: unknown;
  kpis?: unknown[] | undefined;
  colorField?: string | undefined;
  thresholdBar?: unknown;
  layer_type?: string | undefined;
  color_field?: string | undefined;
  threshold_bar?: {
    thresholds?: Record<string, number> | undefined;
  } | undefined;
}

export interface CollectionCoverImage {
  type?: string | undefined;
  asset_uuid?: string | null | undefined;
  assetUuid?: string | null | undefined;
  uuid?: string | null | undefined;
  id?: string | null | undefined;
  url?: string | null | undefined;
  src?: string | null | undefined;
  href?: string | null | undefined;
  attribution?: Record<string, string> | string | null | undefined;
  attribution_key?: Record<string, string> | string | null | undefined;
  attributionKey?: Record<string, string> | string | null | undefined;
}

export interface CollectionOverviewVisual {
  plot_id: string;
  type: "municipality_map" | "histogram";
  image_url: string;
  title?: Record<string, string> | undefined;
  description?: Record<string, string> | undefined;
  alt?: Record<string, string> | undefined;
  attribution?: Record<string, string> | string | null | undefined;
}

export interface Collection {
  id: string;
  title: Record<string, string>;
  description: Record<string, string>;
  overview_visuals?: CollectionOverviewVisual[] | undefined;
  sector: string | null;
  sector_label?: Record<string, string> | string | undefined;
  sectorLabel?: Record<string, string> | string | undefined;
  sector_display?: string | undefined;
  sectorDisplay?: string | undefined;
  cover_image_url?: string | null | undefined;
  coverImageUrl?: string | null | undefined;
  cover_image?: CollectionCoverImage | null | undefined;
  coverImage?: CollectionCoverImage | null | undefined;
  source_attributions?: SourceAttribution[] | undefined;
  sourceAttributions?: SourceAttribution[] | undefined;
  iconify_str?: string | null | undefined;
  iconifyStr?: string | null | undefined;
  tags?: string[] | undefined;
  temporal_extent?: TemporalExtent | null | undefined;
  temporalExtent?: TemporalExtent | null | undefined;
  narrative_steps?: NarrativeStep[] | undefined;
  narrativeSteps?: NarrativeStep[] | undefined;
  render_elements?: RenderElement[] | undefined;
  renderElements?: RenderElement[] | undefined;
  hasNarrativeSteps?: boolean | undefined;
  render_config?: CollectionRenderConfig | undefined;
  renderConfig?: CollectionRenderConfig | undefined;
}

export interface SourceAttribution {
  source?: Record<string, string> | string | null | undefined;
  attribution?: string | null | undefined;
  source_url?: string | null | undefined;
  sourceUrl?: string | null | undefined;
  license_name?: string | null | undefined;
  licenseName?: string | null | undefined;
  license_url?: string | null | undefined;
  licenseUrl?: string | null | undefined;
  role?: Record<string, string> | string | null | undefined;
}

export interface SummaryAggregate {
  id?: number | undefined;
  total?: number | undefined;
  sum?: number | undefined;
  count?: number | undefined;
  mean?: number | undefined;
  avg?: number | undefined;
  value?: number | undefined;
  metadata?: {
    attribution?: string | undefined;
    attribution_url?: string | undefined;
    license_name?: string | undefined;
    license_url?: string | undefined;
    effective_date?: string | undefined;
  } | undefined;
  [key: string]: unknown;
}

export interface CollectionSummary {
  aggregate: SummaryAggregate;
  kpi_values?: Record<string, { value: number | null; raw_value?: number | null | undefined; precision?: number | null | undefined }> | undefined;
  kpiValues?: Record<string, { value: number | null; raw_value?: number | null | undefined; precision?: number | null | undefined }> | undefined;
  source_attributions?: SourceAttribution[] | undefined;
  sourceAttributions?: SourceAttribution[] | undefined;
  area?: string | undefined;
  area_population?: number | null | undefined;
  areaPopulation?: number | null | undefined;
}

export interface AdministrativeArea {
  ars: string;
  name: string;
  level: number;
  prefix: string;
  population: number | null;
  geo_center?: { lat: number; lon: number } | null | undefined;
  geo_area?: GeoData | string | null | undefined;
  contained_by?: AdministrativeArea[] | undefined;
}

import type {
  HistogramResponse,
  MunicipalityOverview,
  OverviewMetric,
  OverviewMunicipality,
} from "../../../../src/frontend/shared/contracts/municipalityOverview.js";

export const overviewMetricFixture: OverviewMetric = {
  id: "power",
  title: { "de-DE": "Leistung", "en-US": "Power", "it-IT": "Potenza" },
  description: {},
  unit: { "de-DE": "kW je 1.000 Einw.", "en-US": "kW per 1,000 residents" },
  precision: 1,
  percentage_representation: "none",
  normalization: { basis: "population", per: 1000 },
  default_color_mode: "score",
  color_modes: ["score", "continuous"],
  score_scale: {
    classes: [
      { id: "red", label: { "de-DE": "Gering" }, color: "#E30613" },
      { id: "darkgreen", label: { "de-DE": "Hoch" }, color: "#1EA64A" },
    ],
  },
  continuous_scale: {
    stops: [
      { value: 0, color: "#d6f5ff" },
      { value: 100, color: "#006e94" },
    ],
  },
};
export const overviewFixture: MunicipalityOverview = {
  contract_version: 1,
  collection: "wind-turbines",
  status: "available",
  snapshot_id: "fixture-edition-1",
  metric_id: "power",
  metrics: [
    overviewMetricFixture,
    {
      ...overviewMetricFixture,
      id: "second-metric",
      title: { "de-DE": "Zweiter Kennwert" },
      default_color_mode: "continuous",
    },
  ],
  scope: { ars: "DE", name: "Deutschland", state_ars: null },
  cohort: { eligible_count: 3, included_count: 2, missing_count: 1, excluded_count: 0 },
  stats: { median: 5 },
  map: {
    tile_url:
      "/api/stadtlandzahl/api/collections/wind-turbines/overview/tiles/{z}/{x}/{y}.pbf?snapshot=fixture-edition-1",
    bounds: [5.5, 47, 15.5, 55.5],
    minzoom: 0,
    maxzoom: 12,
    no_data_color: "#9D9D9C",
  },
  histogram: {
    type: "histogram",
    plot_id: "histogram-power",
    data_url: "/api/stadtlandzahl/api/collections/wind-turbines/histogram/?metric=power&snapshot=fixture-edition-1",
    interactions: { reveal_municipalities: { metric_id: "power", selection: "whole_bin" } },
    vegalite_spec: {
      $schema: "https://vega.github.io/schema/vega-lite/v6.json",
      width: "container",
      height: 200,
      layer: [
        {
          name: "municipality-histogram-bars",
          data: {
            url: "/api/stadtlandzahl/api/collections/wind-turbines/histogram/?metric=power&snapshot=fixture-edition-1",
            format: { type: "json", property: "segments" },
          },
          mark: "bar",
          encoding: {
            x: { field: "display_lower", type: "quantitative", bin: "binned", title: "kW" },
            x2: { field: "display_upper" },
            y: { field: "segment_count", type: "quantitative", stack: "zero" },
            color: { field: "quintile_color", type: "nominal", legend: null },
          },
        },
      ],
    },
  },
  links: {
    municipalities:
      "/api/stadtlandzahl/api/collections/wind-turbines/overview/municipalities/?snapshot=fixture-edition-1",
    regions: "/api/stadtlandzahl/api/collections/wind-turbines/overview/regions/?snapshot=fixture-edition-1",
  },
  attribution: { "de-DE": "Testdaten", "en-US": "Fixture data" },
  update_info: { last_updated_at: "2026-11-01T12:00:00Z", verification_status: "verified" },
};
export const histogramFixture: HistogramResponse = {
  metric: overviewMetricFixture,
  bins: [
    { bin_index: 0, lower: 0, upper: 10, display_label: "0–10", count: 2 },
    { bin_index: 1, lower: 10, upper: 20, display_label: "10–20", count: 0 },
  ],
  segments: [
    { bin_index: 0, display_lower: 0, display_upper: 10, count: 2, segment_count: 1, quintile_color: "red" },
    { bin_index: 0, display_lower: 0, display_upper: 10, count: 2, segment_count: 1, quintile_color: "darkgreen" },
  ],
  interaction_context: {
    snapshot_id: overviewFixture.snapshot_id,
    metric_id: "power",
    members_url: overviewFixture.links.municipalities,
  },
};
export const municipalityFixture: OverviewMunicipality = {
  ars: "081110000000",
  name: "Stuttgart",
  prefix: "Stadtkreis",
  slug: "stadtkreis_stuttgart",
  state_name: "Baden-Württemberg",
  district_name: null,
  value: 0,
  data_status: "available",
};

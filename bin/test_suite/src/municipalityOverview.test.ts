import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { overviewContract } from "./overviewContract.js";
import {
  HistogramResponseSchema,
  MunicipalityOverviewSchema,
  OverviewMetricSchema,
  OverviewMunicipalitiesSchema,
} from "../../../src/frontend/shared/contracts/municipalityOverview.js";
import { CollectionSchema, RenderElementSchema } from "../../../src/frontend/shared/contracts/slz.js";
import {
  bindHistogramData,
  checkedOverviewUrl,
  formatOverviewValue,
  histogramBinFromItem,
  municipalityProductRoute,
} from "../../../src/frontend/utils/municipalityOverview.js";
import { navigationDestination, navigationDropdownLayout } from "../../../src/frontend/utils/navigationDropdown.js";
import {
  histogramFixture,
  municipalityFixture,
  overviewFixture,
  overviewMetricFixture,
} from "./fixtures/municipalityOverview.js";

test("the backend handoff schema and examples match the checked frontend contract", () => {
  assert.deepEqual(
    JSON.parse(readFileSync(new URL("../../../docs/contracts/municipality-overview.v1.json", import.meta.url), "utf8")),
    overviewContract(),
  );
});

test("overview retains two configured metrics and independently validated color modes", () => {
  const context = MunicipalityOverviewSchema.parse(overviewFixture);
  assert.equal(context.metrics.length, 2);
  assert.equal(context.metrics[1]?.default_color_mode, "continuous");
  assert.equal(MunicipalityOverviewSchema.safeParse({ ...overviewFixture, metric_id: "unknown" }).success, false);
  assert.equal(
    MunicipalityOverviewSchema.safeParse({
      ...overviewFixture,
      metrics: [overviewMetricFixture, overviewMetricFixture],
    }).success,
    false,
  );
  assert.equal(OverviewMetricSchema.safeParse({ ...overviewMetricFixture, score_scale: undefined }).success, false);
  assert.equal(
    OverviewMetricSchema.safeParse({
      ...overviewMetricFixture,
      continuous_scale: {
        stops: [
          { value: 1, color: "#000000" },
          { value: 0, color: "#ffffff" },
        ],
      },
    }).success,
    false,
  );
});

test("percentage representation and normalized zero are explicit, never guessed", () => {
  assert.equal(formatOverviewValue(0, overviewMetricFixture, "en-GB"), "0.0");
  assert.equal(formatOverviewValue(null, overviewMetricFixture, "en-GB"), null);
  assert.equal(
    formatOverviewValue(0.35, { ...overviewMetricFixture, percentage_representation: "fraction" }, "en-GB"),
    "35.0%",
  );
  assert.equal(
    formatOverviewValue(35, { ...overviewMetricFixture, percentage_representation: "percent" }, "en-GB"),
    "35.0 %",
  );
  assert.equal(formatOverviewValue(-2, overviewMetricFixture, "en-GB"), "-2.0");
});

test("related links stay on the exact proxy endpoint, collection and snapshot", () => {
  assert.equal(
    checkedOverviewUrl(overviewFixture.map.tile_url, "wind-turbines", "tiles", overviewFixture.snapshot_id),
    overviewFixture.map.tile_url,
  );
  for (const url of [
    "https://attacker.test" + overviewFixture.links.municipalities,
    overviewFixture.links.municipalities.replace("wind-turbines", "solar-plants"),
    overviewFixture.links.municipalities.replace("fixture-edition-1", "another-edition"),
    overviewFixture.links.municipalities.replace("municipalities/", "../../items/"),
    "/api/editor/cms/items/users",
    "//attacker.test/api/collections",
    "javascript:alert(1)",
    overviewFixture.links.municipalities + "#fragment",
    overviewFixture.links.municipalities + "&snapshot=other-edition",
  ])
    assert.throws(() => checkedOverviewUrl(url, "wind-turbines", "municipalities", overviewFixture.snapshot_id));
});

test("binding the histogram feed preserves exact bins, stacked membership IDs and caller data", () => {
  const before = JSON.stringify(overviewFixture.histogram.vegalite_spec);
  const result = bindHistogramData(
    overviewFixture.histogram.vegalite_spec!,
    overviewFixture.histogram.data_url!,
    HistogramResponseSchema.parse(histogramFixture),
  );
  assert.equal(JSON.stringify(overviewFixture.histogram.vegalite_spec), before);
  const layers = result.layer as Array<{ data: { values: unknown[] } }>;
  assert.deepEqual(layers[0]?.data.values, histogramFixture.segments);
  assert.equal(JSON.stringify(result).includes('"url"'), false);
  assert.equal(HistogramResponseSchema.safeParse({ ...histogramFixture, segments: [] }).success, false);
  assert.throws(
    () =>
      bindHistogramData(
        { data: { url: "/api/editor/private", format: { property: "bins" } }, mark: "bar" },
        overviewFixture.histogram.data_url!,
        histogramFixture,
      ),
    /Unexpected histogram data feed/,
  );

  assert.equal(HistogramResponseSchema.safeParse({ ...histogramFixture, metric: undefined }).success, false);
  assert.equal(
    HistogramResponseSchema.safeParse({
      ...histogramFixture,
      bins: [...histogramFixture.bins, histogramFixture.bins[0]],
    }).success,
    false,
  );
});

test("only named bar marks emit whole-bin selections, regardless of clicked segment", () => {
  assert.equal(
    histogramBinFromItem({ mark: { name: "municipality_histogram_bars_marks" }, datum: { bin_index: 0 } }),
    0,
  );
  for (const segment of histogramFixture.segments)
    assert.equal(histogramBinFromItem({ mark: { name: "municipality-histogram-bars_marks" }, datum: segment }), 0);
  for (const name of ["municipality-marker", "axis-label", "background"])
    assert.equal(histogramBinFromItem({ mark: { name }, datum: { bin_index: 0 } }), null);
  for (const bin_index of [-1, "0", NaN, 0.5, undefined])
    assert.equal(
      histogramBinFromItem({ mark: { name: "municipality-histogram-bars_marks" }, datum: { bin_index } }),
      null,
    );
});

test("legacy collections and histograms remain valid and opt out of interactions", () => {
  const legacy = CollectionSchema.parse({ id: "legacy", title: {}, description: {} });
  assert.equal(legacy.municipality_overview, undefined);
  assert.equal(RenderElementSchema.parse({ plot_id: "old-chart", type: "histogram" }).interactions, undefined);
  assert.equal(
    RenderElementSchema.safeParse({
      plot_id: "chart",
      type: "histogram",
      interactions: { reveal_municipalities: { metric_id: "power", selection: "segment" } },
    }).success,
    false,
  );
});

test("municipality results distinguish missing from zero and construct local product routes", () => {
  const page = OverviewMunicipalitiesSchema.parse({
    snapshot_id: overviewFixture.snapshot_id,
    count: 2,
    results: [
      municipalityFixture,
      { ...municipalityFixture, ars: "081150000000", value: null, data_status: "no_data" },
    ],
    next_cursor: null,
  });
  assert.equal(page.results[0]?.value, 0);
  assert.equal(page.results[1]?.value, null);
  assert.equal(
    municipalityProductRoute("wind-turbines", municipalityFixture),
    "/data/stadtkreis_stuttgart/wind-turbines",
  );
  assert.throws(() => municipalityProductRoute("wind-turbines", { slug: "../../admin" }));
});

test("navigation layout inference preserves explicit choices and refuses unsafe destinations", () => {
  const item = { id: "parent", children: [{ id: 1, image_id: "image" }, { id: 2 }, { id: 3, image_id: "image" }] };
  assert.equal(navigationDropdownLayout(item), "cards");
  assert.equal(
    navigationDropdownLayout({ ...item, children: [...item.children, { id: 4, image_id: "image" }] }),
    "preview",
  );
  assert.equal(navigationDropdownLayout({ ...item, dropdown_layout: "list" }), "list");
  assert.equal(navigationDropdownLayout({ id: 0 }), "list");
  for (const external_url of ["javascript:alert(1)", "https://user:password@example.test/", "data:text/html,evil"])
    assert.equal(navigationDestination({ id: 0, link_type: "external", external_url }).type, "none");
  assert.equal(navigationDestination({ id: 0, link_type: "page", page_slug: "data" }).href, "/data");
});

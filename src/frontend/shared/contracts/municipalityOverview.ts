import { z } from "zod";
import { RenderElementSchema } from "~/shared/contracts/slz";

const labels = z.record(z.string(), z.string());
const identifier = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[a-zA-Z0-9_-]+$/);
export const SnapshotIdSchema = z
  .string()
  .min(1)
  .max(2048)
  .regex(/^[a-zA-Z0-9_.:-]+$/);
export const OverviewScopeSchema = z.union([z.literal("DE"), z.string().regex(/^\d{2,12}$/)]);
const bounds = z
  .tuple([
    z.number().min(-180).max(180),
    z.number().min(-90).max(90),
    z.number().min(-180).max(180),
    z.number().min(-90).max(90),
  ])
  .refine(([west, south, east, north]) => west < east && south < north, "Invalid bounds");
const color = z.string().regex(/^#[a-fA-F0-9]{6}$/);
export const OverviewColorModeSchema = z.enum(["score", "continuous"]);
export const OverviewMetricSchema = z
  .object({
    id: identifier,
    title: labels,
    description: labels.default({}),
    unit: labels,
    precision: z.number().int().min(0).max(10),
    percentage_representation: z.enum(["none", "fraction", "percent"]),
    normalization: z.object({ basis: z.enum(["none", "population"]), per: z.number().positive().nullable() }),
    default_color_mode: OverviewColorModeSchema,
    color_modes: z.array(OverviewColorModeSchema).min(1).max(2),
    score_scale: z
      .object({
        classes: z
          .array(z.object({ id: identifier, label: labels, color }))
          .min(1)
          .max(20),
      })
      .optional(),
    continuous_scale: z
      .object({
        stops: z
          .array(z.object({ value: z.number(), color }))
          .min(2)
          .max(20),
      })
      .optional(),
  })
  .superRefine((metric, ctx) => {
    if (!metric.color_modes.includes(metric.default_color_mode))
      ctx.addIssue({ code: "custom", message: "Unavailable default color mode" });
    if (metric.color_modes.includes("score") && !metric.score_scale)
      ctx.addIssue({ code: "custom", message: "Missing score scale" });
    if (metric.color_modes.includes("continuous") && !metric.continuous_scale)
      ctx.addIssue({ code: "custom", message: "Missing continuous scale" });
    if (metric.continuous_scale?.stops.some((stop, index, stops) => index > 0 && stop.value <= stops[index - 1]!.value))
      ctx.addIssue({ code: "custom", message: "Unordered color stops" });
    if (metric.normalization.basis === "population" && metric.normalization.per === null)
      ctx.addIssue({ code: "custom", message: "Missing population basis" });
  });
export type OverviewMetric = z.infer<typeof OverviewMetricSchema>;
export type OverviewColorMode = z.infer<typeof OverviewColorModeSchema>;

export const HistogramBinSchema = z
  .object({
    bin_index: z.number().int().nonnegative(),
    lower: z.number().nullable(),
    upper: z.number().nullable(),
    display_label: z.string().max(500),
    count: z.number().int().nonnegative(),
    kind: z.string().max(80).optional(),
  })
  .loose();
export const HistogramResponseSchema = z
  .object({
    metric: OverviewMetricSchema.optional(),
    bins: z.array(HistogramBinSchema).max(1000),
    segments: z
      .array(
        z
          .object({
            bin_index: z.number().int().nonnegative(),
            segment_count: z.number().int().nonnegative(),
            display_lower: z.number(),
            display_upper: z.number(),
            quintile_color: identifier,
          })
          .loose(),
      )
      .max(5000)
      .default([]),
    score_segments: z
      .array(
        z
          .object({
            bin_index: z.number().int().nonnegative(),
            segment_count: z.number().int().nonnegative(),
            display_lower: z.number(),
            display_upper: z.number(),
            score_color: identifier,
          })
          .loose(),
      )
      .max(5000)
      .optional(),
    interaction_context: z
      .object({
        snapshot_id: SnapshotIdSchema,
        metric_id: identifier,
        members_url: z.string().max(4096),
      })
      .optional(),
  })
  .loose()
  .refine((response) => {
    const counts = new Map(response.bins.map((bin) => [bin.bin_index, 0]));
    for (const segment of response.segments) {
      if (!counts.has(segment.bin_index) || segment.display_upper <= segment.display_lower) return false;
      counts.set(segment.bin_index, counts.get(segment.bin_index)! + segment.segment_count);
    }
    return response.bins.every((bin) => counts.get(bin.bin_index) === bin.count);
  }, "Histogram segment counts differ from bins")
  .refine((response) => {
    if (!response.score_segments) return true;
    const counts = new Map(response.bins.map((bin) => [bin.bin_index, 0]));
    const classes = new Set(response.metric?.score_scale?.classes.map((item) => item.id));
    for (const segment of response.score_segments) {
      if (
        !counts.has(segment.bin_index) ||
        segment.display_upper <= segment.display_lower ||
        !classes.has(segment.score_color)
      )
        return false;
      counts.set(segment.bin_index, counts.get(segment.bin_index)! + segment.segment_count);
    }
    return response.bins.every((bin) => counts.get(bin.bin_index) === bin.count);
  }, "Histogram score segments differ from bins or score classes")
  .refine(
    (response) => new Set(response.bins.map((bin) => bin.bin_index)).size === response.bins.length,
    "Duplicate histogram bins",
  )
  .refine(
    (response) => !response.interaction_context || response.metric?.id === response.interaction_context.metric_id,
    "Missing or mismatched histogram metric",
  );
export type HistogramResponse = z.infer<typeof HistogramResponseSchema>;

export const OverviewMunicipalitySchema = z.object({
  ars: z.string().regex(/^\d{2,12}$/),
  name: z.string().min(1).max(300),
  prefix: z.string().max(200),
  slug: z
    .string()
    .min(1)
    .max(240)
    .regex(/^[a-z0-9_-]+$/),
  state_name: z.string().max(300),
  district_name: z.string().max(300).nullable(),
  value: z.number().nullable(),
  data_status: z.enum(["available", "no_data", "excluded"]),
});
export type OverviewMunicipality = z.infer<typeof OverviewMunicipalitySchema>;
export const OverviewMunicipalitiesSchema = z.object({
  snapshot_id: SnapshotIdSchema,
  count: z.number().int().nonnegative(),
  results: z.array(OverviewMunicipalitySchema).max(100),
  next_cursor: z.string().min(1).max(4096).nullable(),
});
export const OverviewRegionSchema = z.object({
  ars: z.string().regex(/^\d{2,12}$/),
  name: z.string().max(300),
  level: z.enum(["state", "district"]),
  parent_ars: z.string().nullable(),
  bounds,
});
export type OverviewRegion = z.infer<typeof OverviewRegionSchema>;
export const OverviewRegionsSchema = z.object({
  snapshot_id: SnapshotIdSchema,
  results: z.array(OverviewRegionSchema).max(1000),
});

export const MunicipalityOverviewSchema = z
  .object({
    contract_version: z.literal(1),
    collection: identifier,
    status: z.enum(["available", "no_data"]),
    snapshot_id: SnapshotIdSchema,
    metric_id: identifier,
    metrics: z.array(OverviewMetricSchema).min(1).max(100),
    scope: z.object({ ars: OverviewScopeSchema, name: z.string().max(300), state_ars: z.string().nullable() }),
    cohort: z.object({
      eligible_count: z.number().int().nonnegative(),
      included_count: z.number().int().nonnegative(),
      missing_count: z.number().int().nonnegative(),
      excluded_count: z.number().int().nonnegative(),
    }),
    stats: z.object({ median: z.number().nullable() }),
    map: z.object({
      tile_url: z.string().max(4096),
      bounds,
      minzoom: z.number().int().min(0).max(22),
      maxzoom: z.number().int().min(0).max(22),
      no_data_color: color,
    }),
    histogram: RenderElementSchema,
    links: z.object({ municipalities: z.string().max(4096), regions: z.string().max(4096) }),
    attribution: labels,
    update_info: z.object({
      last_updated_at: z.iso.datetime({ offset: true }).nullable(),
      verification_status: z.string().max(100),
      quality_label: labels.optional(),
    }),
  })
  .superRefine((context, ctx) => {
    if (!context.metrics.some((metric) => metric.id === context.metric_id))
      ctx.addIssue({ code: "custom", message: "Unknown selected metric" });
    if (new Set(context.metrics.map((metric) => metric.id)).size !== context.metrics.length)
      ctx.addIssue({ code: "custom", message: "Duplicate metrics" });
    if (
      context.histogram.type !== "histogram" ||
      context.histogram.interactions?.reveal_municipalities?.metric_id !== context.metric_id
    )
      ctx.addIssue({ code: "custom", message: "Mismatched histogram metric" });
    if (context.map.maxzoom < context.map.minzoom) ctx.addIssue({ code: "custom", message: "Invalid zoom range" });
  });
export type MunicipalityOverview = z.infer<typeof MunicipalityOverviewSchema>;

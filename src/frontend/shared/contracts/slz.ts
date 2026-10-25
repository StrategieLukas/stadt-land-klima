import { z } from "zod";
const labels = z.record(z.string(), z.string());
const localized = z.union([labels, z.string()]);
const mapLibre = z
  .object({
    renderer: z.string().optional(),
    version: z.number().optional(),
    style: z.record(z.string(), z.unknown()).optional(),
    sources: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
    layers: z.array(z.record(z.string(), z.unknown())).optional(),
    tooltip_fields: z
      .array(
        z.union([
          z.string(),
          z.object({ field: z.string().optional(), label: localized.optional(), title: localized.optional() }),
        ]),
      )
      .optional(),
    tooltipFields: z
      .array(
        z.union([
          z.string(),
          z.object({ field: z.string().optional(), label: localized.optional(), title: localized.optional() }),
        ]),
      )
      .optional(),
  })
  .loose();
export const RenderElementSchema = z
  .object({
    plot_id: z.string(),
    type: z.enum([
      "map",
      "kpi",
      "histogram",
      "bar_chart",
      "pie_chart",
      "time_series",
      "image",
      "table",
      "graph",
      "altair",
    ]),
    step: z.number().optional(),
    title: labels.optional(),
    description: labels.optional(),
    vegalite_spec: z.record(z.string(), z.unknown()).nullable().default(null),
    maplibre_spec: mapLibre.nullable().optional(),
    maplibreSpec: mapLibre.nullable().optional(),
    field: z.string().optional(),
    unit: labels.optional(),
    label: labels.optional(),
    population_normalized: z.boolean().optional(),
    is_percentage: z.boolean().optional(),
    thresholds: z.record(z.string(), z.number()).optional(),
    src_url: z.string().optional(),
    image_field: z.string().optional(),
  })
  .loose();
export const NarrativeStepSchema = z.object({
  index: z.number(),
  title: labels,
  description: labels,
  plot_ids: z.array(z.string()),
  layout: z.enum(["default", "full_width", "split", "kpi_map", "image_text"]),
});
const coverImage = z.object({
  type: z.string().optional(),
  asset_uuid: z.string().nullable().optional(),
  assetUuid: z.string().nullable().optional(),
  uuid: z.string().nullable().optional(),
  id: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
  src: z.string().nullable().optional(),
  href: z.string().nullable().optional(),
  attribution: localized.nullable().optional(),
  attribution_key: localized.nullable().optional(),
  attributionKey: localized.nullable().optional(),
});
const sourceAttribution = z.object({
  source: localized.nullable().optional(),
  role: localized.nullable().optional(),
  attribution: z.string().nullable().optional(),
  source_url: z.string().nullable().optional(),
  sourceUrl: z.string().nullable().optional(),
  license_name: z.string().nullable().optional(),
  licenseName: z.string().nullable().optional(),
  license_url: z.string().nullable().optional(),
  licenseUrl: z.string().nullable().optional(),
});
const temporalExtent = z.object({ start: z.string(), end: z.string().nullable(), resolution: z.string() });
const renderConfig = z
  .object({
    layer_type: z.string().optional(),
    color_field: z.string().optional(),
    threshold_bar: z.object({ thresholds: z.record(z.string(), z.number()).optional() }).optional(),
  })
  .loose();
export const CollectionSchema = z
  .object({
    id: z.string(),
    title: labels,
    description: labels,
    sector: z.string().nullable().default(null),
    render_elements: z.array(RenderElementSchema).optional(),
    narrative_steps: z.array(NarrativeStepSchema).optional(),
    narrativeSteps: z.array(NarrativeStepSchema).optional(),
    renderElements: z.array(RenderElementSchema).optional(),
    overview_visuals: z
      .array(
        z.object({
          plot_id: z.string(),
          type: z.enum(["municipality_map", "histogram"]),
          image_url: z.string(),
          title: labels.optional(),
          description: labels.optional(),
          alt: labels.optional(),
          attribution: localized.nullable().optional(),
        }),
      )
      .optional(),
    sector_label: localized.optional(),
    sectorLabel: localized.optional(),
    sector_display: z.string().optional(),
    sectorDisplay: z.string().optional(),
    cover_image_url: z.string().nullable().optional(),
    coverImageUrl: z.string().nullable().optional(),
    cover_image: coverImage.nullable().optional(),
    coverImage: coverImage.nullable().optional(),
    source_attributions: z.array(sourceAttribution).optional(),
    sourceAttributions: z.array(sourceAttribution).optional(),
    iconify_str: z.string().nullable().optional(),
    iconifyStr: z.string().nullable().optional(),
    tags: z.array(z.string()).optional(),
    temporal_extent: temporalExtent.nullable().optional(),
    temporalExtent: temporalExtent.nullable().optional(),
    render_config: renderConfig.optional(),
    renderConfig: renderConfig.optional(),
    hasNarrativeSteps: z.boolean().optional(),
  })
  .loose();
export const RenderResponseSchema = z
  .object({
    narrative_steps: z.array(NarrativeStepSchema).default([]),
    render_elements: z.array(RenderElementSchema).default([]),
  })
  .loose();

export type RenderElement = z.infer<typeof RenderElementSchema>;

export const SummarySchema = z
  .object({
    aggregate: z
      .object({
        id: z.number().optional(),
        total: z.number().optional(),
        sum: z.number().optional(),
        count: z.number().optional(),
        mean: z.number().optional(),
        avg: z.number().optional(),
        value: z.number().optional(),
        metadata: z
          .object({
            attribution: z.string().optional(),
            attribution_url: z.string().optional(),
            license_name: z.string().optional(),
            license_url: z.string().optional(),
            effective_date: z.string().optional(),
          })
          .optional(),
      })
      .loose(),
    source_attributions: z.array(sourceAttribution).optional(),
    sourceAttributions: z.array(sourceAttribution).optional(),
    area: z.string().optional(),
    area_population: z.number().nullable().optional(),
    areaPopulation: z.number().nullable().optional(),
    kpi_values: z
      .record(
        z.string(),
        z.object({
          value: z.number().nullable(),
          raw_value: z.number().nullable().optional(),
          precision: z.number().nullable().optional(),
        }),
      )
      .optional(),
    kpiValues: z
      .record(
        z.string(),
        z.object({
          value: z.number().nullable(),
          raw_value: z.number().nullable().optional(),
          precision: z.number().nullable().optional(),
        }),
      )
      .optional(),
  })
  .loose();
export const CollectionsResponseSchema = z.object({ collections: z.array(CollectionSchema) });
export const PipelineSchema = z
  .object({
    pipeline_steps: z
      .array(
        z
          .object({
            last_materialized: z.string().optional(),
            asset_key: z.string().optional(),
            order: z.number().optional(),
            name: z.string().optional(),
            description: z.string().optional(),
          })
          .loose(),
      )
      .default([]),
  })
  .loose();

export const ImagePayloadSchema = z.object({
  content_type: z.enum(["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"]).default("image/png"),
  encoding: z.literal("base64").optional(),
  data: z
    .string()
    .max(32 * 1024 * 1024)
    .transform((value) => value.replace(/\s/g, ""))
    .pipe(
      z
        .string()
        .min(1)
        .regex(/^[a-z0-9+/]*={0,2}$/i),
    ),
});

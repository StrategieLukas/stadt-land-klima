import { z } from "zod";
const labels = z.record(z.string(), z.string());
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
    maplibre_spec: z.record(z.string(), z.unknown()).nullable().optional(),
    maplibreSpec: z.record(z.string(), z.unknown()).nullable().optional(),
  })
  .loose();
export const NarrativeStepSchema = z.object({
  index: z.number(),
  title: labels,
  description: labels,
  plot_ids: z.array(z.string()),
  layout: z.enum(["default", "full_width", "split", "kpi_map", "image_text"]),
});
export const CollectionSchema = z
  .object({
    id: z.string(),
    title: labels,
    description: labels,
    sector: z.string().nullable().default(null),
    render_elements: z.array(RenderElementSchema).optional(),
    narrative_steps: z.array(NarrativeStepSchema).optional(),
  })
  .loose();
export const RenderResponseSchema = z
  .object({
    narrative_steps: z.array(NarrativeStepSchema).default([]),
    render_elements: z.array(RenderElementSchema).default([]),
  })
  .loose();

export type RenderElement = z.infer<typeof RenderElementSchema>;

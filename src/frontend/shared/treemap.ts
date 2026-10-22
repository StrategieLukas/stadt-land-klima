import { z } from "zod";
const item = z.object({
  sector: z.string(),
  sectorName: z.string(),
  measure_id: z.string(),
  measure_name: z.string(),
  value: z.number(),
  rating: z.number().optional(),
  weight: z.number().optional(),
  slug: z.string().optional(),
});
export type TreemapItem = z.infer<typeof item>;
const datum = z.object({ _data: z.object({ sectorName: z.string().optional(), children: z.array(item).default([]) }) });
/** Treemap uses an untyped internal grouping payload. Check it before callbacks read it. */
export function treemapDatum(input: unknown): { sectorName?: string; children: TreemapItem[] } {
  const result = datum.safeParse(input);
  return result.success ? result.data._data : { children: [] };
}

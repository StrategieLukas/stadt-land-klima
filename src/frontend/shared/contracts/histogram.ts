import { z } from "zod";

export const HistogramSchema = z
  .object({
    id: z.union([z.string(), z.number()]).nullish(),
    bin_edges: z.array(z.number()),
    bin_counts: z.array(z.number().nonnegative()),
  })
  .refine(
    (data) =>
      data.bin_edges.length === data.bin_counts.length + 1 &&
      data.bin_counts.length > 0 &&
      data.bin_edges.every((edge, i, edges) => i === 0 || edge > edges[i - 1]!),
    "Invalid histogram bins",
  );
export type Histogram = z.infer<typeof HistogramSchema>;
export const HistogramResponseSchema = z.object({ results: z.array(HistogramSchema) });
export const BinAreasSchema = z
  .object({
    areas: z.array(
      z
        .object({
          ars: z.string(),
          name: z.string(),
          prefix: z.string().optional(),
          value: z.number().nullable(),
        })
        .loose(),
    ),
    bin_range: z.object({ start: z.number(), end: z.number() }).optional(),
    count: z.number().optional(),
  })
  .loose();
export type BinAreas = z.infer<typeof BinAreasSchema>;
export type HistogramMunicipality = BinAreas["areas"][number];
export interface HistogramBin {
  min: number;
  max: number;
  count: number;
  municipalities: HistogramMunicipality[];
  isExtreme: boolean;
  extremeType?: string;
}
/** Values in the legacy GraphQL area response are dynamic product fields. */
export function legacyHistogramValue(area: unknown, product: string, attribute: string): number | null {
  if (!area || typeof area !== "object" || !(product in area)) return null;
  const data: unknown = (area as Record<string, unknown>)[product];
  if (!data || typeof data !== "object") return null;
  const value = (data as Record<string, unknown>)[attribute];
  if (value == null || (typeof value !== "number" && typeof value !== "string")) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

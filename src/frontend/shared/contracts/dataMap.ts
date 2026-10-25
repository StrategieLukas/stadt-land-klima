import { z } from "zod";
const coordinate = z.tuple([z.number(), z.number()]);
const power = z
  .union([z.number(), z.string()])
  .nullish()
  .transform((value) => (value == null ? undefined : Number(value)))
  .refine((value) => value === undefined || Number.isFinite(value));
const marker = z.object({
  coordinates: coordinate,
  properties: z.object({ power_kw: power, popup_content: z.string().nullish() }).loose().nullish(),
});
const metadata = { name: z.string(), style: z.object({ marker_color: z.string().nullish() }).nullish() };
/** Only marker layers are rendered here; other layer metadata still appears in the legend. */
export const DataMapSchema = z.object({
  center: coordinate.nullish(),
  bounds: z.tuple([coordinate, coordinate]).nullish(),
  layers: z.array(
    z.union([
      z.object({
        ...metadata,
        type: z.literal("markers"),
        data: z
          .array(marker)
          .nullish()
          .transform((data) => data ?? []),
      }),
      z
        .object({ ...metadata, type: z.string().refine((type) => type !== "markers"), data: z.unknown().optional() })
        .transform((layer) => ({ ...layer, data: [] as z.infer<typeof marker>[] })),
    ]),
  ),
});

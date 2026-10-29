import { z } from "zod";
import { NumericSchema } from "./municipality";
export const MunicipalityUpdateSchema = z.object({
  id: z.uuid(),
  occurred_at: z.iso.datetime({ offset: true }),
  kind: z.enum(["initial", "published", "update"]),
  score_total: NumericSchema,
  previous_total: NumericSchema,
  municipality: z.object({ name: z.string(), slug: z.string() }),
  catalog: z.string(),
});
export const MunicipalityUpdatesSchema = z.object({
  updates: z.array(MunicipalityUpdateSchema),
  nextCursor: z.string().nullable(),
});
export type MunicipalityUpdates = z.output<typeof MunicipalityUpdatesSchema>;

import { z } from "zod";
import { MunicipalityOverviewSchema, OverviewMunicipalitySchema } from "./municipalityOverview";

export const RegionMunicipalitiesResponseSchema = z.object({
  context: MunicipalityOverviewSchema,
  municipalities: z.array(OverviewMunicipalitySchema).max(15000),
  bounds: MunicipalityOverviewSchema.shape.map.shape.bounds,
});

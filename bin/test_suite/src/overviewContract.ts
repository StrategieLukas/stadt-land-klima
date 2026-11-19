import { mkdirSync, writeFileSync } from "node:fs";
import { z } from "../../../src/frontend/node_modules/zod/index.js";
import {
  HistogramResponseSchema,
  MunicipalityOverviewSchema,
  OverviewMunicipalitiesSchema,
  OverviewRegionsSchema,
} from "../../../src/frontend/shared/contracts/municipalityOverview.js";
import { histogramFixture, overviewFixture } from "./fixtures/municipalityOverview.js";

export function overviewContract() {
  return {
    contract_version: 1,
    schemas: Object.fromEntries(
      Object.entries({
        overview: MunicipalityOverviewSchema,
        histogram: HistogramResponseSchema,
        municipalities: OverviewMunicipalitiesSchema,
        regions: OverviewRegionsSchema,
      }).map(([key, schema]) => [key, z.toJSONSchema(schema, { io: "input" })]),
    ),
    examples: { overview: overviewFixture, histogram: histogramFixture },
  };
}
if (process.argv.includes("--write")) {
  const directory = new URL("../../../docs/contracts/", import.meta.url);
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    new URL("municipality-overview.v1.json", directory),
    JSON.stringify(overviewContract(), null, 2) + "\n",
  );
}

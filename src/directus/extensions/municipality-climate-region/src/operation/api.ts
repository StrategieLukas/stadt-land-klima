import type { Knex } from 'knex';
import {
  resolveMissingMunicipalityData,
  type ResolverLogger,
  type ResolutionSummary,
} from '../resolver.js';

interface OperationRuntime {
  database: Knex;
  env: Record<string, unknown>;
  logger: ResolverLogger;
}

export default {
  id: 'operation-resolve-municipality-climate-regions',
  handler: async (_options: Record<string, never>, runtime: OperationRuntime): Promise<ResolutionSummary> => {
    return await resolveMissingMunicipalityData(runtime);
  },
};

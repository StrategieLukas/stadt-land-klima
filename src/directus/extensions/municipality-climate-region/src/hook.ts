import { defineHook } from '@directus/extensions-sdk';
import type { Knex } from 'knex';
import {
  resolveMissingMunicipalityData,
  resolveMunicipalityById,
  type ResolverLogger,
} from './resolver.js';

const DAILY_RESOLUTION_CRON = '0 3 * * *';

interface ActionMeta {
  collection?: string;
  key?: string | number;
  keys?: Array<string | number>;
  payload?: Record<string, unknown>;
}

interface HookRuntime {
  database: Knex;
  env: Record<string, unknown>;
  logger: ResolverLogger;
}

function municipalityIds(meta: ActionMeta): Array<string | number> {
  if (meta.key !== undefined) return [meta.key];
  return meta.keys ?? [];
}

export default defineHook(({ action, schedule }, runtime) => {
  const context = runtime as unknown as HookRuntime;

  action('items.create', async (meta: ActionMeta) => {
    if (meta.collection !== 'municipalities') return;

    for (const municipalityId of municipalityIds(meta)) {
      try {
        await resolveMunicipalityById(municipalityId, context);
      } catch (error) {
        context.logger.warn(`[municipality-climate-region] Create lookup failed for municipality ${municipalityId}: ${String(error)}`);
      }
    }
  });

  action('items.update', async (meta: ActionMeta) => {
    if (meta.collection !== 'municipalities') return;
    if (meta.payload && !('ars' in meta.payload) && !('name' in meta.payload)) return;

    for (const municipalityId of municipalityIds(meta)) {
      try {
        await resolveMunicipalityById(municipalityId, context);
      } catch (error) {
        context.logger.warn(`[municipality-climate-region] Update lookup failed for municipality ${municipalityId}: ${String(error)}`);
      }
    }
  });

  schedule(DAILY_RESOLUTION_CRON, async () => {
    try {
      await resolveMissingMunicipalityData(context);
    } catch (error) {
      context.logger.error(`[municipality-climate-region] Scheduled resolution failed: ${String(error)}`);
    }
  });
});

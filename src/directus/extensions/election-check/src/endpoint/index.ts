import generateQuestions from '../generate-questions/api.js';
import sendCandidateMails from '../send-candidate-mails/api.js';
import type { Router, Services, GetSchema, Logger, Accountability } from '@directus/extensions-sdk';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ActionContext {
  services: Services;
  getSchema: GetSchema;
  logger: Logger;
}

// ---------------------------------------------------------------------------
// Helper: builds a consistent action route handler
// ---------------------------------------------------------------------------

function makeActionHandler<TResult>(
  name: string,
  run: (electionId: string | number, ctx: ActionContext & { accountability: Accountability }) => Promise<TResult>,
  ctx: ActionContext,
) {
  return async (req: any, res: any) => {
    const { election_id } = req.body as { election_id?: string | number };

    if (!election_id) {
      return res.status(400).json({ error: 'Missing required field: election_id' });
    }

    const schema = await ctx.getSchema();

    try {
      const result = await run(election_id, {
        ...ctx,
        accountability: req.accountability,
        getSchema: async () => schema,
      });
      return res.json(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      ctx.logger.error(`[election-actions] ${name} failed for election ${election_id}: ${message}`);
      return res.status(500).json({ error: message });
    }
  };
}

// ---------------------------------------------------------------------------
// Extension definition
// ---------------------------------------------------------------------------

export default {
  id: 'election-actions',
  handler: (
    router: Router,
    ctx: ActionContext,
  ) => {
    router.post(
      '/generate',
      makeActionHandler('generate', (election_id, { accountability, services, getSchema, logger }) =>
          generateQuestions.handler(
            { election_id },
            { logger, accountability, services, getSchema, data: {} },
          ),
        ctx,
      ),
    );

    router.post(
      '/send-mails',
      makeActionHandler('send-mails', (election_id, { accountability, services, getSchema, logger }) =>
          sendCandidateMails.handler(
            { election_id },
            { logger, accountability, services, getSchema, data: {} },
          ),
        ctx,
      ),
    );
  },
};

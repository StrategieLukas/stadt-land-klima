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
  env: Record<string, string | undefined>;
}

interface ElectionForReview {
  already_generated_questions?: boolean | null;
  descriptor?: string | null;
  review_requested?: boolean | null;
  localteam?: {
    id?: string | number | null;
    municipality_name?: string | null;
  } | string | number | null;
}

interface RequestReviewResult {
  success: boolean;
  alreadyRequested: boolean;
  emailSent: boolean;
  election_id: string | number;
  updated_data?: Record<string, unknown>;
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
      const userElectionSvc = new ctx.services.ItemsService('elections', {
        schema,
        accountability: req.accountability,
      });
      await userElectionSvc.readOne(election_id, { fields: ['id'] });

      const result = await run(election_id, {
        ...ctx,
        accountability: req.accountability,
        getSchema: async () => schema,
      });
      return res.json(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      ctx.logger.error(`[election-actions] ${name} failed for election ${election_id}: ${message}`);
      const status = typeof (err as { status?: unknown })?.status === 'number'
        ? (err as { status: number }).status
        : 500;
      return res.status(status).json({ error: message });
    }
  };
}

async function requestReview(
  electionId: string | number,
  { accountability, services, getSchema, logger, env }: ActionContext & { accountability: Accountability },
): Promise<RequestReviewResult> {
  const schema = await getSchema();
  const sysAcc = { ...accountability, admin: true };
  const { ItemsService, MailService } = services;

  const electionSvc = new ItemsService('elections', { schema, accountability: sysAcc });
  const mailSvc = new MailService({ schema, accountability: sysAcc });

  const election = await electionSvc.readOne(electionId, {
    fields: [
      'already_generated_questions',
      'descriptor',
      'review_requested',
      'localteam.id',
      'localteam.municipality_name',
    ],
  }) as ElectionForReview | null;

  if (!election) {
    throw new Error(`Election with ID "${electionId}" not found.`);
  }

  if (!election.already_generated_questions) {
    throw new Error('Thesen muessen vor der Review-Anfrage generiert werden.');
  }

  if (election.review_requested) {
    return {
      success: true,
      alreadyRequested: true,
      emailSent: false,
      election_id: electionId,
      updated_data: { review_requested: true },
    };
  }

  const recipient = env.WAHLCHECK_EMAIL || 'info@stadt-land-klima.de';
  const localteamName = typeof election.localteam === 'object' && election.localteam !== null
    ? election.localteam.municipality_name
    : null;
  const electionLabel = election.descriptor || String(electionId);
  const adminUrl = env.PUBLIC_URL
    ? `${env.PUBLIC_URL.replace(/\/$/, '')}/admin/content/elections/${electionId}`
    : null;

  await electionSvc.updateOne(electionId, { review_requested: true });

  let emailSent = true;

  try {
    await mailSvc.send({
      to: recipient,
      subject: `Review der Wahlcheck-Thesen angefragt: ${electionLabel}`,
      text: [
        'Ein Lokalteam hat Review fuer die Wahlcheck-Thesen angefragt.',
        '',
        `Wahl: ${electionLabel}`,
        `Lokalteam: ${localteamName ?? 'unbekannt'}`,
        `Election ID: ${electionId}`,
        adminUrl ? `Directus: ${adminUrl}` : null,
      ].filter(Boolean).join('\n'),
    });
  } catch (err) {
    if (env.SLK_ENV === 'development') {
      emailSent = false;
      logger.warn(
        `[request-review] Failed to send review request email in development: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    } else {
      await electionSvc.updateOne(electionId, { review_requested: false });
      throw err;
    }
  }

  const updatedElection = await electionSvc.readOne(electionId, {
    fields: ['review_requested'],
  }) as Record<string, unknown>;

  logger.info(`[request-review] Review requested for election ${electionId}; recipient: ${recipient}`);

  return {
    success: true,
    alreadyRequested: false,
    emailSent,
    election_id: electionId,
    updated_data: updatedElection,
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

    router.post(
      '/request-review',
      makeActionHandler('request-review', requestReview, ctx),
    );
  },
};

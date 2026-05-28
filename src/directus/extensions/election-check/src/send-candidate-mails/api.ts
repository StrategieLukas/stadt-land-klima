import crypto from 'node:crypto';
import type { Logger, Accountability, Services, GetSchema } from '@directus/extensions-sdk';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HandlerContext {
  logger: Logger;
  accountability: Accountability;
  services: Services;
  getSchema: GetSchema;
  data: Record<string, unknown>;
}

interface Election {
  id: string | number;
  descriptor?: string;
  response_cutoff_date?: string | null;
  already_generated_questions?: boolean;
  already_sent_mails?: boolean;
  localteam?: { municipality_name?: string } | null;
}

interface Candidate {
  id: string | number;
  name?: string;
  email: string;
  access_token?: string | null;
}

interface SendResult {
  success: boolean;
  sentCount: number;
  failedCount: number;
  totalCandidates: number;
  errors: string[];
  election_id: string | number;
  updated_data?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_URL = 'https://stadt-land-klima.de';
const MIN_QUESTIONS = 10;
const MIN_CANDIDATES = 2;

function formatCutoffDate(isoDate: string): string {
  const d = new Date(isoDate);
  d.setHours(23, 59, 0, 0);
  return d.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Ensures every candidate has a stable access token, persisting any newly
 * generated ones in bulk before any mail is sent. This way, if the send loop
 * is interrupted, candidates already have tokens and a re-run won't generate
 * new ones.
 */
async function ensureAccessTokens(
  candidates: Candidate[],
  candidateSvc: InstanceType<Services['ItemsService']>,
  logger: Logger,
): Promise<Candidate[]> {
  const needsToken = candidates.filter((c) => !c.access_token);

  if (needsToken.length > 0) {
    logger.info(
      `[send-candidate-mails] Generating tokens for ${needsToken.length} candidate(s)`,
    );

    await Promise.all(
      needsToken.map(async (c) => {
        const token = crypto.randomBytes(32).toString('hex');
        await candidateSvc.updateOne(c.id, { access_token: token });
        c.access_token = token; // mutate in-place so the send loop sees it
      }),
    );
  }

  return candidates;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export default {
  id: 'operation-send-candidate-mails',
  handler: async (
    { election_id }: { election_id: string | number },
    { logger, accountability, services, getSchema }: HandlerContext,
  ): Promise<SendResult> => {
    const schema = await getSchema();
    const sysAcc = { ...accountability, admin: true };
    const { ItemsService, MailService } = services;

    const electionSvc = new ItemsService('elections', { schema, accountability: sysAcc });
    const candidateSvc = new ItemsService('candidate', { schema, accountability: sysAcc });
    const questionsSvc = new ItemsService('questions', { schema, accountability: sysAcc });
    const mailSvc = new MailService({ schema, accountability: sysAcc });

    // -----------------------------------------------------------------------
    // 1. Load election
    // -----------------------------------------------------------------------

    const election = await electionSvc.readOne(election_id, {
      fields: ['*', 'localteam.*'],
    }) as Election | null;

    if (!election) {
      throw new Error(`Election with ID "${election_id}" not found.`);
    }

    const municipalityName = election.localteam?.municipality_name;
    logger.info(
      `[send-candidate-mails] Starting for election "${election.descriptor ?? election_id}", municipality: "${municipalityName ?? 'unknown'}"`,
    );

    // -----------------------------------------------------------------------
    // 2. Pre-flight checks
    // -----------------------------------------------------------------------

    if (!election.response_cutoff_date) {
      throw new Error(
        'Please set a response cutoff date (response_cutoff_date) on the election before sending invitations.',
      );
    }

    const [questions, candidates] = await Promise.all([
      questionsSvc.readByQuery({
        filter: { election: { _eq: election_id }, status: { _eq: 'published' } },
        fields: ['id'],
        limit: -1,
      }) as Promise<Array<{ id: string | number }>>,
      candidateSvc.readByQuery({
        filter: { election: { _eq: election_id }, email: { _nnull: true } },
        fields: ['id', 'name', 'email', 'access_token'],
        limit: -1,
      }) as Promise<Candidate[]>,
    ]);

    if (questions.length < MIN_QUESTIONS) {
      throw new Error(
        `Only ${questions.length} published question(s) found; at least ${MIN_QUESTIONS} are required.`,
      );
    }

    if (candidates.length < MIN_CANDIDATES) {
      throw new Error(
        `Only ${candidates.length} candidate(s) with an email address found; at least ${MIN_CANDIDATES} are required.`,
      );
    }

    logger.info(
      `[send-candidate-mails] Pre-flight passed: ${questions.length} questions, ${candidates.length} candidates`,
    );

    // -----------------------------------------------------------------------
    // 3. Ensure all candidates have stable access tokens
    // -----------------------------------------------------------------------

    const cutoffFormatted = formatCutoffDate(election.response_cutoff_date);
    const withTokens = await ensureAccessTokens(candidates, candidateSvc, logger);

    // -----------------------------------------------------------------------
    // 4. Send mails
    // -----------------------------------------------------------------------

    let sentCount = 0;
    const errors: string[] = [];

    for (const candidate of withTokens) {
      const personalLink = `${BASE_URL}/elections/thesen/${candidate.access_token}`;

      try {
        await mailSvc.send({
          to: candidate.email,
          subject: `Einladung zum Klimawahl-Check: ${municipalityName ?? ''}`.trimEnd(),
          template: {
            name: 'email-template-candidate',
            data: {
              candidate_name: candidate.name ?? '',
              municipality_name: municipalityName ?? '',
              cutoff_date: cutoffFormatted,
              personal_link: personalLink,
              projectName: 'Klimawahlcheck',
              projectColor: '#1da64a',
              projectUrl: BASE_URL,
            },
          },
        });

        sentCount++;
        logger.info(`[send-candidate-mails] Sent to ${candidate.email}`);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        const detail = `Failed to send to ${candidate.email}: ${message}`;
        logger.error(`[send-candidate-mails] ${detail}`);
        errors.push(detail);
      }
    }

    // -----------------------------------------------------------------------
    // 5. Persist result
    // -----------------------------------------------------------------------

    // Only mark as sent if at least one mail was delivered successfully.
    if (sentCount > 0) {
      await electionSvc.updateOne(election_id, { already_sent_mails: true });
    } else {
      logger.warn(
        `[send-candidate-mails] All ${candidates.length} sends failed; not marking already_sent_mails.`,
      );
    }

    const updatedElection = await electionSvc.readOne(election_id, {
      fields: ['already_generated_questions', 'already_sent_mails'],
    }) as Record<string, unknown>;

    logger.info(
      `[send-candidate-mails] Finished: ${sentCount} sent, ${errors.length} failed`,
    );

    return {
      success: errors.length === 0,
      sentCount,
      failedCount: errors.length,
      totalCandidates: candidates.length,
      errors,
      election_id,
      updated_data: updatedElection,
    };
  },
};

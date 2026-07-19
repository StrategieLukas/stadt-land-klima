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
  candidate_email_cc?: string | null;
  candidate_email_reply_to?: string | null;
  already_generated_questions?: boolean;
  already_sent_mails?: boolean;
  localteam?: { municipality_name?: string } | null;
}

interface Candidate {
  id: string | number;
  name?: string | null;
  email?: string | null;
  access_token?: string | null;
}

interface SendableCandidate extends Candidate {
  email: string;
}

interface CandidateMailSummary {
  id: string | number;
  name: string;
  email: string | null;
  message?: string;
}

interface SendResult {
  success: boolean;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  totalCandidates: number;
  errors: string[];
  sent: CandidateMailSummary[];
  failed: CandidateMailSummary[];
  skipped: CandidateMailSummary[];
  election_id: string | number;
  updated_data?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_URL = 'https://stadt-land-klima.de';
const MIN_QUESTIONS = 7;
const MIN_CANDIDATES = 2;
const ALWAYS_CC = 'info@stadt-land-klima.de';
const EMAIL_PATTERN = /^[A-Za-z0-9_!#$%&'*+\/=?`{|}~^.-]+@[A-Za-z0-9.-]+$/;
const HEALTH4FUTURE_ELECTION_NAME = 'Gesundheitswahlcheck';
const DEFAULT_CANDIDATE_EMAIL_TEMPLATE = 'email-template-candidate';
const HEALTH4FUTURE_CANDIDATE_EMAIL_TEMPLATE = 'email-template-candidate-health4future';

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

function splitEmailAddresses(value?: string | null): string[] {
  if (!value) return [];

  return value
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniqueEmailAddresses(addresses: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const address of addresses) {
    const key = address.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    unique.push(address);
  }

  return unique;
}

function normalizeEmail(value?: string | null): string | null {
  const email = value?.trim() ?? '';
  return email.length > 0 ? email : null;
}

function candidateDisplayName(candidate: Candidate): string {
  return candidate.name?.trim() || `Kandidat:in ${candidate.id}`;
}

function summarizeCandidate(
  candidate: Candidate,
  message?: string,
): CandidateMailSummary {
  return {
    id: candidate.id,
    name: candidateDisplayName(candidate),
    email: normalizeEmail(candidate.email),
    ...(message ? { message } : {}),
  };
}

function formatFailure(summary: CandidateMailSummary): string {
  const recipient = summary.email
    ? `${summary.name} <${summary.email}>`
    : summary.name;

  return `${recipient}: ${summary.message ?? 'Unbekannter Fehler'}`;
}

/**
 * Ensures every candidate has a stable access token, persisting any newly
 * generated ones in bulk before any mail is sent. This way, if the send loop
 * is interrupted, candidates already have tokens and a re-run won't generate
 * new ones.
 */
async function ensureAccessTokens(
  candidates: SendableCandidate[],
  candidateSvc: InstanceType<Services['ItemsService']>,
  logger: Logger,
): Promise<SendableCandidate[]> {
  const needsToken = candidates.filter((c) => !c.access_token);

  if (needsToken.length > 0) {
    logger.info(
      `[send-candidate-mails] Generating tokens for ${needsToken.length} candidate(s)`,
    );

    await Promise.all(
      needsToken.map(async (c) => {
        const token = crypto.randomUUID();
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
        filter: { election: { _eq: election_id } },
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
        `Only ${candidates.length} candidate(s) found; at least ${MIN_CANDIDATES} are required.`,
      );
    }

    const sent: CandidateMailSummary[] = [];
    const failed: CandidateMailSummary[] = [];
    const skipped: CandidateMailSummary[] = [];
    const sendableCandidates: SendableCandidate[] = [];

    for (const candidate of candidates) {
      const email = normalizeEmail(candidate.email);

      if (!email) {
        skipped.push(summarizeCandidate(candidate, 'Keine E-Mail-Adresse hinterlegt.'));
        continue;
      }

      if (!EMAIL_PATTERN.test(email)) {
        failed.push(summarizeCandidate(
          { ...candidate, email },
          'Ungültige E-Mail-Adresse.',
        ));
        continue;
      }

      sendableCandidates.push({ ...candidate, email });
    }

    logger.info(
      `[send-candidate-mails] Pre-flight passed: ${questions.length} questions, ${candidates.length} candidates, ${sendableCandidates.length} sendable, ${skipped.length} skipped`,
    );

    // -----------------------------------------------------------------------
    // 3. Ensure all candidates have stable access tokens
    // -----------------------------------------------------------------------

    const cutoffFormatted = formatCutoffDate(election.response_cutoff_date);
    const withTokens = await ensureAccessTokens(sendableCandidates, candidateSvc, logger);
    const ccRecipients = uniqueEmailAddresses([
      ALWAYS_CC,
      ...splitEmailAddresses(election.candidate_email_cc),
    ]);
    const replyTo = splitEmailAddresses(election.candidate_email_reply_to)[0];
    const candidateEmailTemplate = election.descriptor === HEALTH4FUTURE_ELECTION_NAME
      ? HEALTH4FUTURE_CANDIDATE_EMAIL_TEMPLATE
      : DEFAULT_CANDIDATE_EMAIL_TEMPLATE;

    // -----------------------------------------------------------------------
    // 4. Send mails
    // -----------------------------------------------------------------------

    for (const candidate of withTokens) {
      const personalLink = `${BASE_URL}/elections/thesen/${candidate.access_token}`;

      try {
        await mailSvc.send({
          to: candidate.email,
          cc: ccRecipients,
          ...(replyTo ? { replyTo } : {}),
          subject: `Einladung zum Klimawahl-Check: ${municipalityName ?? ''}`.trimEnd(),
          template: {
            name: candidateEmailTemplate,
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

        sent.push(summarizeCandidate(candidate));
        logger.info(`[send-candidate-mails] Sent to ${candidate.email}`);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        const failedCandidate = summarizeCandidate(candidate, message);
        const detail = `Failed to send to ${candidate.email}: ${message}`;
        logger.error(`[send-candidate-mails] ${detail}`);
        failed.push(failedCandidate);
      }
    }

    // -----------------------------------------------------------------------
    // 5. Persist result
    // -----------------------------------------------------------------------

    // Only mark as sent if at least one mail was delivered successfully.
    if (sent.length > 0) {
      await electionSvc.updateOne(election_id, { already_sent_mails: true });
    } else {
      logger.warn(
        '[send-candidate-mails] No mails were delivered; not marking already_sent_mails.',
      );
    }

    const updatedElection = await electionSvc.readOne(election_id, {
      fields: ['already_generated_questions', 'already_sent_mails'],
    }) as Record<string, unknown>;

    const errors = failed.map(formatFailure);

    logger.info(
      `[send-candidate-mails] Finished: ${sent.length} sent, ${failed.length} failed, ${skipped.length} skipped`,
    );

    return {
      success: failed.length === 0 && sent.length > 0,
      sentCount: sent.length,
      failedCount: failed.length,
      skippedCount: skipped.length,
      totalCandidates: candidates.length,
      errors,
      sent,
      failed,
      skipped,
      election_id,
      updated_data: updatedElection,
    };
  },
};

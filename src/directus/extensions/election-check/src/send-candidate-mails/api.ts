import crypto from 'node:crypto';
import type { Logger, Accountability, Services, GetSchema } from '@directus/extensions-sdk';
import { HtmlValidate } from 'html-validate';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HandlerContext {
  logger: Logger;
  accountability: Accountability;
  services: Services;
  getSchema: GetSchema;
  env: Record<string, string | undefined>;
  data: Record<string, unknown>;
}

interface HandlerInput {
  election_id: string | number;
  test_mode?: boolean;
  mail_type?: CandidateMailType;
}

type CandidateMailType = 'invitation' | 'reminder' | 'thank_you';

interface Election {
  id: string | number;
  descriptor?: string;
  response_cutoff_date?: string | null;
  candidate_email_cc?: string | null;
  candidate_email_subject?: string | null;
  candidate_email_template?: string | null;
  candidate_reminder_email_subject?: string | null;
  candidate_reminder_email_template?: string | null;
  candidate_thank_you_email_subject?: string | null;
  candidate_thank_you_email_template?: string | null;
  candidate_email_reply_to?: string | null;
  custom_logo?: string | { id?: string | null } | null;
  already_generated_questions?: boolean;
  already_sent_mails?: boolean;
  already_sent_reminder_mails?: boolean;
  already_sent_thank_you_mails?: boolean;
  localteam?: { municipality_name?: string } | null;
}

interface Candidate {
  id: string | number;
  name?: string | null;
  salutation?: 'frau' | 'herr' | 'neutral' | null;
  email?: string | null;
  access_token?: string | null;
  has_answered?: boolean | null;
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
  testMode: boolean;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  totalCandidates: number;
  eligibleCandidates: number;
  mailType: CandidateMailType;
  errors: string[];
  sent: CandidateMailSummary[];
  failed: CandidateMailSummary[];
  skipped: CandidateMailSummary[];
  election_id: string | number;
  testRecipient?: string;
  selectedCandidate?: CandidateMailSummary;
  updated_data?: Record<string, unknown>;
}

interface MailConfiguration {
  subject: string;
  template: string;
  sentFlag: 'already_sent_mails' | 'already_sent_reminder_mails' | 'already_sent_thank_you_mails';
  emptyRecipientsMessage: string;
  label: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MIN_QUESTIONS = 7;
const MIN_CANDIDATES = 2;
const ALWAYS_CC = 'info@stadt-land-klima.de';
const EMAIL_PATTERN = /^[A-Za-z0-9_!#$%&'*+\/=?`{|}~^.-]+@[A-Za-z0-9.-]+$/;
const STADT_LAND_KLIMA_LOGO_CONTENT_ID = 'stadt-land-klima-logo@stadt-land-klima.de';
// PNG rendition of frontend/assets/images/Stadt-Land-Klima-Logo.svg. Keeping it
// in the bundle makes the inline logo independent of a deployment's file IDs.
const STADT_LAND_KLIMA_LOGO_PNG_BASE64 = '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';
const CUSTOM_LOGO_CONTENT_ID = 'wahlcheck-logo@stadt-land-klima.de';
const HTML_PLACEHOLDER_PATTERN = /\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g;
const RAW_HTML_PLACEHOLDERS = new Set(['stadt_land_klima_logo', 'custom_logo']);
const SUBJECT_PLACEHOLDERS = new Set([
  'candidate_name',
  'candidate_salutation',
  'municipality_name',
  'election_descriptor',
  'cutoff_date',
  'personal_link',
  'projectName',
]);
const htmlValidator = new HtmlValidate({
  rules: {
    'close-order': 'error',
    'no-dup-attr': 'error',
  },
});
const LAST_NAME_PARTICLES = new Set([
  'da', 'das', 'de', 'del', 'della', 'den', 'der', 'di', 'dos', 'du', 'la', 'le',
  'ten', 'ter', 'van', 'von', 'zu', 'zum', 'zur',
]);

function formatCutoffDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return isoDate;

  // The stored value is a calendar date; the deadline is its Berlin end of day.
  return `${match[3]}.${match[2]}.${match[1]}, 23:59`;
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

function uniqueValues(values: string[]): string[] {
  return [...new Set(values)];
}

function normalizeEmail(value?: string | null): string | null {
  const email = value?.trim() ?? '';
  return email.length > 0 ? email : null;
}

function getMailConfiguration(
  election: Election,
  mailType: CandidateMailType,
): MailConfiguration {
  if (mailType === 'reminder') {
    return {
      subject: election.candidate_reminder_email_subject?.trim() ?? '',
      template: election.candidate_reminder_email_template?.trim() ?? '',
      sentFlag: 'already_sent_reminder_mails',
      emptyRecipientsMessage: 'Alle Kandidat:innen haben bereits Antworten eingereicht.',
      label: 'Reminder-E-Mail',
    };
  }

  if (mailType === 'thank_you') {
    return {
      subject: election.candidate_thank_you_email_subject?.trim() ?? '',
      template: election.candidate_thank_you_email_template?.trim() ?? '',
      sentFlag: 'already_sent_thank_you_mails',
      emptyRecipientsMessage: 'Noch keine Kandidat:innen haben Antworten eingereicht.',
      label: 'Dankes-E-Mail',
    };
  }

  return {
    subject: election.candidate_email_subject?.trim() ?? '',
    template: election.candidate_email_template?.trim() ?? '',
    sentFlag: 'already_sent_mails',
    emptyRecipientsMessage: 'Für diese Wahl sind keine Kandidat:innen vorhanden.',
    label: 'Einladungs-E-Mail',
  };
}

function isEligibleCandidate(candidate: Candidate, mailType: CandidateMailType): boolean {
  if (mailType === 'reminder') return candidate.has_answered !== true;
  if (mailType === 'thank_you') return candidate.has_answered === true;
  return true;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]!);
}

function renderTemplate(
  template: string,
  variables: Record<string, string>,
): string {
  return template.replace(HTML_PLACEHOLDER_PATTERN, (placeholder, name: string) => {
    const value = variables[name];
    if (value === undefined) return placeholder;

    return RAW_HTML_PLACEHOLDERS.has(name) ? value : escapeHtml(value);
  });
}

function renderSubject(
  template: string,
  variables: Record<string, string>,
): string {
  return template.replace(HTML_PLACEHOLDER_PATTERN, (placeholder, name: string) => {
    const value = variables[name];
    return value === undefined ? placeholder : value.replace(/[\r\n]+/g, ' ');
  });
}

function unresolvedPlaceholders(value: string): string[] {
  return [...value.matchAll(HTML_PLACEHOLDER_PATTERN)].map((match) => match[1]!);
}

function placeholderNames(value: string): string[] {
  return uniqueValues(unresolvedPlaceholders(value));
}

function usesPlaceholder(template: string, name: string): boolean {
  return new RegExp(`\\{\\{\\s*${name}\\s*\\}\\}`).test(template);
}

function logoCell(contentId: string, alt: string): string {
  return `<td align="center" valign="middle" style="padding: 0 8px;">
  <img src="cid:${contentId}" alt="${escapeHtml(alt)}" width="240" height="100" style="display: block; width: 100%; max-width: 240px; height: 100px; object-fit: contain; border: 0;" />
</td>`;
}

function templateVariables(
  candidate: Candidate,
  municipalityName: string,
  electionDescriptor: string,
  cutoffDate: string,
  personalLink: string,
  customLogoAvailable: boolean,
): Record<string, string> {
  return {
    candidate_name: candidate.name ?? '',
    candidate_salutation: candidateFormalSalutation(candidate),
    municipality_name: municipalityName,
    election_descriptor: electionDescriptor,
    cutoff_date: cutoffDate,
    personal_link: personalLink,
    projectName: 'Klimawahlcheck',
    stadt_land_klima_logo: logoCell(
      STADT_LAND_KLIMA_LOGO_CONTENT_ID,
      'Stadt.Land.Klima!',
    ),
    custom_logo: customLogoAvailable
      ? logoCell(CUSTOM_LOGO_CONTENT_ID, 'Logo des Klimawahlchecks')
      : '',
  };
}

async function validateCandidateEmailHtml(html: string): Promise<void> {
  const requiredElements = [
    ['<!doctype', 'Dokumenttyp (<!doctype html>)'],
    ['<html', '<html>'],
    ['<head', '<head>'],
    ['<title', '<title>'],
    ['<body', '<body>'],
  ] as const;
  const lowerHtml = html.toLowerCase();
  const missing = requiredElements
    .filter(([needle]) => !lowerHtml.includes(needle))
    .map(([, label]) => label);

  if (missing.length > 0) {
    throw new Error(
      `Die HTML-Vorlage ist unvollständig. Es fehlen: ${missing.join(', ')}.`,
    );
  }

  const report = await htmlValidator.validateString(html);
  if (report.valid) return;

  const messages = report.results
    .flatMap((result) => result.messages)
    .slice(0, 5)
    .map((message) => {
      const position = message.line ? `Zeile ${message.line}: ` : '';
      return `${position}${message.message}`;
    });

  throw new Error(`Die HTML-Vorlage ist ungültig. ${messages.join(' ')}`);
}

function candidateDisplayName(candidate: Candidate): string {
  return candidate.name?.trim() || `Kandidat:in ${candidate.id}`;
}

function candidateLastName(name?: string | null): string {
  const nameParts = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (nameParts.length === 0) return '';

  let lastNameStart = nameParts.length - 1;
  while (
    lastNameStart > 0
    && LAST_NAME_PARTICLES.has(nameParts[lastNameStart - 1]!.toLocaleLowerCase('de-DE'))
  ) {
    lastNameStart -= 1;
  }

  return nameParts.slice(lastNameStart).join(' ');
}

function candidateFormalSalutation(candidate: Candidate): string {
  const fullName = candidate.name?.trim().replace(/\s+/g, ' ') ?? '';
  const lastName = candidateLastName(candidate.name);

  if (candidate.salutation === 'frau') {
    return lastName ? `Sehr geehrte Frau ${lastName}` : 'Sehr geehrte Frau';
  }

  if (candidate.salutation === 'herr') {
    return lastName ? `Sehr geehrter Herr ${lastName}` : 'Sehr geehrter Herr';
  }

  return fullName ? `Guten Tag ${fullName}` : 'Guten Tag';
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
async function ensureAccessTokens<TCandidate extends Candidate>(
  candidates: TCandidate[],
  candidateSvc: InstanceType<Services['ItemsService']>,
  logger: Logger,
): Promise<TCandidate[]> {
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

async function loadInlineAttachment(
  assetId: string,
  contentId: string,
  fallbackFilename: string,
  assetsSvc: InstanceType<Services['AssetsService']>,
): Promise<{
  content: Buffer;
  filename: string;
  contentType: string;
  cid: string;
}> {
  const { stream, file } = await assetsSvc.getAsset(assetId);
  const chunks: Buffer[] = [];

  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return {
    content: Buffer.concat(chunks),
    filename: file.filename_download || fallbackFilename,
    contentType: file.type || 'application/octet-stream',
    cid: contentId,
  };
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export default {
  id: 'operation-send-candidate-mails',
  handler: async (
    { election_id, test_mode = false, mail_type = 'invitation' }: HandlerInput,
    { logger, accountability, services, getSchema, env }: HandlerContext,
  ): Promise<SendResult> => {
    const schema = await getSchema();
    const sysAcc = { ...accountability, admin: true };
    const { AssetsService, ItemsService, MailService } = services;

    const electionSvc = new ItemsService('elections', { schema, accountability: sysAcc });
    const candidateSvc = new ItemsService('candidate', { schema, accountability: sysAcc });
    const questionsSvc = new ItemsService('questions', { schema, accountability: sysAcc });
    const assetsSvc = new AssetsService({ schema, accountability: sysAcc });
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
    const mailConfiguration = getMailConfiguration(election, mail_type);
    const logPrefix = test_mode ? `test-candidate-${mail_type}-mail` : `send-candidate-${mail_type}-mails`;
    logger.info(
      `[${logPrefix}] Starting for election "${election.descriptor ?? election_id}", municipality: "${municipalityName ?? 'unknown'}"`,
    );

    // -----------------------------------------------------------------------
    // 2. Pre-flight checks
    // -----------------------------------------------------------------------

    if (!election.response_cutoff_date) {
      throw new Error(
        'Please set a response cutoff date (response_cutoff_date) on the election before sending invitations.',
      );
    }

    if (mail_type !== 'invitation' && !election.already_sent_mails) {
      throw new Error(
        'Die Einladungs-E-Mails müssen versendet worden sein, bevor diese E-Mails versendet werden können.',
      );
    }

    if (!test_mode && mail_type !== 'invitation' && election[mailConfiguration.sentFlag]) {
      throw new Error(`${mailConfiguration.label} wurde bereits versendet.`);
    }

    const candidateEmailTemplate = mailConfiguration.template;
    if (!candidateEmailTemplate) {
      throw new Error(
        `Die HTML-Vorlage für die ${mailConfiguration.label} ist leer. Es wurden keine E-Mails versendet.`,
      );
    }

    const candidateEmailSubjectTemplate = mailConfiguration.subject;
    if (!candidateEmailSubjectTemplate) {
      throw new Error(
        `Der Betreff für die ${mailConfiguration.label} ist leer. Es wurden keine E-Mails versendet.`,
      );
    }

    if (/[\r\n]/.test(candidateEmailSubjectTemplate)) {
      throw new Error(
        'Der Betreff für Kandidierenden-E-Mails darf keinen Zeilenumbruch enthalten. Es wurden keine E-Mails versendet.',
      );
    }

    const municipality = municipalityName?.trim() ?? '';
    const cutoffFormatted = formatCutoffDate(election.response_cutoff_date);
    const frontendBaseUrl = env.FRONTEND_BASE_URL?.trim().replace(/\/+$/, '');
    if (!frontendBaseUrl) {
      throw new Error(
        'Server misconfiguration: FRONTEND_BASE_URL is not set. Es wurden keine E-Mails versendet.',
      );
    }
    const customLogoId = typeof election.custom_logo === 'string'
      ? election.custom_logo
      : election.custom_logo?.id;
    const previewVariables = templateVariables(
      { id: 'preview', name: 'Max Mustermann', salutation: 'herr' },
      municipality,
      election.descriptor?.trim() ?? '',
      cutoffFormatted,
      `${frontendBaseUrl}/elections/thesen/preview`,
      Boolean(customLogoId),
    );
    const previewHtml = renderTemplate(candidateEmailTemplate, previewVariables);
    const unknownHtmlPlaceholders = unresolvedPlaceholders(previewHtml);

    if (unknownHtmlPlaceholders.length > 0) {
      throw new Error(
        `Die HTML-Vorlage enthält unbekannte Platzhalter: ${uniqueValues(unknownHtmlPlaceholders).join(', ')}. Es wurden keine E-Mails versendet.`,
      );
    }

    await validateCandidateEmailHtml(previewHtml);

    const unsupportedSubjectPlaceholders = placeholderNames(candidateEmailSubjectTemplate)
      .filter((name) => !SUBJECT_PLACEHOLDERS.has(name));

    if (unsupportedSubjectPlaceholders.length > 0) {
      throw new Error(
        `Der E-Mail-Betreff enthält nicht unterstützte Platzhalter: ${unsupportedSubjectPlaceholders.join(', ')}. Es wurden keine E-Mails versendet.`,
      );
    }

    const previewSubject = renderSubject(candidateEmailSubjectTemplate, previewVariables).trim();
    const unknownSubjectPlaceholders = unresolvedPlaceholders(previewSubject);

    if (unknownSubjectPlaceholders.length > 0) {
      throw new Error(
        `Der E-Mail-Betreff enthält unbekannte Platzhalter: ${uniqueValues(unknownSubjectPlaceholders).join(', ')}. Es wurden keine E-Mails versendet.`,
      );
    }

    if (!previewSubject) {
      throw new Error(
        'Der konfigurierte E-Mail-Betreff ergibt einen leeren Wert. Es wurden keine E-Mails versendet.',
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
        fields: ['id', 'name', 'salutation', 'email', 'access_token', 'has_answered'],
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

    const eligibleCandidates = candidates.filter((candidate) => isEligibleCandidate(candidate, mail_type));

    if (eligibleCandidates.length === 0) {
      throw new Error(mailConfiguration.emptyRecipientsMessage);
    }

    const sent: CandidateMailSummary[] = [];
    const failed: CandidateMailSummary[] = [];
    const skipped: CandidateMailSummary[] = [];
    const sendableCandidates: SendableCandidate[] = [];

    if (!test_mode) {
      for (const candidate of eligibleCandidates) {
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
    }

    const selectedCandidate = test_mode
      ? eligibleCandidates[crypto.randomInt(eligibleCandidates.length)]!
      : undefined;
    const candidatesToSend = selectedCandidate ? [selectedCandidate] : sendableCandidates;

    logger.info(
      `[${logPrefix}] Pre-flight passed: ${questions.length} questions, ${candidates.length} candidates, ${eligibleCandidates.length} eligible, ${candidatesToSend.length} selected, ${skipped.length} skipped`,
    );

    // -----------------------------------------------------------------------
    // 3. Ensure all candidates have stable access tokens
    // -----------------------------------------------------------------------

    const withTokens = await ensureAccessTokens(candidatesToSend, candidateSvc, logger);
    const ccRecipients = test_mode
      ? []
      : uniqueEmailAddresses([
          ALWAYS_CC,
          ...splitEmailAddresses(election.candidate_email_cc),
        ]);
    const replyTo = splitEmailAddresses(election.candidate_email_reply_to)[0];
    const attachments: Array<{
      content: Buffer;
      filename: string;
      contentType: string;
      cid: string;
    }> = [];

    if (usesPlaceholder(candidateEmailTemplate, 'stadt_land_klima_logo')) {
      attachments.push({
        content: Buffer.from(STADT_LAND_KLIMA_LOGO_PNG_BASE64, 'base64'),
        filename: 'stadt-land-klima-logo.png',
        contentType: 'image/png',
        cid: STADT_LAND_KLIMA_LOGO_CONTENT_ID,
      });
    }

    if (customLogoId && usesPlaceholder(candidateEmailTemplate, 'custom_logo')) {
      attachments.push(await loadInlineAttachment(
        customLogoId,
        CUSTOM_LOGO_CONTENT_ID,
        'wahlcheck-logo',
        assetsSvc,
      ));
    }

    // -----------------------------------------------------------------------
    // 4. Send mails
    // -----------------------------------------------------------------------

    for (const candidate of withTokens) {
      const recipient = test_mode ? ALWAYS_CC : normalizeEmail(candidate.email);
      if (!recipient) {
        failed.push(summarizeCandidate(candidate, 'Keine E-Mail-Adresse hinterlegt.'));
        continue;
      }

      const personalLink = `${frontendBaseUrl}/elections/thesen/${candidate.access_token}`;
      const variables = templateVariables(
        candidate,
        municipality,
        election.descriptor?.trim() ?? '',
        cutoffFormatted,
        personalLink,
        Boolean(customLogoId),
      );
      const candidateEmailHtml = renderTemplate(candidateEmailTemplate, variables);
      const candidateEmailSubject = renderSubject(
        candidateEmailSubjectTemplate,
        variables,
      ).trim();

      try {
        await mailSvc.send({
          to: recipient,
          ...(ccRecipients.length > 0 ? { cc: ccRecipients } : {}),
          ...(replyTo ? { replyTo } : {}),
          ...(attachments.length > 0 ? { attachments } : {}),
          subject: candidateEmailSubject,
          html: candidateEmailHtml,
        });

        sent.push(summarizeCandidate({ ...candidate, email: recipient }));
        logger.info(
          `[${logPrefix}] Sent email prepared for candidate ${candidate.id} to ${recipient}`,
        );
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        const failedCandidate = summarizeCandidate({ ...candidate, email: recipient }, message);
        const detail = `Failed to send to ${recipient}: ${message}`;
        logger.error(`[${logPrefix}] ${detail}`);
        failed.push(failedCandidate);
      }
    }

    // -----------------------------------------------------------------------
    // 5. Persist result
    // -----------------------------------------------------------------------

    // A test email must never mark a mail run as completed.
    if (!test_mode && sent.length > 0) {
      await electionSvc.updateOne(election_id, { [mailConfiguration.sentFlag]: true });
    } else if (!test_mode) {
      logger.warn(
        `[${logPrefix}] No mails were delivered; not marking ${mailConfiguration.sentFlag}.`,
      );
    }

    const updatedElection = await electionSvc.readOne(election_id, {
      fields: [
        'already_generated_questions',
        'already_sent_mails',
        'already_sent_reminder_mails',
        'already_sent_thank_you_mails',
      ],
    }) as Record<string, unknown>;

    const errors = failed.map(formatFailure);

    logger.info(
      `[${logPrefix}] Finished: ${sent.length} sent, ${failed.length} failed, ${skipped.length} skipped`,
    );

    return {
      success: failed.length === 0 && sent.length > 0,
      testMode: test_mode,
      sentCount: sent.length,
      failedCount: failed.length,
      skippedCount: skipped.length,
      totalCandidates: candidates.length,
      eligibleCandidates: eligibleCandidates.length,
      mailType: mail_type,
      errors,
      sent,
      failed,
      skipped,
      election_id,
      ...(test_mode ? {
        testRecipient: ALWAYS_CC,
        selectedCandidate: summarizeCandidate(selectedCandidate!),
      } : {}),
      updated_data: updatedElection,
    };
  },
};

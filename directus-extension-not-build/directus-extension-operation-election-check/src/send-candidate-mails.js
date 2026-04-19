import crypto from 'crypto';
import { resolveLocalteamId } from './resolve-localteam.js';

export const sendCandidateEmailsApi = {
  id: 'operation-send-candidate-emails',
  handler: async ({ localteam_id }, { logger, accountability, services, getSchema, data }) => {
    const { RolesService, ItemsService, MailService } = services;
    const schema = await getSchema();
    const sysAcc = { ...accountability, admin: true };

    const resolved_id = await resolveLocalteamId(localteam_id, accountability, data, ItemsService, schema);

    // ── Authorisation: Administrator only ────────────────────────────────────
    if (!accountability?.role) {
      throw new Error('Nicht autorisiert: Kein Benutzer-Kontext vorhanden.');
    }
    const rolesSvc   = new RolesService({ schema, accountability: sysAcc });
    const adminRoles = await rolesSvc.readByQuery({ filter: { name: { _eq: 'Administrator' } }, limit: 1 });
    if (!adminRoles?.length) {
      throw new Error('Administrator-Rolle nicht gefunden. Bitte Datenbankeinrichtung prüfen.');
    }
    if (accountability.role !== adminRoles[0].id) {
      throw new Error('Nur Administratoren können Kandidaten-E-Mails versenden.');
    }
    // ─────────────────────────────────────────────────────────────────────────

    const localteamSvc = new ItemsService('localteams', { schema, accountability: sysAcc });
    const candidateSvc = new ItemsService('candidate',  { schema, accountability: sysAcc });
    const questionsSvc = new ItemsService('questions',  { schema, accountability: sysAcc });
    const mailSvc      = new MailService({ schema, accountability: sysAcc });

    const localteam = await localteamSvc.readOne(resolved_id);
    if (!localteam) throw new Error('Lokalteam nicht gefunden.');

    // ── Pre-flight checks ────────────────────────────────────────────────────
    if (!localteam.cutoff_date) {
      throw new Error('Bitte setzen Sie zuerst einen Stichtag (cutoff_date) für das Lokalteam.');
    }

    const questions = await questionsSvc.readByQuery({
      filter: { localteam: { _eq: resolved_id }, status: { _eq: 'published' } },
      fields: ['id'],
      limit: -1,
    });
    if (questions.length < 10) {
      throw new Error(`Nur ${questions.length} veröffentlichte Thesen gefunden. Es werden mindestens 10 benötigt.`);
    }

    const candidates = await candidateSvc.readByQuery({
      filter: { localteam: { _eq: resolved_id }, email: { _nnull: true } },
      limit: -1,
    });
    if (candidates.length < 2) {
      throw new Error(`Nur ${candidates.length} Kandidaten mit E-Mail gefunden. Es werden mindestens 2 benötigt.`);
    }
    // ─────────────────────────────────────────────────────────────────────────

    const cutoffFormatted = new Date(localteam.cutoff_date).toLocaleString('de-DE', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

    let sentCount = 0;
    const errors  = [];

    for (const candidate of candidates) {
      // Token is generated once and persisted before the send attempt,
      // so the link remains stable across reminder runs even if sending fails.
      let token = candidate.access_token;
      if (!token) {
        token = crypto.randomBytes(32).toString('hex');
        await candidateSvc.updateOne(candidate.id, { access_token: token });
        logger.info(`send-candidate-emails: generated and persisted token for candidate ${candidate.id}`);
      }

      const personalLink = `https://stadt-land-klima.de/thesen/${localteam.id}/${token}`;

      try {
        await mailSvc.send({
          to: candidate.email,
          subject: `Einladung zum Klimawahl-Check: ${localteam.municipality_name}`,
          template: {
            name: 'email-template-candidate',
            data: {
              candidate_name:    candidate.name,
              municipality_name: localteam.municipality_name,
              cutoff_date:       cutoffFormatted,
              personal_link:     personalLink,
            },
          },
        });
        sentCount++;
        logger.info(`send-candidate-emails: sent to ${candidate.email}`);
      } catch (err) {
        // Collect failures — one bad address must not abort the whole batch.
        const msg = `Fehler beim Senden an ${candidate.email}: ${err.message}`;
        logger.error(msg);
        errors.push(msg);
      }
    }

    return {
      success:         true,
      sentCount,
      failedCount:     errors.length,
      totalCandidates: candidates.length,
      errors,
      localteam_id:    resolved_id,
    };
  },
};

export const sendCandidateEmailsApp = {
  id: 'operation-send-candidate-emails',
  name: 'Send Candidate Emails',
  icon: 'mail',
  description: 'Sends personalised email invitations to candidates with a secure, stable access link.',
  overview: ({ localteam_id }) => [
    { label: 'Localteam ID', text: localteam_id || '(resolved automatically)' },
  ],
  options: [
    {
      field: 'localteam_id',
      name: 'Localteam ID',
      type: 'string',
      meta: {
        width: 'full',
        interface: 'input',
        note: 'Leave blank to resolve from the flow trigger or the current user. Caller must be an Administrator.',
      },
    },
  ],
};

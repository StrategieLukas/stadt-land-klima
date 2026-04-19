import crypto from 'crypto';
import { resolveElectionId } from '../resolve-election.js';

export default {
  id: 'operation-send-candidate-mails',
  handler: async ({ election_id }, { logger, accountability, services, getSchema, data }) => {
    const { RolesService, ItemsService, MailService } = services;
    const schema = await getSchema();
    const sysAcc = { ...accountability, admin: true };

    const resolved_id = await resolveElectionId(election_id, data, ItemsService, schema, accountability);

    // ── Authorisation: Administrator only (backend enforcement) ──────────────
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

    const electionSvc  = new ItemsService('elections', { schema, accountability: sysAcc });
    const candidateSvc = new ItemsService('candidate', { schema, accountability: sysAcc });
    const questionsSvc = new ItemsService('questions', { schema, accountability: sysAcc });
    const mailSvc      = new MailService({ schema, accountability: sysAcc });

    const election = await electionSvc.readOne(resolved_id, { fields: ['*', 'localteam.*'] });
    if (!election) throw new Error('Wahl nicht gefunden.');

    const municipalityName = election.localteam?.municipality_name;

    // ── Pre-flight checks ────────────────────────────────────────────────────
    if (!election.response_cutoff_date) {
      throw new Error('Bitte setzen Sie zuerst einen Stichtag (response_cutoff_date) für die Wahl.');
    }

    const questions = await questionsSvc.readByQuery({
      filter: { election: { _eq: resolved_id }, status: { _eq: 'published' } },
      fields: ['id'],
      limit: -1,
    });
    if (questions.length < 10) {
      throw new Error(`Nur ${questions.length} veröffentlichte Thesen gefunden. Es werden mindestens 10 benötigt.`);
    }

    const candidates = await candidateSvc.readByQuery({
      filter: { election: { _eq: resolved_id }, email: { _nnull: true } },
      limit: -1,
    });
    if (candidates.length < 2) {
      throw new Error(`Nur ${candidates.length} Kandidaten mit E-Mail gefunden. Es werden mindestens 2 benötigt.`);
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Cutoff is a date field — treat as 23:59 on that date
    const cutoffDate = new Date(election.response_cutoff_date);
    cutoffDate.setHours(23, 59, 0, 0);
    const cutoffFormatted = cutoffDate.toLocaleString('de-DE', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

    let sentCount = 0;
    const errors  = [];

    for (const candidate of candidates) {
      // Token persisted before send — stable across reminder runs
      let token = candidate.access_token;
      if (!token) {
        token = crypto.randomBytes(32).toString('hex');
        await candidateSvc.updateOne(candidate.id, { access_token: token });
        logger.info(`send-candidate-mails: generated and persisted token for candidate ${candidate.id}`);
      }

      const personalLink = `https://stadt-land-klima.de/thesen/${resolved_id}/${token}`;

      try {
        await mailSvc.send({
          to: candidate.email,
          subject: `Einladung zum Klimawahl-Check: ${municipalityName}`,
          template: {
            name: 'email-template-candidate',
            data: {
              candidate_name:    candidate.name,
              municipality_name: municipalityName,
              cutoff_date:       cutoffFormatted,
              personal_link:     personalLink,
            },
          },
        });
        sentCount++;
        logger.info(`send-candidate-mails: sent to ${candidate.email}`);
      } catch (err) {
        const msg = `Fehler beim Senden an ${candidate.email}: ${err.message}`;
        logger.error(msg);
        errors.push(msg);
      }
    }

    await electionSvc.updateOne(resolved_id, { already_sent_mails: true });

    return {
      success:         true,
      sentCount,
      failedCount:     errors.length,
      totalCandidates: candidates.length,
      errors,
      election_id:     resolved_id,
    };
  },
};

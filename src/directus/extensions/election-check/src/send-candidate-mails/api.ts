import crypto from 'crypto';
import type { Logger, Accountability, Services, GetSchema, Database } from '@directus/extensions-sdk';

export default {
  id: 'operation-send-candidate-mails',
  handler: async ({ election_id }: { election_id: string | number }, { logger, accountability, services, getSchema, data }: { logger: Logger; accountability: Accountability; services: Services; getSchema: GetSchema; data: Record<string, unknown> }) => {
    const { ItemsService, MailService } = services;
    const schema = await getSchema();
    const sysAcc = { ...accountability, admin: true };

    const electionSvc = new ItemsService('elections', { schema, accountability: sysAcc });
    const candidateSvc = new ItemsService('candidate', { schema, accountability: sysAcc });
    const questionsSvc = new ItemsService('questions', { schema, accountability: sysAcc });
    const mailSvc = new MailService({ schema, accountability: sysAcc });

    const election = await electionSvc.readOne(election_id, { fields: ['*', 'localteam.*'] });
    if (!election) throw new Error('Wahl nicht gefunden.');

    const municipalityName = (election as Record<string, unknown>).localteam?.municipality_name as string | undefined;

    // ── Pre-flight checks ────────────────────────────────────────────────────
    if (!election.response_cutoff_date) {
      throw new Error('Bitte setzen Sie zuerst einen Stichtag (response_cutoff_date) für die Wahl.');
    }

    const questions = await questionsSvc.readByQuery({
      filter: { election: { _eq: election_id }, status: { _eq: 'published' } },
      fields: ['id'],
      limit: -1,
    });
    if (questions.length < 10) {
      throw new Error(`Nur ${questions.length} veröffentlichte Thesen gefunden. Es werden mindestens 10 benötigt.`);
    }

    const candidates = await candidateSvc.readByQuery({
      filter: { election: { _eq: election_id }, email: { _nnull: true } },
      limit: -1,
    });
    if (candidates.length < 2) {
      throw new Error(`Nur ${candidates.length} Kandidaten mit E-Mail gefunden. Es werden mindestens 2 benötigt.`);
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Cutoff is a date field — treat as 23:59 on that date
    const cutoffDate = new Date(election.response_cutoff_date as string);
    cutoffDate.setHours(23, 59, 0, 0);
    const cutoffFormatted = cutoffDate.toLocaleString('de-DE', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

    let sentCount = 0;
    const errors: string[] = [];

    for (const candidate of candidates) {
      const c = candidate as Record<string, unknown>;
      // Token persisted before send — stable across reminder runs
      let token = c.access_token as string | undefined;
      if (!token) {
        token = crypto.randomBytes(32).toString('hex');
        await candidateSvc.updateOne(candidate.id, { access_token: token });
        logger.info(`send-candidate-mails: generated and persisted token for candidate ${candidate.id}`);
      }

      const personalLink = `https://stadt-land-klima.de/elections/thesen/${token}`;

      try {
        logger.info(`send-candidate-mails: Attempting to send mail to ${c.email} using template "email-template-candidate"`);
        await mailSvc.send({
          to: c.email as string,
          subject: `Einladung zum Klimawahl-Check: ${municipalityName}`,
          template: {
            name: "email-template-candidate",
            data: {
              candidate_name: c.name as string,
              municipality_name: municipalityName,
              cutoff_date: cutoffFormatted,
              personal_link: personalLink,
              projectName: 'Klimawahlcheck',
              projectColor: '#1da64a',
              projectUrl: 'https://stadt-land-klima.de'
            },
          },
        });
        sentCount++;
        logger.info(`send-candidate-mails: sent to ${c.email}`);
      } catch (err: unknown) {
        const error = err as Error;
        const msg = `Fehler beim Senden an ${c.email}: ${error.message}`;
        logger.error(msg);
        errors.push(msg);
      }
    }

    await electionSvc.updateOne(election_id, { already_sent_mails: true });

    const updatedElection = await electionSvc.readOne(election_id, {
      fields: ['already_generated_questions', 'already_sent_mails'],
    });

    return {
      success: true,
      sentCount,
      failedCount: errors.length,
      totalCandidates: candidates.length,
      errors,
      election_id: election_id,
      updated_data: updatedElection,
    };
  },
};

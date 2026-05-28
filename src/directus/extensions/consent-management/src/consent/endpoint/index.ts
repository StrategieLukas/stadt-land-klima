import type { Router, Services } from '@directus/extensions-sdk';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AgreementVersion {
  id: string;
  type: 'terms_of_service' | 'data_protection' | 'newsletter';
  version: string;
  isCurrentVersion: boolean;
  legal_text: string;
}

interface UserConsent {
  id: string;
  user_id: string;
  consent_target: string;
  created_at?: string;
}

interface ConsentStatusResponse {
  hasAccepted: boolean;
  newsletterSubscribed: boolean;
  agbVersion: string | null;
  dataProtectionVersion: string | null;
  newsletterVersion: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Fetch all current agreement versions in a single query and return them as a
 * typed map keyed by agreement type. Avoids the in-memory find() fan-out that
 * the original /status handler used.
 */
async function getCurrentVersionsByType(
  versionsService: InstanceType<Services['ItemsService']>
): Promise<Partial<Record<AgreementVersion['type'], AgreementVersion>>> {
  const versions = (await versionsService.readByQuery({
    filter: { isCurrentVersion: { _eq: true } },
    fields: ['id', 'type', 'version'],
    limit: -1,
  })) as AgreementVersion[];

  return Object.fromEntries(versions.map((v) => [v.type, v])) as Partial<
    Record<AgreementVersion['type'], AgreementVersion>
  >;
}

// ─── Router ───────────────────────────────────────────────────────────────────

export default (router: Router, { services }: { services: Services }) => {
  const { ItemsService } = services;

  // ── GET /consent/status ────────────────────────────────────────────────────
  //
  // Returns whether the authenticated user has accepted required agreements and
  // whether they are subscribed to the newsletter.
  //
  router.get('/consent/status', async (req, res) => {
    try {
      const { accountability, schema } = req;
      const userId = accountability?.user;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const consentsService = new ItemsService('user_consent', {
        accountability: null,
        schema,
      });

      const versionsService = new ItemsService('agreement_versions', {
        accountability: null,
        schema,
      });

      // Single query for all current versions, returned as a type-keyed map.
      const versionsByType = await getCurrentVersionsByType(versionsService);
      const agbVersion = versionsByType['terms_of_service'];
      const dataProtectionVersion = versionsByType['data_protection'];
      const newsletterVersion = versionsByType['newsletter'];

      // Collect only the IDs we actually care about to keep the consent query
      // selective instead of fetching every consent record for the user.
      const relevantVersionIds = [
        agbVersion?.id,
        dataProtectionVersion?.id,
        newsletterVersion?.id,
      ].filter((id): id is string => Boolean(id));

      const userConsents =
        relevantVersionIds.length > 0
          ? ((await consentsService.readByQuery({
            filter: {
              user_id: { _eq: userId },
              consent_target: { _in: relevantVersionIds },
            },
            fields: ['consent_target'],
            limit: -1,
          })) as Pick<UserConsent, 'consent_target'>[])
          : [];

      const acceptedIds = new Set(userConsents.map((c) => c.consent_target));

      const body: ConsentStatusResponse = {
        hasAccepted:
          Boolean(agbVersion && acceptedIds.has(agbVersion.id)) &&
          Boolean(dataProtectionVersion && acceptedIds.has(dataProtectionVersion.id)),
        newsletterSubscribed: Boolean(newsletterVersion && acceptedIds.has(newsletterVersion.id)),
        agbVersion: agbVersion?.version ?? null,
        dataProtectionVersion: dataProtectionVersion?.version ?? null,
        newsletterVersion: newsletterVersion?.version ?? null,
      };

      return res.json(body);
    } catch (error) {
      console.error('[consent] Error in GET /consent/status:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ── POST /consent/newsletter/optin ─────────────────────────────────────────
  //
  // Subscribes the authenticated user to the newsletter by creating a consent
  // record for the current newsletter agreement version.
  //
  // This endpoint was missing from the original codebase — the Vue module
  // created newsletter consents directly via /items/user_consent, bypassing
  // any server-side logic. Centralising it here keeps all consent mutations in
  // one place and makes future auditing straightforward.
  //
  router.post('/consent/newsletter/optin', async (req, res) => {
    try {
      const { accountability, schema } = req;
      const userId = accountability?.user;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const consentsService = new ItemsService('user_consent', {
        accountability: null,
        schema,
      });

      const versionsService = new ItemsService('agreement_versions', {
        accountability: null,
        schema,
      });

      const currentVersions = (await versionsService.readByQuery({
        filter: {
          isCurrentVersion: { _eq: true },
          type: { _eq: 'newsletter' },
        },
        fields: ['id'],
        limit: 1,
      })) as Pick<AgreementVersion, 'id'>[];

      if (currentVersions.length === 0) {
        return res.status(404).json({ error: 'No newsletter agreement version found' });
      }

      const newsletterVersionId = currentVersions[0].id;

      // Idempotent: skip creation if a consent record already exists.
      const existing = (await consentsService.readByQuery({
        filter: {
          user_id: { _eq: userId },
          consent_target: { _eq: newsletterVersionId },
        },
        fields: ['id'],
        limit: 1,
      })) as Pick<UserConsent, 'id'>[];

      if (existing.length > 0) {
        return res.json({ success: true, message: 'Already subscribed' });
      }

      await consentsService.createOne({
        user_id: userId,
        consent_target: newsletterVersionId,
      });

      return res.status(201).json({ success: true, message: 'Newsletter subscription created' });
    } catch (error) {
      console.error('[consent] Error in POST /consent/newsletter/optin:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ── DELETE /consent/newsletter/optout ──────────────────────────────────────
  //
  // Unsubscribes the authenticated user from the newsletter by removing their
  // consent record for the current newsletter agreement version.
  //
  // Changed from GET to DELETE — a GET must be safe and idempotent per HTTP
  // semantics; deleting data violates that contract. Some email clients
  // pre-fetch GET links, which would silently opt users out.
  //
  router.delete('/consent/newsletter/optout', async (req, res) => {
    try {
      const { accountability, schema } = req;
      const userId = accountability?.user;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const consentsService = new ItemsService('user_consent', {
        accountability: null,
        schema,
      });

      const versionsService = new ItemsService('agreement_versions', {
        accountability: null,
        schema,
      });

      const currentVersions = (await versionsService.readByQuery({
        filter: {
          isCurrentVersion: { _eq: true },
          type: { _eq: 'newsletter' },
        },
        fields: ['id'],
        limit: 1,
      })) as Pick<AgreementVersion, 'id'>[];

      if (currentVersions.length === 0) {
        return res.status(404).json({ error: 'No newsletter agreement version found' });
      }

      const newsletterVersionId = currentVersions[0].id;

      // Verify the user actually has a newsletter consent before deleting.
      // Without this check a 404 would bubble up from deleteOne, giving a
      // confusing error rather than a clear "not subscribed" message.
      const existingConsents = (await consentsService.readByQuery({
        filter: {
          user_id: { _eq: userId },
          consent_target: { _eq: newsletterVersionId },
        },
        fields: ['id'],
        limit: 1,
      })) as Pick<UserConsent, 'id'>[];

      if (existingConsents.length === 0) {
        // Idempotent: opt-out of something you're not subscribed to is fine.
        return res.json({ success: true, message: 'Not subscribed' });
      }

      await consentsService.deleteOne(existingConsents[0].id);

      return res.json({ success: true, message: 'Newsletter subscription removed' });
    } catch (error) {
      console.error('[consent] Error in DELETE /consent/newsletter/optout:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ── POST /consent/accept ───────────────────────────────────────────────────
  //
  // Accepts the required agreements (AGB + data protection) and optionally
  // subscribes to the newsletter in a single atomic call.
  //
  // This endpoint was also missing: the Vue module was posting directly to
  // /items/user_consent for each consent record individually. Moving acceptance
  // here lets us validate required fields server-side, run all inserts in
  // parallel, and make the frontend logic trivial.
  //
  router.post('/consent/accept', async (req, res) => {
    try {
      const { accountability, schema } = req;
      const userId = accountability?.user;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { subscribeNewsletter } = req.body as { subscribeNewsletter?: boolean };

      const consentsService = new ItemsService('user_consent', {
        accountability: null,
        schema,
      });

      const versionsService = new ItemsService('agreement_versions', {
        accountability: null,
        schema,
      });

      const versionsByType = await getCurrentVersionsByType(versionsService);
      const agbVersion = versionsByType['terms_of_service'];
      const dataProtectionVersion = versionsByType['data_protection'];
      const newsletterVersion = versionsByType['newsletter'];

      if (!agbVersion || !dataProtectionVersion) {
        return res.status(500).json({
          error: 'Required agreement versions (AGB / data protection) are not configured',
        });
      }

      // Check which consents already exist so this call is idempotent.
      const existingTargetIds = new Set(
        (
          (await consentsService.readByQuery({
            filter: {
              user_id: { _eq: userId },
              consent_target: {
                _in: [
                  agbVersion.id,
                  dataProtectionVersion.id,
                  ...(newsletterVersion ? [newsletterVersion.id] : []),
                ],
              },
            },
            fields: ['consent_target'],
            limit: -1,
          })) as Pick<UserConsent, 'consent_target'>[]
        ).map((c) => c.consent_target)
      );

      const toCreate: { user_id: string; consent_target: string }[] = [];

      if (!existingTargetIds.has(agbVersion.id)) {
        toCreate.push({ user_id: userId, consent_target: agbVersion.id });
      }

      if (!existingTargetIds.has(dataProtectionVersion.id)) {
        toCreate.push({ user_id: userId, consent_target: dataProtectionVersion.id });
      }

      if (subscribeNewsletter && newsletterVersion && !existingTargetIds.has(newsletterVersion.id)) {
        toCreate.push({ user_id: userId, consent_target: newsletterVersion.id });
      }

      if (toCreate.length > 0) {
        await Promise.all(toCreate.map((record) => consentsService.createOne(record)));
      }

      return res.status(toCreate.length > 0 ? 201 : 200).json({
        success: true,
        created: toCreate.length,
      });
    } catch (error) {
      console.error('[consent] Error in POST /consent/accept:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });
};

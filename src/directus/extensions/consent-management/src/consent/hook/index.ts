import type { FilterHandler, HookExtensionContext } from '@directus/extensions-sdk';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AgreementVersion {
  id: string;
  type: 'terms_of_service' | 'data_protection' | 'newsletter';
}

interface DirectusRole {
  id: string;
  name: string;
}

interface ItemsServiceInstance {
  readByQuery(options: Record<string, unknown>): Promise<Record<string, unknown>[]>;
  readOne(id: string | number, options?: Record<string, unknown>): Promise<Record<string, unknown>>;
}

interface ItemsServiceConstructor {
  new (collection: string, options: { accountability: null; schema: unknown }): ItemsServiceInstance;
}

// ─── Error ────────────────────────────────────────────────────────────────────

class ConsentNotAcceptedError extends Error {
  override name = 'DirectusError';
  code = 'CONSENT_NOT_ACCEPTED';
  status = 400;

  constructor() {
    super(
      'Sie müssen die AGB und Datenschutzerklärung akzeptieren, um auf diese Inhalte zugreifen ' +
      'zu können. Bitte akzeptieren Sie die Vereinbarungen im Consent Management Modul.'
    );
  }
}

class ConsentConfigurationError extends Error {
  override name = 'DirectusError';
  code = 'CONSENT_CONFIGURATION_ERROR';
  status = 500;

  constructor() {
    super(
      'Die aktuellen AGB oder die aktuelle Datenschutzerklärung sind nicht konfiguriert. ' +
      'Bitte veröffentlichen Sie beide Versionen im Consent Management Modul.'
    );
  }
}

// ─── Collections that must always be readable regardless of consent status ───
//
// Using a Set instead of an array makes the lookup O(1). Add any collection
// that the consent flow itself needs to read (e.g. the module's own tables).

const CONSENT_COLLECTIONS = new Set(['user_consent', 'agreement_versions']);

// Role names whose members are exempt from the consent gate. Keep in sync with
// your Directus role configuration.
const EXEMPT_ROLE_NAMES = ['Administrator', 'Frontend', 'frontend'] as const;

// ─── Hook ─────────────────────────────────────────────────────────────────────

export default (
  { filter }: { filter: FilterHandler },
  { services }: HookExtensionContext
) => {
  const { ItemsService } = services as unknown as { ItemsService: ItemsServiceConstructor };

  // ── Helpers ────────────────────────────────────────────────────────────────

  async function getIgnoredRoleIds(schema: unknown): Promise<Set<string>> {
    const rolesService = new ItemsService('directus_roles', {
      accountability: null,
      schema,
    });

    const roles = (await rolesService.readByQuery({
      fields: ['id'],
      filter: { name: { _in: EXEMPT_ROLE_NAMES } },
    })) as DirectusRole[];

    return new Set(roles.map((r) => r.id));
  }

  async function getRequiredVersionIds(
    schema: unknown
  ): Promise<{ agbId: string; dataProtectionId: string } | null> {
    const versionsService = new ItemsService('agreement_versions', {
      accountability: null,
      schema,
    });

    const versions = (await versionsService.readByQuery({
      filter: { isCurrentVersion: { _eq: true } },
      fields: ['id', 'type'],
      limit: -1,
    })) as AgreementVersion[];

    const agb = versions.find((v) => v.type === 'terms_of_service');
    const dp = versions.find((v) => v.type === 'data_protection');

    return agb && dp ? { agbId: agb.id, dataProtectionId: dp.id } : null;
  }

  async function userHasAcceptedRequiredAgreements(
    userId: string | number,
    schema: unknown
  ): Promise<boolean> {
    const versionIds = await getRequiredVersionIds(schema);

    if (!versionIds) throw new ConsentConfigurationError();

    const consentsService = new ItemsService('user_consent', {
      accountability: null,
      schema,
    });

    const consents = (await consentsService.readByQuery({
      filter: {
        user_id: { _eq: userId },
        consent_target: { _in: [versionIds.agbId, versionIds.dataProtectionId] },
      },
      fields: ['consent_target'],
      limit: 2,
    })) as { consent_target: string }[];

    const accepted = new Set(consents.map((c) => c.consent_target));
    return accepted.has(versionIds.agbId) && accepted.has(versionIds.dataProtectionId);
  }

  async function isUserRoleExempt(
    userId: string | number,
    schema: unknown
  ): Promise<boolean> {
    const [ignoredRoleIds, usersService] = await Promise.all([
      getIgnoredRoleIds(schema),
      Promise.resolve(
        new ItemsService('directus_users', { accountability: null, schema })
      ),
    ]);

    // readOne throws if the user doesn't exist, which is the correct behaviour —
    // a missing user should not silently pass the consent gate.
    const user = await usersService.readOne(userId as string, { fields: ['role'] });
    const roleId = user.role as string | undefined;

    return Boolean(roleId && ignoredRoleIds.has(roleId));
  }

  // ── Filter registration ────────────────────────────────────────────────────
  //
  const GATED_EVENTS = ['items.create', 'items.update', 'items.read'] as const;

  GATED_EVENTS.forEach((event) => {
    filter(event, async (items, meta, context) => {
      const { collection } = meta as { collection: string };

      // Always allow operations on consent-related collections so the
      // acceptance flow can never deadlock itself.
      if (CONSENT_COLLECTIONS.has(collection)) return items;

      const { accountability, schema } = context as {
        accountability: { user?: string | number; role?: string } | null;
        schema: unknown;
      };

      const userId = accountability?.user;

      // No authenticated user (e.g. public API call or system operation) —
      // pass through. Public routes should be secured at the policy level.
      if (!userId) return items;

      // Run role-exemption check and — if not exempt — the consent check.
      // We check exemption first because it's cheaper when the cache is warm:
      // one Set.has() vs two DB queries.
      const exempt = await isUserRoleExempt(userId, schema);
      if (exempt) return items;

      const hasAccepted = await userHasAcceptedRequiredAgreements(userId, schema);
      if (!hasAccepted) throw new ConsentNotAcceptedError();

      return items;
    });
  });
};

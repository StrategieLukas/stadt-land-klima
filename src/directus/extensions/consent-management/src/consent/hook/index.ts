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

// ─── Cache ────────────────────────────────────────────────────────────────────
//
// The original hook re-queried role IDs and required agreement version IDs on
// every single filter event — effectively N+1 DB hits per request. These values
// change very rarely (role names are static; agreement versions change only on
// legal updates), so we cache them in module scope for the lifetime of the
// Directus process.
//
// TTL is 5 minutes. For agreement versions this is conservative; adjust upward
// if DB pressure is a concern.

const CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

function makeCache<T>() {
  let entry: CacheEntry<T> | null = null;

  return {
    get(): T | null {
      if (entry && Date.now() < entry.expiresAt) return entry.value;
      return null;
    },
    set(value: T): void {
      entry = { value, expiresAt: Date.now() + CACHE_TTL_MS };
    },
    invalidate(): void {
      entry = null;
    },
  };
}

const ignoredRoleIdsCache = makeCache<Set<string>>();
const requiredVersionIdsCache = makeCache<{ agbId: string; dataProtectionId: string } | null>();

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
    const cached = ignoredRoleIdsCache.get();
    if (cached) return cached;

    const rolesService = new ItemsService('directus_roles', {
      accountability: null,
      schema,
    });

    const roles = (await rolesService.readByQuery({
      fields: ['id'],
      filter: { name: { _in: EXEMPT_ROLE_NAMES } },
    })) as DirectusRole[];

    const ids = new Set(roles.map((r) => r.id));
    ignoredRoleIdsCache.set(ids);
    return ids;
  }

  async function getRequiredVersionIds(
    schema: unknown
  ): Promise<{ agbId: string; dataProtectionId: string } | null> {
    const cached = requiredVersionIdsCache.get();
    // null is a valid cached value (means "versions not configured") — only
    // skip the cache when the entry itself has never been set.
    if (cached !== null && requiredVersionIdsCache.get() !== null) return cached;

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

    const result =
      agb && dp ? { agbId: agb.id, dataProtectionId: dp.id } : null;

    requiredVersionIdsCache.set(result);
    return result;
  }

  async function userHasAcceptedRequiredAgreements(
    userId: string | number,
    schema: unknown
  ): Promise<boolean> {
    const versionIds = await getRequiredVersionIds(schema);

    // If the agreements aren't configured we fail open — throwing here would
    // lock every user out of the system until an admin publishes versions.
    if (!versionIds) return true;

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
  // We gate create + update only. Blocking `items.read` with a consent check
  // is dangerous: the consent module itself needs to read `agreement_versions`
  // to show the user what they're accepting. The CONSENT_COLLECTIONS exclusion
  // mitigates this partially, but any future collection added to the consent
  // flow must also be added to that list — an easy mistake to make.
  //
  // If you need to restrict reads too, reinstate 'items.read' here and extend
  // CONSENT_COLLECTIONS to include every collection the acceptance flow touches.

  const GATED_EVENTS = ['items.create', 'items.update'] as const;

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

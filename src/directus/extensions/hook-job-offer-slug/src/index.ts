import { defineHook } from '@directus/extensions-sdk';
import type { Database } from '@directus/types';
import slugify from 'slugify';

const COLLECTION = 'job_offers';
const FALLBACK_SLUG = 'jobangebot';
const MAX_BASE_LENGTH = 90;

const slugifyConfig = {
  replacement: '-',
  remove: undefined,
  lower: true,
  strict: true,
  locale: 'de',
  trim: true,
} as const;

type JobOfferPayload = {
  role_title?: unknown;
  slug?: unknown;
};

type HookMeta = {
  collection?: string;
  keys?: Array<string | number>;
};

function normalizeSlug(value: unknown): string {
  const slug = slugify(String(value ?? ''), slugifyConfig)
    .slice(0, MAX_BASE_LENGTH)
    .replace(/-+$/g, '');

  return slug || FALLBACK_SLUG;
}

async function makeUniqueSlug(
  database: Database,
  baseSlug: string,
  currentId?: string | number
): Promise<string> {
  let slug = baseSlug;
  let suffix = 2;

  while (true) {
    const query = database(COLLECTION).where({ slug }).select('id').first();

    if (currentId !== undefined) {
      query.andWhereNot('id', currentId);
    }

    const existing = await query;
    if (!existing) return slug;

    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

async function getExistingJobOffer(
  database: Database,
  id: string | number
): Promise<{ role_title?: string | null; slug?: string | null } | null> {
  const existing = await database(COLLECTION)
    .where({ id })
    .select('role_title', 'slug')
    .first();

  return existing ?? null;
}

export default defineHook(({ filter }) => {
  filter('items.create', async (payload: JobOfferPayload, meta: HookMeta, { database }) => {
    if (meta.collection !== COLLECTION) return payload;

    const providedSlug = String(payload.slug ?? '').trim();
    const baseSlug = normalizeSlug(providedSlug || payload.role_title);

    return {
      ...payload,
      slug: await makeUniqueSlug(database, baseSlug),
    };
  });

  filter('items.update', async (payload: JobOfferPayload, meta: HookMeta, { database }) => {
    if (meta.collection !== COLLECTION) return payload;

    const key = meta.keys?.length === 1 ? meta.keys[0] : undefined;
    const providedSlug = String(payload.slug ?? '').trim();

    if (providedSlug) {
      return {
        ...payload,
        slug: await makeUniqueSlug(database, normalizeSlug(providedSlug), key),
      };
    }

    if (key === undefined) return payload;

    const existing = await getExistingJobOffer(database, key);
    if (!existing || existing.slug) return payload;

    const roleTitle = payload.role_title ?? existing.role_title;

    return {
      ...payload,
      slug: await makeUniqueSlug(database, normalizeSlug(roleTitle), key),
    };
  });
});

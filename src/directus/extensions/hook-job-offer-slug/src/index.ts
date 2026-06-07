import { defineHook } from '@directus/extensions-sdk';
import type { Database } from '@directus/types';
import slugify from 'slugify';

const JOB_OFFERS = 'job_offers';
const MAX_BASE_LENGTH = 90;

const slugifyConfig = {
  replacement: '-',
  remove: undefined,
  lower: true,
  strict: true,
  locale: 'de',
  trim: true,
} as const;

type Payload = Record<string, unknown> & {
  name?: unknown;
  role_title?: unknown;
  slug?: unknown;
};

type HookMeta = {
  collection?: string;
  keys?: Array<string | number>;
};

const createSlugFromNameCollections = new Set(['pages', 'municipalities', 'measures']);
const updateSlugFromNameCollections = new Set(['municipalities', 'measures']);

function slugifyText(value: unknown): string {
  return slugify(String(value ?? ''), slugifyConfig);
}

function normalizeSlug(value: unknown): string {
  return slugifyText(value)
    .slice(0, MAX_BASE_LENGTH)
    .replace(/-+$/g, '');
}

async function makeUniqueSlug(
  database: Database,
  baseSlug: string,
  currentId?: string | number
): Promise<string> {
  if (!baseSlug) return baseSlug;

  let slug = baseSlug;
  let suffix = 2;

  while (true) {
    const query = database(JOB_OFFERS).where({ slug }).select('id').first();

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
  const existing = await database(JOB_OFFERS)
    .where({ id })
    .select('role_title', 'slug')
    .first();

  return existing ?? null;
}

export default defineHook(({ filter }) => {
  filter('items.create', async (payload: Payload, meta: HookMeta, { database }) => {
    if (meta.collection && createSlugFromNameCollections.has(meta.collection)) {
      return {
        ...payload,
        slug: slugifyText(payload.name),
      };
    }

    if (meta.collection !== JOB_OFFERS) return payload;

    const providedSlug = String(payload.slug ?? '').trim();
    const baseSlug = normalizeSlug(providedSlug || payload.role_title);

    return {
      ...payload,
      slug: await makeUniqueSlug(database, baseSlug),
    };
  });

  filter('items.update', async (payload: Payload, meta: HookMeta, { database }) => {
    if (meta.collection && updateSlugFromNameCollections.has(meta.collection) && payload.name !== null && payload.name !== undefined) {
      return {
        ...payload,
        slug: slugifyText(payload.name),
      };
    }

    if (meta.collection !== JOB_OFFERS) return payload;

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

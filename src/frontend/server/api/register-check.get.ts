import { defineEventHandler, getQuery } from 'h3';
import { useRuntimeConfig } from '#imports';

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const query = getQuery(event);
  const ars = query.ars as string | undefined;

  if (!ars || typeof ars !== 'string') {
    return { hasTeam: false, slug: null, percentageRated: null, published: false };
  }

  const serverToken = config.directusFrontendServerToken;
  if (!serverToken) {
    return { hasTeam: false, slug: null, percentageRated: null, published: false };
  }

  const directusUrl = config.directusServerUrl || 'http://directus:8055';

  try {
    // Check for existing localteam by ARS
    const response: any = await $fetch(`${directusUrl}/items/municipalities`, {
      headers: { Authorization: `Bearer ${serverToken}` },
      query: {
        filter: JSON.stringify({
          _and: [
            { localteam_id: { _nnull: true } },
            { ars: { _eq: ars } },
          ],
        }),
        fields: 'ars,slug,localteam_id,scores.catalog_version.id,scores.catalog_version.isCurrentBackend,scores.published,scores.percentage_rated',
        limit: 1,
      },
    });

    const municipality = response?.data?.[0];
    if (!municipality?.localteam_id) {
      return { hasTeam: false, slug: null, percentageRated: null, published: false };
    }

    // Find the score for the current backend catalog
    const score = (municipality.scores ?? []).find((item: any) => {
      return item.catalog_version?.isCurrentBackend === true;
    });

    return {
      hasTeam: true,
      slug: municipality.slug ?? null,
      percentageRated: score?.percentage_rated ?? null,
      published: score?.published === true,
    };
  } catch {
    return { hasTeam: false, slug: null, percentageRated: null, published: false };
  }
});


import { defineEventHandler, getQuery } from 'h3';
import { useRuntimeConfig } from '#imports';

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const query = getQuery(event);
  const ars = query.ars as string | undefined;

  if (!ars || typeof ars !== 'string') {
    return { hasTeam: false, slug: null, percentageRated: null, published: false };
  }

  const serverToken = config.directusFrontendServerToken || config.directusAdminToken;
  if (!serverToken) {
    return { hasTeam: false, slug: null, percentageRated: null, published: false };
  }

  const directusUrl = config.directusServerUrl || 'http://directus:8055';

  try {
    // Get current backend catalog version
    const catalogResponse: any = await $fetch(`${directusUrl}/items/catalog_versions`, {
      headers: { Authorization: `Bearer ${serverToken}` },
      query: {
        filter: JSON.stringify({ isCurrentBackend: { _eq: true } }),
        fields: 'id',
        limit: 1,
      },
    });

    const currentCatalogId = catalogResponse?.data?.[0]?.id;
    if (!currentCatalogId) {
      return { hasTeam: false, slug: null, percentageRated: null, published: false };
    }

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
        fields: 'ars,slug,localteam_id,scores.catalog_version,scores.published,scores.percentage_rated',
        limit: 1,
      },
    });

    const municipality = response?.data?.[0];
    if (!municipality?.localteam_id) {
      return { hasTeam: false, slug: null, percentageRated: null, published: false };
    }

    // Find the score for the current backend catalog
    const score = (municipality.scores ?? []).find((item: any) => {
      const catalogVersion = typeof item.catalog_version === 'object'
        ? item.catalog_version?.id
        : item.catalog_version;
      return catalogVersion === currentCatalogId;
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

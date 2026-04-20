<template>
  <main class="px-4 sm:px-6 lg:px-8 py-4 sm:py-8 max-w-4xl mx-auto w-full min-w-0">
    <div class="flex bg-blue-100 rounded-lg border-blue-600 drop-shadow-md border mx-0 my-4 p-3 sm:p-4 justify-center">
      <AdministrativeAreaSearchBar base-path="/stats" />
    </div>

    <!-- Main Info Container -->
    <div class="bg-white rounded-lg shadow-lg overflow-hidden mt-6 min-w-0 max-w-full">
      <!-- Breadcrumbs -->
      <div v-if="area?.contained_by?.length" class="breadcrumbs bg-gray-50 px-3 sm:px-4 lg:px-6 py-3 text-sm text-gray-600 overflow-x-auto">
        <ul class="flex flex-row flex-nowrap items-center min-w-0">
          <li v-for="containedArea in area.contained_by" :key="containedArea.ars" class="flex-shrink-0">
            <NuxtLink :to="`/regions/${containedArea.ars}`" class="hover:underline whitespace-nowrap text-xs sm:text-sm">
              {{ containedArea.prefix }} {{ containedArea.name }}
            </NuxtLink>
          </li>
        </ul>
      </div>

      <!-- Header Section -->
      <div class="flex flex-col lg:flex-row w-full justify-between bg-gradient-to-r from-green-50 to-teal-50 px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8 gap-4 lg:gap-0 overflow-hidden">
        <div class="flex-1 min-w-0 max-w-full">
          <p class="text-sm font-semibold text-gray-600 uppercase tracking-wide">
            {{ area?.prefix || $t('generic.loading') }}
          </p>
          <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 mb-2 break-words">
            {{ area?.name || $t('generic.loading') }}
          </h1>
          <p class="text-base lg:text-lg text-gray-600">{{ area?.state || '' }}</p>
        </div>
        <div class="flex flex-col lg:text-right space-y-3 flex-shrink-0">
          <div class="lg:text-right">
            <p class="text-xs text-gray-500 font-semibold">ARS</p>
            <p class="text-sm font-mono text-gray-700">{{ area?.ars || '-' }}</p>
          </div>
          <div class="lg:text-right">
            <p class="text-xs text-gray-500 font-semibold">{{ t('region.municipalities_count', 'Kommunen') }}</p>
            <p class="text-sm font-bold text-gray-700">{{ municipalities.length }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Map Section -->
    <div v-if="area && (area.geo_center || area.geo_area)" class="mt-6 bg-base-100 shadow-md overflow-hidden max-w-full">
      <AdministrativeAreaMap
        :geo-center="area.geo_center"
        :geo-area="area.geo_area"
        :administrative-area-name="area.name"
      />
    </div>

    <!-- Ranking Section -->
    <div class="mt-6 bg-white rounded-lg shadow-md overflow-hidden">
      <div class="px-4 py-4 border-b border-gray-200 flex items-center justify-between">
        <h2 class="text-lg font-semibold text-gray-900">
          {{ t('region.ranking_title', 'Kommunen-Ranking in dieser Region') }}
        </h2>
        <div v-if="selectedCatalogVersion" class="text-xs text-gray-500 font-mono">
          {{ selectedCatalogVersion.name }}
        </div>
      </div>

      <!-- Loading -->
      <div v-if="loadingMunicipalities" class="flex items-center justify-center py-12 gap-2">
        <SlkFlowerSpinner :size="32" />
        <span class="text-gray-600">{{ $t('generic.loading') }}...</span>
      </div>

      <!-- Ranked List -->
      <div v-else-if="rankedMunicipalities.length > 0" class="divide-y divide-gray-100">
        <div
          v-for="(muni, index) in rankedMunicipalities"
          :key="muni.ars"
          class="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
        >
          <!-- Rank -->
          <div class="w-8 text-center flex-shrink-0">
            <span class="text-sm font-bold text-gray-400">#{{ index + 1 }}</span>
          </div>

          <!-- Name & prefix -->
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-gray-900 truncate">{{ muni.name }}</p>
            <p class="text-xs text-gray-500">{{ muni.prefix }}</p>
          </div>

          <!-- Score badge -->
          <div class="flex-shrink-0 flex items-center gap-2">
            <div v-if="muni.score !== null" class="text-right">
              <span class="text-sm font-bold text-green-700">{{ muni.score.toFixed(1) }}</span>
              <span class="text-xs text-gray-400 ml-0.5">Pkt</span>
            </div>
            <NuxtLink
              v-if="muni.slug"
              :to="`/municipalities/${muni.slug}`"
              class="inline-flex items-center px-2.5 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full hover:bg-green-200 transition-colors whitespace-nowrap"
            >
              {{ t('region.view_rating', 'Bewertung') }}
              <svg class="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </NuxtLink>
            <NuxtLink
              v-else
              :to="`/stats/${muni.ars}`"
              class="inline-flex items-center px-2.5 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 transition-colors whitespace-nowrap"
            >
              {{ t('stats.view_stats', 'Statistiken') }}
              <svg class="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </NuxtLink>
          </div>
        </div>
      </div>

      <!-- Unrated municipalities (no score) -->
      <div v-if="unratedMunicipalities.length > 0" class="border-t border-gray-200">
        <button
          class="w-full px-4 py-3 text-left text-sm text-gray-500 hover:bg-gray-50 flex items-center justify-between"
          @click="showUnrated = !showUnrated"
        >
          <span>{{ unratedMunicipalities.length }} {{ t('region.unrated_municipalities', 'weitere Kommunen ohne Bewertung') }}</span>
          <svg class="w-4 h-4 transition-transform" :class="showUnrated ? 'rotate-180' : ''" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <div v-if="showUnrated" class="divide-y divide-gray-100">
          <div
            v-for="muni in unratedMunicipalities"
            :key="muni.ars"
            class="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
          >
            <div class="w-8 flex-shrink-0">
              <span class="text-xs text-gray-300">-</span>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm text-gray-600 truncate">{{ muni.name }}</p>
              <p class="text-xs text-gray-400">{{ muni.prefix }}</p>
            </div>
            <NuxtLink
              :to="`/stats/${muni.ars}`"
              class="inline-flex items-center px-2.5 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200 transition-colors whitespace-nowrap"
            >
              {{ t('stats.view_stats', 'Statistiken') }}
              <svg class="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </NuxtLink>
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div v-else-if="!loadingMunicipalities && municipalities.length === 0" class="py-12 text-center text-gray-500">
        <svg class="mx-auto h-12 w-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.29-1.016-5.707-2.572" />
        </svg>
        <p class="mt-2 text-sm">{{ t('region.no_municipalities', 'Keine Kommunen gefunden') }}</p>
      </div>
    </div>
  </main>
</template>

<script setup>
import { useRoute } from 'vue-router';
import { ref, computed, onMounted } from 'vue';
import { getCatalogVersion } from '~/composables/getCatalogVersion.js';

const route = useRoute();
const { $t, $stadtlandzahlAPI } = useNuxtApp();
const { $directus, $readItems } = useNuxtApp();

const selectedCatalogVersion = ref(await getCatalogVersion($directus, $readItems, route));

const area = ref(null);
const municipalities = ref([]);
const loadingMunicipalities = ref(false);
const showUnrated = ref(false);

const t = (key, fallback) => {
  const translation = $t(key);
  return translation === key ? fallback : translation;
};

// Derive a significant ARS prefix by stripping trailing zeros
function getArsPrefix(ars) {
  const trimmed = ars.replace(/0+$/, '');
  return trimmed.length > 0 ? trimmed : null;
}

// Fetch all municipalities within this region, paging through all results
async function fetchMunicipalitiesInRegion(regionArs) {
  const runtimeConfig = useRuntimeConfig();
  const stadtlandzahlURL = runtimeConfig.public.stadtlandzahlUrl;
  if (!stadtlandzahlURL) return [];

  const prefix = getArsPrefix(regionArs);
  const arsFilter = prefix ? `, ars_Icontains: "${prefix}"` : '';
  const PAGE_SIZE = 500;
  const nodes = [];
  let cursor = null;

  while (true) {
    const afterArg = cursor ? `, after: "${cursor}"` : '';
    const query = `{ allAdministrativeAreas(first: ${PAGE_SIZE}${afterArg}, isReasonableForMunicipalRating: true${arsFilter}, orderBy: "-population") { pageInfo { hasNextPage endCursor } edges { node { ars name prefix level population stadtlandklimaDataAll { slug scoreTotal percentageRated measureCatalogName } } } } }`;

    try {
      const response = await fetch(stadtlandzahlURL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const connection = data?.data?.allAdministrativeAreas;
      if (!connection) break;

      for (const edge of connection.edges ?? []) {
        nodes.push(edge.node);
      }

      if (!connection.pageInfo?.hasNextPage) break;
      cursor = connection.pageInfo.endCursor;
    } catch (e) {
      console.error('fetchMunicipalitiesInRegion error:', e);
      break;
    }
  }

  return nodes;
}

// Municipalities sorted by score for the current catalog version
const rankedMunicipalities = computed(() => {
  const catalogName = selectedCatalogVersion.value?.name;
  return municipalities.value
    .map(m => {
      const entry = catalogName
        ? m.stadtlandklimaDataAll?.find(d => d.measureCatalogName === catalogName && d.percentageRated >= 98)
        : null;
      return {
        ars: m.ars,
        name: m.name,
        prefix: m.prefix,
        population: m.population,
        slug: entry?.slug ?? null,
        score: entry?.scoreTotal ?? null,
      };
    })
    .filter(m => m.score !== null)
    .sort((a, b) => b.score - a.score);
});

const unratedMunicipalities = computed(() => {
  const ratedArs = new Set(rankedMunicipalities.value.map(m => m.ars));
  return municipalities.value
    .filter(m => !ratedArs.has(m.ars))
    .map(m => ({ ars: m.ars, name: m.name, prefix: m.prefix }));
});

const pageTitle = computed(() => {
  if (area.value?.name) {
    return area.value.prefix ? `${area.value.prefix} ${area.value.name}` : area.value.name;
  }
  return 'Region';
});

useHead({ title: pageTitle });

onMounted(async () => {
  loadingMunicipalities.value = true;
  try {
    const [areaData, munis] = await Promise.all([
      $stadtlandzahlAPI.fetchStatsByARS(route.params.ars),
      fetchMunicipalitiesInRegion(route.params.ars),
    ]);

    if (areaData) {
      // If someone navigates here directly with a level 4+ ARS, redirect to /stats/
      if (areaData.level >= 4) {
        await navigateTo(`/stats/${route.params.ars}`, { replace: true });
        return;
      }
      area.value = areaData;
    }

    municipalities.value = munis;
  } catch (e) {
    console.error('Error loading region:', e);
  } finally {
    loadingMunicipalities.value = false;
  }
});
</script>

<template>
  <div class="px-4 sm:px-6 lg:px-8 py-4 sm:py-8 max-w-5xl mx-auto w-full min-w-0 overflow-hidden">

    <!-- Title -->
    <div class="mb-4 mt-4">
      <h1 class="text-4xl font-bold text-gray">{{ $t("measures.heading") }}</h1>
      <p class="mt-2 text-sm text-gray-600 max-w-2xl">{{ $t("measures.description") }}</p>
    </div>

    <!-- Filter + Sort bar -->
    <div class="slk-filter-panel slk-filter-theme-neutral mb-6 flex flex-col gap-0 p-3 shadow-md">
      <!-- Collapsible toggle (only shown below xs breakpoint) -->
      <button
        class="slk-filter-panel-icon flex w-full items-center justify-between py-1 text-sm font-medium xs:hidden"
        @click="filterOpen = !filterOpen"
      >
        <span class="flex items-center gap-2">
          <svg class="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M3 4a1 1 0 011-1h16a1 1 0 01.707 1.707L14 12.414V19a1 1 0 01-1.447.894l-4-2A1 1 0 018 17v-4.586L3.293 5.707A1 1 0 013 5V4z"
            />
          </svg>
          <span>{{ $t("generic.filter_and_view") }}</span>
          <span
            v-if="activeFilterCount > 0"
            class="slk-filter-count rounded-full px-1.5 py-0.5 text-xs font-bold leading-none"
            >{{ activeFilterCount }}</span
          >
        </span>
        <svg
          class="h-4 w-4 flex-shrink-0 transition-transform duration-200"
          :class="filterOpen ? 'rotate-180' : ''"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <!-- Filter rows (always visible at xs+, collapsible below xs) -->
      <div v-show="filterOpen" class="xs:!block">
        <!-- Row 0: Catalog version + view toggle -->
        <div class="grid grid-cols-[1.5rem_1fr] items-center gap-x-2 py-1.5">
          <svg
            class="slk-filter-panel-icon h-4 w-4 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <div class="flex flex-wrap items-center gap-2">
            <NuxtLink
              v-for="cv in allVersions"
              :key="cv.id"
              :to="{ path: '/measures', query: { v: cv.name, ...(selectedSector ? { sector: selectedSector } : {}) } }"
              class="slk-filter-pill"
              :class="currentCatalogVersion.id === cv.id ? 'slk-filter-pill--active' : ''"
            >
              {{ cv.name }}{{ cv.isCurrentFrontend ? " ✓" : "" }}
            </NuxtLink>

            <!-- vertical divider -->
            <div class="slk-filter-divider mx-1 w-px self-stretch" />

            <!-- View toggle -->
            <button
              type="button"
              @click="viewMode = 'list'"
              class="slk-filter-pill"
              :class="viewMode === 'list' ? 'slk-filter-pill--active' : ''"
            >
              <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              {{ $t("generic.view.list") }}
            </button>
            <button
              type="button"
              @click="viewMode = 'cards'"
              class="slk-filter-pill"
              :class="viewMode === 'cards' ? 'slk-filter-pill--active' : ''"
            >
              <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                />
              </svg>
              {{ $t("generic.view.cards") }}
            </button>
            <button
              type="button"
              @click="viewMode = 'treemap'"
              class="slk-filter-pill"
              :class="viewMode === 'treemap' ? 'slk-filter-pill--active' : ''"
            >
              <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10-3a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1v-7z"
                />
              </svg>
              {{ $t("generic.view.treemap") }}
            </button>
          </div>
        </div>

        <div class="slk-filter-rule my-0.5 border-t" />

        <!-- Row 1: Sector filter -->
        <div class="grid grid-cols-[1.5rem_1fr] items-start gap-x-2 py-1.5">
          <svg
            class="slk-filter-panel-icon mt-1 h-4 w-4 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M3 4a1 1 0 011-1h16a1 1 0 01.707 1.707L14 12.414V19a1 1 0 01-1.447.894l-4-2A1 1 0 018 17v-4.586L3.293 5.707A1 1 0 013 5V4z"
            />
          </svg>
          <div class="flex flex-wrap gap-2">
            <button
              class="slk-filter-pill"
              :class="selectedSector === null ? 'slk-filter-pill--active' : ''"
              @click="setSector(null)"
            >
              {{ $t("measure_sectors.all") }}
            </button>
            <button
              v-for="sector in SECTORS"
              :key="sector"
              class="slk-filter-pill"
              :class="selectedSector === sector ? 'slk-filter-pill--active' : ''"
              @click="setSector(sector)"
            >
              <img
                :src="sectorImages[sector]"
                class="slk-filter-sector-icon h-6 w-6 flex-shrink-0 mix-blend-multiply grayscale invert"
                :class="selectedSector === sector ? 'opacity-100' : 'opacity-40'"
                alt=""
              />
              {{ $t(`measure_sectors.${sector}.title`) }}
            </button>
          </div>
        </div>

        <div class="slk-filter-rule my-0.5 border-t" />

        <!-- Row 2: Quick-filter toggles -->
        <div class="grid grid-cols-[1.5rem_1fr] items-center gap-x-2 py-1.5">
          <svg
            class="slk-filter-panel-icon h-4 w-4 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              @click="filterHighImpact = !filterHighImpact"
              class="slk-filter-pill"
              :class="filterHighImpact ? 'slk-filter-pill--active' : ''"
            >
              <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
              {{ $t("measures.filters.high_impact") }}
            </button>
            <button
              type="button"
              @click="filterLowCost = !filterLowCost"
              class="slk-filter-pill"
              :class="filterLowCost ? 'slk-filter-pill--active' : ''"
            >
              <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              {{ $t("measures.filters.low_cost") }}
            </button>
            <button
              type="button"
              @click="filterLowControversy = !filterLowControversy"
              class="slk-filter-pill"
              :class="filterLowControversy ? 'slk-filter-pill--active' : ''"
            >
              <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              {{ $t("measures.filters.low_resistance") }}
            </button>
          </div>
        </div>

        <template v-if="viewMode === 'list' || viewMode === 'cards'">
          <div class="slk-filter-rule my-0.5 border-t" />

          <!-- Row 3: Sort -->
          <div class="grid grid-cols-[1.5rem_1fr] items-center gap-x-2 py-1.5">
            <svg
              class="slk-filter-panel-icon h-4 w-4 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 6h18M7 12h10M11 18h2" />
            </svg>
            <div class="flex flex-wrap gap-2">
              <button
                type="button"
                @click="sortOrder = 'id'"
                class="slk-filter-pill"
                :class="sortOrder === 'id' ? 'slk-filter-pill--active' : ''"
              >
                {{ $t("measures.sort.by_id") }}
              </button>
              <button
                type="button"
                @click="sortOrder = 'name'"
                class="slk-filter-pill"
                :class="sortOrder === 'name' ? 'slk-filter-pill--active' : ''"
              >
                {{ $t("measures.sort.alphabetical") }}
              </button>
              <button
                type="button"
                @click="sortOrder = 'impact'"
                class="slk-filter-pill"
                :class="sortOrder === 'impact' ? 'slk-filter-pill--active' : ''"
              >
                {{ $t("measures.sort.impact_desc") }}
              </button>
              <button
                type="button"
                @click="sortOrder = 'economical'"
                class="slk-filter-pill"
                :class="sortOrder === 'economical' ? 'slk-filter-pill--active' : ''"
              >
                {{ $t("measures.sort.cost_asc") }}
              </button>
              <button
                type="button"
                @click="sortOrder = 'political'"
                class="slk-filter-pill"
                :class="sortOrder === 'political' ? 'slk-filter-pill--active' : ''"
              >
                {{ $t("measures.sort.resistance_asc") }}
              </button>
            </div>
          </div>
        </template>
      </div>
      <!-- /collapsible -->
    </div>

    <!-- Sector description (shown when a sector is selected) -->
    <div v-if="selectedSector" class="mb-4 bg-gray/5 border-l-4 border-gray/30 px-4 py-3 text-sm text-gray-700 max-w-2xl">
      <p class="font-bold mb-1">{{ $t(`measure_sectors.${selectedSector}.title`) }}</p>
      <p>{{ $t(`measure_sectors.${selectedSector}.description`) }}</p>
    </div>

    <!-- Result count (list / cards only) -->
    <p v-if="viewMode === 'list' || viewMode === 'cards'" class="text-sm text-gray-500 mb-4">{{ filteredMeasures.length }} Maßnahmen</p>

    <!-- Treemap view -->
    <ClientOnly>
      <MeasuresTreemap
        v-if="viewMode === 'treemap'"
        :measures="filteredMeasures"
        :on-navigate="(slug) => router.push(`/measures/${slug}?v=${currentCatalogVersion.name}`)"
        class="mb-8"
      />
    </ClientOnly>

    <!-- Cards view -->
    <div v-if="viewMode === 'cards'" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
      <MeasureCard
        v-for="measure in filteredMeasures"
        :key="measure.measure_id"
        :to="`/measures/${measure.slug}?v=${currentCatalogVersion.name}`"
        :measure_id="measure.measure_id"
        :name="measure.name"
        :sector="measure.sector"
        :description="truncateHtml(measure.description_about)"
        :image_id="measure.image || null"
        :image_credits="measure.image_credits || null"
      />
    </div>

    <!-- List view -->
    <div v-if="viewMode === 'list'" class="grid grid-cols-1 gap-2">
      <NuxtLink
        v-for="measure in filteredMeasures"
        :key="measure.measure_id"
        :to="`/measures/${measure.slug}?v=${currentCatalogVersion.name}`"
        class="card rounded-md border border-gray/20 shadow hover:shadow-lg transition-shadow duration-200 block"
      >
        <div class="card-body">
          <div class="flex items-start gap-3">
            <img :src="sectorImages[measure.sector]" class="w-7 h-7 opacity-50 flex-shrink-0 mt-0.5" alt="" />
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2 flex-wrap mb-1">
                <span class="font-mono bg-gray text-white text-xs px-2 py-0.5 rounded flex-shrink-0">{{ measure.measure_id }}</span>
                <h2 class="font-heading font-bold text-gray text-sm leading-snug">{{ measure.name }}</h2>
              </div>
              <p v-if="measure.description_about" class="text-xs text-gray-500 line-clamp-2">
                {{ truncateHtml(measure.description_about) }}
              </p>
            </div>
          </div>
        </div>
      </NuxtLink>
    </div>

    <!-- Link to the measure catalog -->
    <div class="mt-12 flex justify-center">
      <NuxtLink
        v-if="currentCatalogVersion.name === 'v1.0'"
        :to="`/backend/assets/ac1df0cd-8a57-4082-bdd3-432f43e4a374.xslx`"
      >
        <button class="p-4 flex items-center justify-end text-white bg-gray h-10">{{ $t("measure_catalog.download") }} ({{ currentCatalogVersion.name }})</button>
      </NuxtLink>
      <NuxtLink
        v-if="currentCatalogVersion.name === 'beta'"
        :to="`/backend/assets/9c270dd0-52dc-449b-9c2e-bbd5d5b829.xslx`"
      >
        <button class="p-4 flex items-center justify-end text-white bg-gray h-10">{{ $t("measure_catalog.download") }} ({{ currentCatalogVersion.name }})</button>
      </NuxtLink>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, watch } from "vue";
import sectorImages from "~/shared/sectorImages.js";

const SECTORS = ['energy', 'agriculture', 'transport', 'industry', 'buildings', 'management'];

const { $directus, $readItems, $t } = useNuxtApp();
const route = useRoute();
const router = useRouter();
let selectedCatalogVersion = await getCatalogVersion($directus, $readItems, route, true);
const currentCatalogVersion = ref(selectedCatalogVersion);

onMounted(() => {
  setCatalogVersionUrl(route, router, selectedCatalogVersion);
});

const title = ref($t("measures.nav_label"));
useHead({ title });

// Fetch all non-hidden catalog versions for the version filter row
const { data: allVersions } = await useAsyncData('measure-catalog-versions', () => {
  return $directus.request(
    $readItems("measure_catalog", {
      fields: ["id", "name", "isCurrentFrontend"],
      filter: { hidden: { _eq: false } },
      sort: "-name",
      limit: -1,
    })
  );
});

async function fetchMeasures(catalogVersionId) {
  return useAsyncData(`measures-index-${catalogVersionId}`, () => {
    return $directus.request(
      $readItems("measures", {
        fields: ["measure_id", "name", "slug", "sector", "description_about", "impact", "feasibility_economical", "feasibility_political", "weight", "image", "image_credits"],
        filter: { catalog_version: { _eq: catalogVersionId } },
        sort: "measure_id",
        limit: -1,
      }),
    );
  });
}

let { data: measureList } = await fetchMeasures(selectedCatalogVersion.id);

// ── Re-fetch when catalog version changes ────────────────────────────────────
watch(
  () => route.query.v,
  async (newV, oldV) => {
    if (newV === oldV) return;
    selectedCatalogVersion = await getCatalogVersion($directus, $readItems, route, true);
    currentCatalogVersion.value = selectedCatalogVersion;
    const { data: newData } = await fetchMeasures(selectedCatalogVersion.id);
    measureList.value = newData.value;
  }
);

// ── Filter state ────────────────────────────────────────────────────────────
const selectedSector = ref(route.query.sector || null);
const viewMode = ref(route.query.view === 'treemap' ? 'treemap' : route.query.view === 'cards' ? 'cards' : 'list');
const filterHighImpact = ref(false);
const filterLowCost = ref(false);
const filterLowControversy = ref(false);
const sortOrder = ref('id'); // 'id' | 'name' | 'impact' | 'economical' | 'political'

const filterOpen = ref(false);
const activeFilterCount = computed(() => {
  let count = 0;
  if (selectedSector.value) count++;
  if (filterHighImpact.value) count++;
  if (filterLowCost.value) count++;
  if (filterLowControversy.value) count++;
  return count;
});

function setSector(sector) {
  selectedSector.value = sector;
  router.replace({ query: { ...route.query, sector: sector || undefined } });
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function stripHtml(html) {
  if (!html) return '';
  if (process.client) {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || '';
  }
  // SSR: decode common HTML entities then strip tags
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&auml;/g, 'ä').replace(/&Auml;/g, 'Ä')
    .replace(/&ouml;/g, 'ö').replace(/&Ouml;/g, 'Ö')
    .replace(/&uuml;/g, 'ü').replace(/&Uuml;/g, 'Ü')
    .replace(/&szlig;/g, 'ß').replace(/&eacute;/g, 'é').replace(/&egrave;/g, 'è')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\s+/g, ' ').trim();
}

function truncateHtml(html, maxLen = 130) {
  const text = stripHtml(html);
  return text.length > maxLen ? text.slice(0, maxLen) + '…' : text;
}

// ── Filtered + sorted list ───────────────────────────────────────────────────
const filteredMeasures = computed(() => {
  if (!measureList.value) return [];

  let list = measureList.value;
  if (selectedSector.value) list = list.filter(m => m.sector === selectedSector.value);
  if (filterHighImpact.value) list = list.filter(m => (m.impact ?? 0) >= 4);
  if (filterLowCost.value) list = list.filter(m => (m.feasibility_economical ?? 0) >= 4);
  if (filterLowControversy.value) list = list.filter(m => (m.feasibility_political ?? 0) >= 4);

  const sorted = [...list];
  if (sortOrder.value === 'name') {
    sorted.sort((a, b) => a.name.localeCompare(b.name, 'de'));
  } else if (sortOrder.value === 'impact') {
    sorted.sort((a, b) => (b.impact ?? 0) - (a.impact ?? 0));
  } else if (sortOrder.value === 'economical') {
    sorted.sort((a, b) => (b.feasibility_economical ?? 0) - (a.feasibility_economical ?? 0));
  } else if (sortOrder.value === 'political') {
    sorted.sort((a, b) => (b.feasibility_political ?? 0) - (a.feasibility_political ?? 0));
  }
  // 'id' keeps server sort: measure_id

  return sorted;
});
</script>

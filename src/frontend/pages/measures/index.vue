<template>
  <div class="px-4 sm:px-6 lg:px-8 py-4 sm:py-8 max-w-5xl mx-auto w-full min-w-0 overflow-hidden">

    <!-- Title -->
    <div class="mb-4 mt-4">
      <h1 class="text-4xl font-bold text-gray">{{ $t("measures.heading") }}</h1>
      <p class="mt-2 text-sm text-gray-600 max-w-2xl">{{ $t("measures.description") }}</p>
    </div>

    <!-- Filter + Sort bar -->
    <div class="shadow-md flex flex-col gap-0 mb-6 p-3" style="background-color: #f2f2f2;">

      <!-- Row 0: Catalog version + view toggle -->
      <div class="grid grid-cols-[1.5rem_1fr] gap-x-2 items-center py-1.5">
        <svg class="w-4 h-4 flex-shrink-0 text-gray" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <div class="flex flex-wrap gap-2 items-center">
          <NuxtLink
            v-for="cv in allVersions"
            :key="cv.id"
            :to="{ path: '/measures', query: { v: cv.name, ...(selectedSector ? { sector: selectedSector } : {}) } }"
            class="inline-flex items-center px-2.5 py-1 rounded-full border transition text-xs font-bold"
            :class="currentCatalogVersion.id === cv.id
              ? 'bg-gray text-white border-gray'
              : 'bg-white border-gray text-gray hover:bg-[#f2f2f2]'"
          >
            {{ cv.name }}{{ cv.isCurrentFrontend ? ' ✓' : '' }}
          </NuxtLink>

          <!-- vertical divider -->
          <div class="self-stretch w-px bg-gray/20 mx-1" />

          <!-- View toggle -->
          <button
            type="button"
            @click="viewMode = 'list'"
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition text-xs font-bold"
            :class="viewMode === 'list' ? 'bg-gray text-white border-gray' : 'bg-white border-gray text-gray hover:bg-[#f2f2f2]'"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            Liste
          </button>
          <button
            type="button"
            @click="viewMode = 'treemap'"
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition text-xs font-bold"
            :class="viewMode === 'treemap' ? 'bg-gray text-white border-gray' : 'bg-white border-gray text-gray hover:bg-[#f2f2f2]'"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10-3a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1v-7z" />
            </svg>
            Treemap
          </button>
        </div>
      </div>

      <div class="border-t border-gray/20 my-0.5" />

      <!-- Row 1: Sector filter -->
      <div class="grid grid-cols-[1.5rem_1fr] gap-x-2 items-start py-1.5">
        <svg class="w-4 h-4 flex-shrink-0 mt-1 text-gray" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 01.707 1.707L14 12.414V19a1 1 0 01-1.447.894l-4-2A1 1 0 018 17v-4.586L3.293 5.707A1 1 0 013 5V4z" />
        </svg>
        <div class="flex flex-wrap gap-2">
          <button
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border-2 transition text-xs font-bold"
            :class="selectedSector === null ? 'bg-gray/10 border-gray text-gray' : 'bg-white border-gray/30 text-gray/60 hover:bg-gray/5 hover:border-gray/60'"
            @click="setSector(null)"
          >
            Alle Sektoren
          </button>
          <button
            v-for="sector in SECTORS"
            :key="sector"
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border-2 transition text-xs font-bold"
            :class="selectedSector === sector ? 'bg-gray/10 border-gray text-gray' : 'bg-white border-gray/30 text-gray/60 hover:bg-gray/5 hover:border-gray/60'"
            @click="setSector(sector)"
          >
            <img :src="sectorImages[sector]" class="w-6 h-6 flex-shrink-0 invert grayscale mix-blend-multiply" :class="selectedSector === sector ? 'opacity-100' : 'opacity-40'" alt="" />
            {{ $t(`measure_sectors.${sector}.title`) }}
          </button>
        </div>
      </div>

      <div class="border-t border-gray/20 my-0.5" />

      <!-- Row 2: Quick-filter toggles -->
      <div class="grid grid-cols-[1.5rem_1fr] gap-x-2 items-center py-1.5">
        <svg class="w-4 h-4 flex-shrink-0 text-gray" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            @click="filterHighImpact = !filterHighImpact"
            class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border transition-colors whitespace-nowrap"
            :class="filterHighImpact ? 'bg-gray text-white border-gray' : 'bg-white text-gray border-gray hover:bg-[#f2f2f2]'"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18"/></svg>
            Hohe Wirkung
          </button>
          <button
            type="button"
            @click="filterLowCost = !filterLowCost"
            class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border transition-colors whitespace-nowrap"
            :class="filterLowCost ? 'bg-gray text-white border-gray' : 'bg-white text-gray border-gray hover:bg-[#f2f2f2]'"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            Geringe Kosten
          </button>
          <button
            type="button"
            @click="filterLowControversy = !filterLowControversy"
            class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border transition-colors whitespace-nowrap"
            :class="filterLowControversy ? 'bg-gray text-white border-gray' : 'bg-white text-gray border-gray hover:bg-[#f2f2f2]'"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            Geringer Widerstand
          </button>
        </div>
      </div>

      <template v-if="viewMode === 'list'">
      <div class="border-t border-gray/20 my-0.5" />

      <!-- Row 3: Sort -->
      <div class="grid grid-cols-[1.5rem_1fr] gap-x-2 items-center py-1.5">
        <svg class="w-4 h-4 flex-shrink-0 text-gray" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3 6h18M7 12h10M11 18h2" />
        </svg>
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            @click="sortOrder = 'id'"
            class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border transition-colors whitespace-nowrap"
            :class="sortOrder === 'id' ? 'bg-gray text-white border-gray' : 'bg-white text-gray border-gray hover:bg-[#f2f2f2]'"
          >
            Nach ID
          </button>
          <button
            type="button"
            @click="sortOrder = 'name'"
            class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border transition-colors whitespace-nowrap"
            :class="sortOrder === 'name' ? 'bg-gray text-white border-gray' : 'bg-white text-gray border-gray hover:bg-[#f2f2f2]'"
          >
            A–Z
          </button>
          <button
            type="button"
            @click="sortOrder = 'impact'"
            class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border transition-colors whitespace-nowrap"
            :class="sortOrder === 'impact' ? 'bg-gray text-white border-gray' : 'bg-white text-gray border-gray hover:bg-[#f2f2f2]'"
          >
            ↑ Wirkung
          </button>
          <button
            type="button"
            @click="sortOrder = 'economical'"
            class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border transition-colors whitespace-nowrap"
            :class="sortOrder === 'economical' ? 'bg-gray text-white border-gray' : 'bg-white text-gray border-gray hover:bg-[#f2f2f2]'"
          >
            ↓ Kosten
          </button>
          <button
            type="button"
            @click="sortOrder = 'political'"
            class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border transition-colors whitespace-nowrap"
            :class="sortOrder === 'political' ? 'bg-gray text-white border-gray' : 'bg-white text-gray border-gray hover:bg-[#f2f2f2]'"
          >
            ↓ Widerstand
          </button>
        </div>
      </div>
      </template>
    </div>

    <!-- Sector description (shown when a sector is selected) -->
    <div v-if="selectedSector" class="mb-4 bg-gray/5 border-l-4 border-gray/30 px-4 py-3 text-sm text-gray-700 max-w-2xl">
      <p class="font-bold mb-1">{{ $t(`measure_sectors.${selectedSector}.title`) }}</p>
      <p>{{ $t(`measure_sectors.${selectedSector}.description`) }}</p>
    </div>

    <!-- Result count (list only) -->
    <p v-if="viewMode === 'list'" class="text-sm text-gray-500 mb-4">{{ filteredMeasures.length }} Maßnahmen</p>

    <!-- Treemap view -->
    <ClientOnly>
      <MeasuresTreemap
        v-if="viewMode === 'treemap'"
        :measures="filteredMeasures"
        :on-navigate="(slug) => router.push(`/measures/${slug}?v=${currentCatalogVersion.name}`)"
        class="mb-8"
      />
    </ClientOnly>

    <!-- List view -->
    <div v-if="viewMode === 'list'" class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <NuxtLink
        v-for="measure in filteredMeasures"
        :key="measure.measure_id"
        :to="`/measures/${measure.slug}?v=${currentCatalogVersion.name}`"
        class="card card-compact shadow hover:shadow-lg transition-shadow duration-200 block"
      >
        <div class="card-body">
          <div class="flex items-start gap-2">
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

    <!-- Download link -->
    <div class="mt-12 flex justify-center">
      <NuxtLink
        v-if="currentCatalogVersion.name === 'v1.0'"
        to="/backend/assets/ac1df0cd-8a57-4082-bdd3-432f43e4a374"
      >
        <button class="p-4 flex items-center justify-end text-white bg-gray h-10">{{ $t("measure_catalog.download") }} ({{ currentCatalogVersion.name }})</button>
      </NuxtLink>
      <NuxtLink
        v-if="currentCatalogVersion.name === 'beta'"
        to="/backend/assets/9c270dd0-52dc-449b-9c2e-bbd5d5b829"
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
        fields: ["measure_id", "name", "slug", "sector", "description_about", "impact", "feasibility_economical", "feasibility_political", "weight"],
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
const viewMode = ref(route.query.view === 'treemap' ? 'treemap' : 'list');
const filterHighImpact = ref(false);
const filterLowCost = ref(false);
const filterLowControversy = ref(false);
const sortOrder = ref('id'); // 'id' | 'name' | 'impact' | 'economical' | 'political'

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

<template>
  <div class="mx-auto w-full max-w-5xl min-w-0 overflow-hidden px-4 py-8 sm:px-6 lg:px-8">
    <header class="mb-8">
      <h1 class="mb-4 font-heading text-4xl font-black text-gray sm:text-6xl">{{ $t("measures.heading") }}</h1>
      <p class="max-w-3xl text-lg leading-relaxed text-gray">{{ $t("measures.description") }}</p>
      <div class="mt-6 flex flex-wrap gap-3">
        <CanonicalButton
          :label="$t('municipalities.heading')"
          href="/municipalities"
          icon-slug="mdi:format-list-numbered"
          color="gray"
          text-color="white"
        />
        <CanonicalButton
          :label="$t('stats.measures.title')"
          href="/stats#massnahmenstatistiken"
          icon-slug="mdi:chart-bar"
          color="gray"
          text-color="white"
        />
      </div>
    </header>

    <!-- Filter + Sort bar -->
    <div class="slk-filter-panel slk-filter-theme-neutral mb-6 flex flex-col gap-0 p-3 shadow-md">
      <!-- Collapsible toggle (only shown below xs breakpoint) -->
      <button
        class="slk-filter-panel-icon flex w-full items-center justify-between py-1 text-sm font-medium xs:hidden"
        @click="filterOpen = !filterOpen"
      >
        <span class="flex items-center gap-2">
          <svg class="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M3 4a1 1 0 011-1h16a1 1 0 01.707 1.707L14 12.414V19a1 1 0 01-1.447.894l-4-2A1 1 0 018 17v-4.586L3.293 5.707A1 1 0 013 5V4z"
            />
          </svg>
          <span>{{ $t("generic.filter_and_view") }}</span>
          <span
            v-if="activeFilterCount > 0"
            class="slk-filter-count rounded-full px-1.5 py-0.5 text-xs leading-none font-bold"
            >{{ activeFilterCount }}</span
          >
        </span>
        <svg
          class="h-4 w-4 shrink-0 transition-transform duration-200"
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
      <div v-show="filterOpen" class="xs:block!">
        <!-- Row 0: Catalog version + view toggle -->
        <div class="grid grid-cols-[1.5rem_1fr] items-center gap-x-2 py-1.5">
          <svg
            class="slk-filter-panel-icon h-4 w-4 shrink-0"
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
              class="slk-filter-pill"
              :class="viewMode === 'list' ? 'slk-filter-pill--active' : ''"
              @click="viewMode = 'list'"
            >
              <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              {{ $t("generic.view.list") }}
            </button>
            <button
              type="button"
              class="slk-filter-pill"
              :class="viewMode === 'cards' ? 'slk-filter-pill--active' : ''"
              @click="viewMode = 'cards'"
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
              class="slk-filter-pill"
              :class="viewMode === 'treemap' ? 'slk-filter-pill--active' : ''"
              @click="viewMode = 'treemap'"
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
            class="slk-filter-panel-icon mt-1 h-4 w-4 shrink-0"
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
                class="slk-filter-sector-icon h-6 w-6 shrink-0 mix-blend-multiply grayscale invert"
                :class="selectedSector === sector ? 'opacity-100' : 'opacity-40'"
                alt=""
              />
              {{ $translateDynamic(`measure_sectors.${sector}.title`) }}
            </button>
          </div>
        </div>

        <div class="slk-filter-rule my-0.5 border-t" />

        <!-- Row 2: Quick-filter toggles -->
        <div class="grid grid-cols-[1.5rem_1fr] items-center gap-x-2 py-1.5">
          <svg
            class="slk-filter-panel-icon h-4 w-4 shrink-0"
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
              class="slk-filter-pill"
              :class="filterHighImpact ? 'slk-filter-pill--active' : ''"
              @click="filterHighImpact = !filterHighImpact"
            >
              <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
              {{ $t("measures.filters.high_impact") }}
            </button>
            <button
              type="button"
              class="slk-filter-pill"
              :class="filterLowCost ? 'slk-filter-pill--active' : ''"
              @click="filterLowCost = !filterLowCost"
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
              class="slk-filter-pill"
              :class="filterLowControversy ? 'slk-filter-pill--active' : ''"
              @click="filterLowControversy = !filterLowControversy"
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
              class="slk-filter-panel-icon h-4 w-4 shrink-0"
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
                class="slk-filter-pill"
                :class="sortOrder === 'id' ? 'slk-filter-pill--active' : ''"
                @click="sortOrder = 'id'"
              >
                {{ $t("measures.sort.by_id") }}
              </button>
              <button
                type="button"
                class="slk-filter-pill"
                :class="sortOrder === 'name' ? 'slk-filter-pill--active' : ''"
                @click="sortOrder = 'name'"
              >
                {{ $t("measures.sort.alphabetical") }}
              </button>
              <button
                type="button"
                class="slk-filter-pill"
                :class="sortOrder === 'impact' ? 'slk-filter-pill--active' : ''"
                @click="sortOrder = 'impact'"
              >
                {{ $t("measures.sort.impact_desc") }}
              </button>
              <button
                type="button"
                class="slk-filter-pill"
                :class="sortOrder === 'economical' ? 'slk-filter-pill--active' : ''"
                @click="sortOrder = 'economical'"
              >
                {{ $t("measures.sort.cost_asc") }}
              </button>
              <button
                type="button"
                class="slk-filter-pill"
                :class="sortOrder === 'political' ? 'slk-filter-pill--active' : ''"
                @click="sortOrder = 'political'"
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
    <div
      v-if="selectedSector"
      class="mb-4 max-w-2xl border-l-4 border-gray/30 bg-gray/5 px-4 py-3 text-sm text-gray-700"
    >
      <p class="mb-1 font-bold">{{ $translateDynamic(`measure_sectors.${selectedSector}.title`) }}</p>
      <p>{{ $translateDynamic(`measure_sectors.${selectedSector}.description`) }}</p>
    </div>

    <!-- Result count (list / cards only) -->
    <p v-if="viewMode === 'list' || viewMode === 'cards'" class="mb-4 text-sm text-gray-500">
      {{ filteredMeasures.length }} Maßnahmen
    </p>

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
    <div v-if="viewMode === 'cards'" class="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
        class="card block rounded-md border border-gray/20 shadow-sm transition-shadow duration-200 hover:shadow-lg"
      >
        <div class="card-body">
          <div class="flex items-start gap-3">
            <img :src="sectorImages[measure.sector]" class="mt-0.5 h-7 w-7 shrink-0 opacity-50" alt="" />
            <div class="min-w-0 flex-1">
              <div class="mb-1 flex flex-wrap items-center gap-2">
                <span class="shrink-0 rounded-sm bg-gray px-2 py-0.5 font-mono text-xs text-white">{{
                  measure.measure_id
                }}</span>
                <h2 class="font-heading text-sm leading-snug font-bold text-gray">{{ measure.name }}</h2>
              </div>
              <p v-if="measure.description_about" class="line-clamp-2 text-xs text-gray-500">
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
        :to="measureCatalogDownloadUrl('ac1df0cd-8a57-4082-bdd3-432f43e4a374.xslx')"
      >
        <button class="flex h-10 items-center justify-end bg-gray p-4 text-white">
          {{ $t("measure_catalog.download") }} ({{ currentCatalogVersion.name }})
        </button>
      </NuxtLink>
      <NuxtLink
        v-if="currentCatalogVersion.name === 'beta'"
        :to="measureCatalogDownloadUrl('9c270dd0-52dc-449b-9c2e-bbd5d5b829.xslx')"
      >
        <button class="flex h-10 items-center justify-end bg-gray p-4 text-white">
          {{ $t("measure_catalog.download") }} ({{ currentCatalogVersion.name }})
        </button>
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import sectorImages from "~/shared/sectorImages";

import { singleRouteValue } from "~/shared/routeValues";
const fetchContent = useContentFetch();

const SECTORS = ["energy", "agriculture", "transport", "industry", "buildings", "management"] as const;
const { $t, $translateDynamic } = useNuxtApp();
const config = useRuntimeConfig();
const route = useRoute();
const router = useRouter();
const measureCatalogDownloadUrl = (fileName: string) => {
  const directusUrl = config.public.clientDirectusUrl || "http://127.0.0.1:8081";
  return `${directusUrl.replace(/\/+$/, "")}/assets/${encodeURIComponent(fileName)}`;
};
const selectedCatalogVersion = await getCatalogVersion(route, true);
const currentCatalogVersion = ref(selectedCatalogVersion);

onMounted(() => {
  void setCatalogVersionUrl(route, router, selectedCatalogVersion);
});

const title = ref($t("measures.nav_label"));
usePageSeo({ title });

// Public contracts work during SSR and subsequent client navigation.
const { data: allVersions } = await useAsyncData("measure-catalog-versions", async () =>
  (await fetchContent("/api/public/catalogs")).slice().sort((a, b) => b.name.localeCompare(a.name)),
);
const { data: measuresData } = await useAsyncData(
  () => `measures-index-${currentCatalogVersion.value.name}`,
  () => fetchContent("/api/public/measures", { query: { v: currentCatalogVersion.value.name } }),
);
const measureList = computed(() => measuresData.value?.measures ?? []);
watch(
  () => route.query.v,
  async (newV, oldV) => {
    if (newV === oldV) return;
    currentCatalogVersion.value = await getCatalogVersion(route, true);
  },
);

// ── Filter state ────────────────────────────────────────────────────────────
const selectedSector = ref(singleRouteValue(route.query.sector) ?? null);
watch(
  () => route.query.sector,
  (sector) => {
    selectedSector.value = singleRouteValue(sector) ?? null;
  },
);
const viewMode = ref(route.query.view === "treemap" ? "treemap" : route.query.view === "cards" ? "cards" : "list");
const filterHighImpact = ref(false);
const filterLowCost = ref(false);
const filterLowControversy = ref(false);
const sortOrder = ref("id"); // 'id' | 'name' | 'impact' | 'economical' | 'political'

const filterOpen = ref(false);
const activeFilterCount = computed(() => {
  let count = 0;
  if (selectedSector.value) count++;
  if (filterHighImpact.value) count++;
  if (filterLowCost.value) count++;
  if (filterLowControversy.value) count++;
  return count;
});

function setSector(sector: string | null) {
  selectedSector.value = sector;
  void router.replace({ query: { ...route.query, sector: sector || undefined } });
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function stripHtml(html: string | null) {
  if (!html) return "";
  // Use the same text projection on the server and client to avoid hydration mismatches
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&auml;/g, "ä")
    .replace(/&Auml;/g, "Ä")
    .replace(/&ouml;/g, "ö")
    .replace(/&Ouml;/g, "Ö")
    .replace(/&uuml;/g, "ü")
    .replace(/&Uuml;/g, "Ü")
    .replace(/&szlig;/g, "ß")
    .replace(/&eacute;/g, "é")
    .replace(/&egrave;/g, "è")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(String(h), 16)))
    .replace(/\s+/g, " ")
    .trim();
}

function truncateHtml(html: string | null, maxLen = 130) {
  const text = stripHtml(html);
  return text.length > maxLen ? text.slice(0, maxLen) + "…" : text;
}

// ── Filtered + sorted list ───────────────────────────────────────────────────
const filteredMeasures = computed(() => {
  if (!measureList.value) return [];

  let list = measureList.value;
  if (selectedSector.value) list = list.filter((m) => m.sector === selectedSector.value);
  if (filterHighImpact.value) list = list.filter((m) => (m.impact ?? 0) >= 4);
  if (filterLowCost.value) list = list.filter((m) => (m.feasibility_economical ?? 0) >= 4);
  if (filterLowControversy.value) list = list.filter((m) => (m.feasibility_political ?? 0) >= 4);

  const sorted = [...list];
  if (sortOrder.value === "name") {
    sorted.sort((a, b) => a.name.localeCompare(b.name, "de"));
  } else if (sortOrder.value === "impact") {
    sorted.sort((a, b) => (b.impact ?? 0) - (a.impact ?? 0));
  } else if (sortOrder.value === "economical") {
    sorted.sort((a, b) => (b.feasibility_economical ?? 0) - (a.feasibility_economical ?? 0));
  } else if (sortOrder.value === "political") {
    sorted.sort((a, b) => (b.feasibility_political ?? 0) - (a.feasibility_political ?? 0));
  }
  // 'id' keeps server sort: measure_id

  return sorted;
});
</script>

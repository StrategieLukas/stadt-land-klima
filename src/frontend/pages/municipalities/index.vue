<template>
  <div class="municipalities-page px-4 py-8">
    <!-- Title -->
    <div class="mb-4">
      <h1 class="text-4xl font-bold text-light-green">
        <span v-if="selectedCatalogVersion.name === 'beta'">{{ $t("municipalities.heading") }} 2025</span>
        <span v-else>{{ $t("municipalities.heading") }} 2026</span>
      </h1>
      <p class="text-gray-400 mt-1 text-xs">
        <ClientOnly>{{ $t("municipalities.last_updated_at") + lastUpdatedAtStr }}</ClientOnly>
      </p>
    </div>

    <!-- Filter panel -->
    <div class="slk-filter-panel slk-filter-theme-green mb-6 flex flex-col gap-0 p-3 shadow-md">
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
        <!-- Row 1: View toggle + vertical divider + Catalog version -->
        <div class="flex flex-wrap items-center gap-x-3 gap-y-2 py-1.5">
          <!-- View toggle group: icon + buttons stay together -->
          <div class="flex items-center gap-2">
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
                d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
              />
            </svg>
            <div class="flex gap-2">
              <button
                class="slk-filter-pill"
                :class="!isMapView ? 'slk-filter-pill--active' : ''"
                @click="router.replace({ query: { ...route.query, view: undefined } })"
              >
                <svg
                  class="h-3.5 w-3.5 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                {{ $t("municipalities.view.ranking") }}
              </button>
              <button
                class="slk-filter-pill"
                :class="isMapView ? 'slk-filter-pill--active' : ''"
                @click="router.replace({ query: { ...route.query, view: 'map' } })"
              >
                <svg
                  class="h-3.5 w-3.5 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                  />
                </svg>
                {{ $t("municipalities.view.map") }}
              </button>
            </div>
          </div>

          <!-- Vertical divider (hidden when row wraps) -->
          <div class="slk-filter-divider w-px self-stretch" />

          <!-- Catalog version group: icon + buttons stay together -->
          <div class="flex items-center gap-2">
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
            <div class="flex items-center gap-2">
              <NuxtLink
                :to="{ path: '/municipalities', query: { ...route.query, v: 'v1.0' } }"
                class="slk-filter-pill"
                :class="selectedCatalogVersion.name !== 'beta' ? 'slk-filter-pill--active' : ''"
                >2026</NuxtLink
              >
              <NuxtLink
                :to="{ path: '/municipalities', query: { ...route.query, v: 'beta' } }"
                class="slk-filter-pill"
                :class="selectedCatalogVersion.name === 'beta' ? 'slk-filter-pill--active' : ''"
                >{{ $t("ranking.archive_year", { ":year": 2025 }) }}</NuxtLink
              >
            </div>
          </div>
        </div>

        <div class="slk-filter-rule my-0.5 border-t" />

        <!-- Row 2: Municipality type filter -->
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
          <div class="flex flex-wrap items-center gap-2">
            <button
              class="slk-filter-pill"
              :class="selected === 'all' ? 'slk-filter-pill--active' : ''"
              @click="selected = 'all'"
            >
              <span class="flex flex-shrink-0 -space-x-1" aria-hidden="true">
                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M3 20h18M5 20V9l4-4 4 4v11" />
                  <path stroke-linecap="round" stroke-linejoin="round" d="M8 20v-5h2v5" />
                </svg>
                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M3 20h18M6 20V6h8v14M14 20V10h5v10" />
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 9h2M9 13h2M16 13h1" />
                </svg>
              </span>
              <span class="whitespace-nowrap font-bold">{{ $t("municipalities.all") }}</span>
            </button>
            <button
              class="slk-filter-pill"
              :class="selected === 'major_city' ? 'slk-filter-pill--active' : ''"
              @click="selected = 'major_city'"
            >
              <svg
                class="h-4 w-4 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
                aria-hidden="true"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 20h18M6 20V6h8v14M14 20V10h5v10" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 9h2M9 13h2M16 13h1" />
              </svg>
              <span class="whitespace-nowrap font-bold">{{ $t("municipalities.major_city.plural") }}</span>
            </button>
            <button
              class="slk-filter-pill"
              :class="selected === 'minor_city' ? 'slk-filter-pill--active' : ''"
              @click="selected = 'minor_city'"
            >
              <svg
                class="h-4 w-4 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
                aria-hidden="true"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 20h18M5 20V9l4-4 4 4v11" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M8 20v-5h2v5" />
              </svg>
              <span class="whitespace-nowrap font-bold">{{ $t("municipalities.minor_city.plural") }}</span>
            </button>
            <span v-if="selected === 'major_city'" class="text-gray-500 text-xs italic">{{
              $t("municipalities.major_city.threshold")
            }}</span>
            <span v-else-if="selected === 'minor_city'" class="text-gray-500 text-xs italic">{{
              $t("municipalities.minor_city.threshold")
            }}</span>
          </div>
        </div>
      </div>
      <!-- /collapsible -->
    </div>

    <!-- Mobile: Single column layout -->
    <div class="block lg:hidden">
      <!-- Conditional Content -->
      <div>
        <section>
          <TheMap
            v-if="isMapView"
            :municipality-scores="filteredMunicipalityScores"
            :catalog-version="selectedCatalogVersion"
          />
          <TheRanking
            v-else
            :municipality-scores="filteredMunicipalityScores"
            :catalog-version="selectedCatalogVersion"
          />
        </section>
      </div>
    </div>

    <!-- Desktop: Two column layout -->
    <div class="hidden w-full lg:grid lg:grid-cols-3 lg:gap-8">
      <!-- Left Column: Municipality Ranking (2/3 width) -->
      <div ref="rankingColumn" class="lg:col-span-2">
        <!-- Conditional Content -->
        <div class="w-full max-w-screen-xl">
          <TheMap
            v-if="isMapView"
            :municipality-scores="filteredMunicipalityScores"
            :catalog-version="selectedCatalogVersion"
          />
          <TheRanking
            v-else
            :municipality-scores="filteredMunicipalityScores"
            :catalog-version="selectedCatalogVersion"
          />
        </div>
      </div>

      <!-- Right Column: Success Projects (1/3 width) -->
      <div
        class="mb-3 overflow-y-auto lg:col-span-1"
        v-if="projects && projects.length > 0"
        :style="{ maxHeight: rankingColumnHeight + 'px' }"
      >
        <div class="sticky">
          <!-- <h2 class="text-2xl font-bold max-w-md mb-6 mx-auto text-center">{{ $t("projects.title")}}</h2> -->
          <div class="mx-auto max-w-md space-y-4">
            <OnboardingBox
              name="Otto"
              avatar-src="https://stadt-land-klima.de/backend/assets/56a814bb-fac4-4b80-88d7-a6fc8bd71580?width=96&height=96"
            />
            <ProjectCard
              v-for="project in projects"
              :key="project.id"
              :slug="project.slug"
              :title="project.title"
              :municipality_name="project.municipality_name"
              :state="project.state"
              :abstract="project.abstract"
              :author="project.author"
              :date="new Date(project.date_created)"
              :image_id="project.image.id"
              :image_is_raster="isRaster(project.image.type)"
              :organisation="project.organisation"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- CTA: Start a new municipality assessment -->
    <div class="municipalities-cta mb-4 mt-12 flex flex-col items-center gap-6 rounded-sm p-8 shadow-list sm:flex-row">
      <img src="~/assets/icons/icon_location_green_marker.svg" class="h-14 w-auto flex-shrink-0" />
      <div class="flex-1 text-center sm:text-left">
        <h2 class="mb-2 font-heading text-h2 font-bold text-green">
          {{ $t("municipalities.cta.missing.title") }}
        </h2>
        <p class="text-gray-600 mb-4 text-sm">
          {{ $t("municipalities.cta.missing.body") }}
        </p>
        <NuxtLink
          to="/register_localteam"
          class="inline-block rounded-md bg-green px-6 py-2.5 font-semibold text-white transition-colors hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-green focus:ring-offset-2"
        >
          {{ $t("municipalities.cta.missing.action") }}
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import lodash from "lodash";
import { isRaster } from "~/shared/utils";

const { sortBy, last, get } = lodash;
const { $directus, $readItems, $t, $locale } = useNuxtApp();
const rankingColumn = ref(null);
const rankingColumnHeight = ref(0);

function updateRankingColumnHeight() {
  if (rankingColumn.value) {
    const measured = rankingColumn.value.offsetHeight;
    const minHeight = 500;
    const h = Math.max(measured, minHeight);

    if (h !== rankingColumnHeight.value) {
      rankingColumnHeight.value = h;
    }
  }
}

onMounted(() => {
  // Initial measurement after DOM renders
  nextTick(updateRankingColumnHeight);

  // Re-measure on window resize (only on client)
  if (process.client) {
    window.addEventListener("resize", updateRankingColumnHeight);
  }
});

// Also re-measure whenever the DOM changes (reactively)
watchEffect(async () => {
  // wait for DOM updates after reactive changes
  await nextTick();
  updateRankingColumnHeight();
});

//MetaTags
const title = ref($t("municipalities.nav_label"));
useHead({
  title,
});

const route = useRoute();
const router = useRouter();
const isMapView = computed(() => route.query.view === "map"); // Default to map view if no query param or 'map'

let selectedCatalogVersion = await getCatalogVersion($directus, $readItems, route);
onMounted(() => {
  setCatalogVersionUrl(route, router, selectedCatalogVersion);
});

// Fetch all relevant municipalityScores from directus
async function fetchMunicipalityScores(catalogVersionId) {
  return await useAsyncData(`municipalities_ranking_scores_${catalogVersionId}`, () => {
    return $directus.request(
      $readItems("municipality_scores", {
        fields: [
          "id",
          "catalog_version",
          "published",
          "rank",
          "score_total",
          "percentage_rated",
          "municipality.name",
          { municipality: ["id", "slug", "state", "municipality_type", "geolocation", "date_updated"] },
        ],
        filter: { catalog_version: { _eq: catalogVersionId }, percentage_rated: { _gt: 0 } },
        limit: -1,
        sort: ["-score_total", "municipality.name"],
      }),
    );
  });
}

let { data: municipalityScores } = await fetchMunicipalityScores(selectedCatalogVersion.id);

const { data: projects } = await useAsyncData("articles_ranking", () => {
  return $directus.request(
    $readItems("articles", {
      fields: [
        "slug",
        "title",
        "abstract",
        "author",
        "date_created",
        "municipality_name",
        "state",
        { image: ["id", "type"] },
        { organisation: ["id", "name", "logo", "link"] },
      ],
      sort: "-date_created",
      limit: -1,
    }),
  );
});

watch(
  () => route.query.v,
  async (newV, oldV) => {
    if (newV === oldV) return;
    // Ignore the initial URL fixup from onMounted (setCatalogVersionUrl adding ?v= when absent)
    if (!oldV) return;

    // Fetch new catalog version info
    selectedCatalogVersion = await getCatalogVersion($directus, $readItems, route);

    // Refresh municipality scores with new version
    const { data: newData } = await fetchMunicipalityScores(selectedCatalogVersion.id);
    municipalityScores.value = newData.value;

    // Optionally refresh articles too
    await refreshNuxtData("articles_ranking");
  },
);

const majorCityScores = computed(() =>
  getSublist((municipalityScore) => municipalityScore.municipality.municipality_type === "big_city"),
);
const minorCitiesScores = computed(() =>
  getSublist((municipalityScore) => municipalityScore.municipality.municipality_type === "small_city"),
);
const filteredMunicipalityScores = computed(() => {
  if (selected.value === "major_city") return majorCityScores.value;
  if (selected.value === "minor_city") return minorCitiesScores.value;
  return municipalityScores.value ?? [];
});

function getSublist(condition) {
  return (municipalityScores.value?.filter(condition) || []).map((item, index) => ({
    ...item,
    rank: index + 1,
  }));
}

const lastUpdatedAtStr = ref("");
onMounted(() => {
  const scores = municipalityScores.value;
  if (!Array.isArray(scores) || scores.length === 0) return;

  // sort by nested municipality.date_updated
  const sorted = sortBy(scores, (s) => get(s, "municipality.date_updated"));

  const latest = get(last(sorted), "municipality.date_updated");
  if (!latest) return;

  const lastUpdatedAt = new Date(latest);

  lastUpdatedAtStr.value =
    lastUpdatedAt.toLocaleDateString($locale, {
      year: "numeric",
      month: "2-digit",
      day: "numeric",
    }) +
    ", " +
    lastUpdatedAt.toLocaleTimeString($locale);
});

// Toggle between cities, towns, or all — persisted in the URL so catalog changes retain it
const selected = computed({
  get() {
    const v = route.query.filter;
    return v === "major_city" || v === "minor_city" ? v : "all";
  },
  set(val) {
    router.replace({ query: { ...route.query, filter: val === "all" ? undefined : val } });
  },
});

const filterOpen = ref(false);
const activeFilterCount = computed(() => {
  let count = 0;
  if (isMapView.value) count++;
  if (selected.value !== "all") count++;
  if (route.query.v === "beta") count++;
  return count;
});
</script>

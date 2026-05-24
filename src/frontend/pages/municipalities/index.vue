<template>
<div class="px-4 py-8">
  <!-- Title -->
  <div class="mb-4">
    <h1 class="text-4xl font-bold" style="color: #AFCA0B;">
      <span v-if="selectedCatalogVersion.name === 'beta'">{{ $t("municipalities.heading") }} 2025</span>
      <span v-else>{{ $t("municipalities.heading") }} 2026</span>
    </h1>
    <p class="text-xs text-gray-400 mt-1">
      <ClientOnly>{{ $t("municipalities.last_updated_at") + lastUpdatedAtStr }}</ClientOnly>
    </p>
  </div>

  <!-- Mobile CTA strip (lg:hidden) — above filter -->
  <div class="lg:hidden flex flex-col gap-2 mb-4">
    <!-- Werde Klimachecker -->
    <button @click="openCalMobile"
       class="flex flex-row items-center gap-3 bg-white shadow-md border-2 p-3 text-left w-full"
       style="border-color: #339737;">
      <img src="https://stadt-land-klima.de/backend/assets/56a814bb-fac4-4b80-88d7-a6fc8bd71580?width=96&height=96"
           alt="Otto" class="w-10 h-10 rounded-full flex-shrink-0 object-cover" />
      <div class="flex-1 min-w-0">
        <h2 class="text-sm font-bold font-heading leading-tight" style="color: #339737;">Werde Klimachecker!</h2>
        <p class="text-xs text-gray-500 mt-0.5 line-clamp-1">Vereinbare einen Termin zu deinem individuellen online Onboarding</p>
      </div>
      <span class="flex-shrink-0 px-3 py-1.5 text-white text-xs font-semibold rounded-md" style="background-color: #339737;">
        Buchen →
      </span>
    </button>
    <!-- Lokalteam gründen -->
    <NuxtLink to="/register_localteam"
       class="flex flex-row items-center gap-3 bg-white shadow-md border-2 p-3"
       style="border-color: #AFCA0B;">
      <div class="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style="background-color: #AFCA0B;">
        <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
          <path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </div>
      <div class="flex-1 min-w-0">
        <h2 class="text-sm font-bold font-heading leading-tight" style="color: #AFCA0B;">Jetzt Lokalteam gründen</h2>
        <p class="text-xs text-gray-500 mt-0.5 line-clamp-1">und mit Bewerten anfangen</p>
      </div>
      <span class="flex-shrink-0 px-3 py-1.5 text-white text-xs font-semibold rounded-md" style="background-color: #AFCA0B;">
        Jetzt anfangen →
      </span>
    </NuxtLink>
    <!-- Dashboard Stats -->
    <NuxtLink to="/stats#massnahmenstatistiken"
       class="flex flex-row items-center gap-3 bg-white shadow-md border-2 p-3"
       style="border-color: #006e94;">
      <div class="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style="background-color: #006e94;">
        <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      </div>
      <div class="flex-1 min-w-0">
        <h2 class="text-sm font-bold font-heading leading-tight" style="color: #006e94;">Dashboard Maßnahmen-Statistiken</h2>
        <p class="text-xs text-gray-500 mt-0.5 line-clamp-1">Sektoren &amp; Maßnahmen-Analyse aller Kommunen</p>
      </div>
      <span class="flex-shrink-0 px-3 py-1.5 text-white text-xs font-semibold rounded-md" style="background-color: #006e94;">
        Zum Dashboard →
      </span>
    </NuxtLink>
  </div>

  <!-- Filter panel -->
  <div class="flex flex-col gap-0 mb-6 shadow-md p-3" style="background-color: #F5F9E6;">

    <!-- Collapsible toggle (only shown below xs breakpoint) -->
    <button class="flex xs:hidden w-full items-center justify-between py-1 text-sm font-medium" style="color: #AFCA0B;" @click="filterOpen = !filterOpen">
      <span class="flex items-center gap-2">
        <svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 01.707 1.707L14 12.414V19a1 1 0 01-1.447.894l-4-2A1 1 0 018 17v-4.586L3.293 5.707A1 1 0 013 5V4z" />
        </svg>
        <span>Filter &amp; Ansicht</span>
        <span v-if="activeFilterCount > 0" class="text-white text-xs rounded-full px-1.5 py-0.5 font-bold leading-none" style="background-color: #AFCA0B;">{{ activeFilterCount }}</span>
      </span>
      <svg class="w-4 h-4 flex-shrink-0 transition-transform duration-200" :class="filterOpen ? 'rotate-180' : ''" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    <!-- Filter rows (always visible at xs+, collapsible below xs) -->
    <div v-show="filterOpen" class="xs:!block">

    <!-- Row 1: View toggle + vertical divider + Catalog version -->
    <div class="flex flex-wrap items-center gap-x-3 gap-y-2 py-1.5">
      <!-- View toggle group: icon + buttons stay together -->
      <div class="flex items-center gap-2">
        <svg class="w-4 h-4 flex-shrink-0" style="color: #AFCA0B;" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
        <div class="flex gap-2">
          <button
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition text-xs font-bold"
            :class="!isMapView ? 'bg-[#AFCA0B] text-white border-[#AFCA0B]' : 'bg-white border-[#AFCA0B] text-[#AFCA0B] hover:bg-[#F5F9E6]'"
            @click="router.replace({ query: { ...route.query, view: undefined } })"
          >
            <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            Ranking
          </button>
          <button
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition text-xs font-bold"
            :class="isMapView ? 'bg-[#AFCA0B] text-white border-[#AFCA0B]' : 'bg-white border-[#AFCA0B] text-[#AFCA0B] hover:bg-[#F5F9E6]'"
            @click="router.replace({ query: { ...route.query, view: 'map' } })"
          >
            <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            Karte
          </button>
        </div>
      </div>

      <!-- Vertical divider (hidden when row wraps) -->
      <div class="self-stretch w-px bg-[#AFCA0B]/30" />

      <!-- Catalog version group: icon + buttons stay together -->
      <div class="flex items-center gap-2">
        <svg class="w-4 h-4 flex-shrink-0" style="color: #AFCA0B;" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <div class="flex gap-2 items-center">
          <NuxtLink
            :to="{ path: '/municipalities', query: { ...route.query, v: 'v1.0' } }"
            class="inline-flex items-center px-2.5 py-1 rounded-full border transition text-xs font-bold"
            :class="selectedCatalogVersion.name !== 'beta' ? 'bg-[#AFCA0B] text-white border-[#AFCA0B]' : 'bg-white border-[#AFCA0B] text-[#AFCA0B] hover:bg-[#F5F9E6]'"
          >2026</NuxtLink>
          <NuxtLink
            :to="{ path: '/municipalities', query: { ...route.query, v: 'beta' } }"
            class="inline-flex items-center px-2.5 py-1 rounded-full border transition text-xs font-bold"
            :class="selectedCatalogVersion.name === 'beta' ? 'bg-[#AFCA0B] text-white border-[#AFCA0B]' : 'bg-white border-[#AFCA0B] text-[#AFCA0B] hover:bg-[#F5F9E6]'"
          >2025 (Archiv)</NuxtLink>
        </div>
      </div>
    </div>

    <div class="border-t border-[#AFCA0B]/20 my-0.5" />

    <!-- Row 2: Municipality type filter -->
    <div class="grid grid-cols-[1.5rem_1fr] gap-x-2 items-start py-1.5">
      <svg class="w-4 h-4 mt-1 flex-shrink-0" style="color: #AFCA0B;" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 01.707 1.707L14 12.414V19a1 1 0 01-1.447.894l-4-2A1 1 0 018 17v-4.586L3.293 5.707A1 1 0 013 5V4z" />
      </svg>
      <div class="flex flex-wrap gap-2 items-center">
        <button
          class="flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition text-xs font-medium"
          :class="selected === 'all' ? 'bg-[#AFCA0B] text-white border-[#AFCA0B]' : 'bg-white border-[#AFCA0B] text-[#AFCA0B] hover:bg-[#F5F9E6]'"
          @click="selected = 'all'"
        >
          <div class="flex gap-0 flex-shrink-0">
            <img class="h-4 w-4" :src="selected === 'all' ? minorCitySelected : minorCityNotSelected" :alt="$t('municipalities.all')" />
            <img class="h-4 w-4" :src="selected === 'all' ? majorCitySelected : majorCityNotSelected" />
          </div>
          <span class="font-bold whitespace-nowrap">{{ $t('municipalities.all') }}</span>
        </button>
        <button
          class="flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition text-xs font-medium"
          :class="selected === 'major_city' ? 'bg-[#AFCA0B] text-white border-[#AFCA0B]' : 'bg-white border-[#AFCA0B] text-[#AFCA0B] hover:bg-[#F5F9E6]'"
          @click="selected = 'major_city'"
        >
          <img class="h-4 w-4 flex-shrink-0" :src="selected === 'major_city' ? majorCitySelected : majorCityNotSelected" :alt="$t('municipalities.major_city.plural')" />
          <span class="font-bold whitespace-nowrap">{{ $t('municipalities.major_city.plural') }}</span>
        </button>
        <button
          class="flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition text-xs font-medium"
          :class="selected === 'minor_city' ? 'bg-[#AFCA0B] text-white border-[#AFCA0B]' : 'bg-white border-[#AFCA0B] text-[#AFCA0B] hover:bg-[#F5F9E6]'"
          @click="selected = 'minor_city'"
        >
          <img class="h-4 w-4 flex-shrink-0" :src="selected === 'minor_city' ? minorCitySelected : minorCityNotSelected" :alt="$t('municipalities.minor_city.plural')" />
          <span class="font-bold whitespace-nowrap">{{ $t('municipalities.minor_city.plural') }}</span>
        </button>
        <span v-if="selected === 'major_city'" class="text-xs italic text-gray-500">{{ $t("municipalities.major_city.threshold") }}</span>
        <span v-else-if="selected === 'minor_city'" class="text-xs italic text-gray-500">{{ $t("municipalities.minor_city.threshold") }}</span>
      </div>
    </div>

    </div><!-- /collapsible -->
  </div>

  <!-- Mobile: Single column layout -->
  <div class="block lg:hidden">
    <!-- Conditional Content -->
     <div>
      <section>
        <TheMap v-if="isMapView" :municipality-scores="filteredMunicipalityScores" :catalog-version="selectedCatalogVersion"/>
        <TheRanking v-else :municipality-scores="filteredMunicipalityScores" :catalog-version="selectedCatalogVersion"/>
      </section>
     </div>
  </div>

  <!-- Desktop: Two column layout -->
  <div class="hidden lg:grid lg:grid-cols-3 lg:gap-8 w-full">
    <!-- Left Column: Municipality Ranking (2/3 width) -->
    <div ref="rankingColumn" class="lg:col-span-2">
      <!-- Conditional Content -->
      <div class="w-full max-w-screen-xl">
        <TheMap v-if="isMapView" :municipality-scores="filteredMunicipalityScores" :catalog-version="selectedCatalogVersion"/>
        <TheRanking v-else :municipality-scores="filteredMunicipalityScores" :catalog-version="selectedCatalogVersion"/>
      </div>
    </div>

    <!-- Right Column: Success Projects (1/3 width) -->
    <div class="lg:col-span-1 mb-3 overflow-y-auto" v-if="projects && projects.length > 0"  :style="{ maxHeight: rankingColumnHeight + 'px' }">
      <div class="sticky">
        <!-- <h2 class="text-2xl font-bold max-w-md mb-6 mx-auto text-center">{{ $t("projects.title")}}</h2> -->
        <div class="space-y-4 max-w-md mx-auto">
          <OnboardingBox name="Otto" avatar-src="https://stadt-land-klima.de/backend/assets/56a814bb-fac4-4b80-88d7-a6fc8bd71580?width=96&height=96"/>

          <!-- Lokalteam gründen box -->
          <div class="flex flex-col bg-white shadow-xl border-2 p-4 h-36" style="border-color: #AFCA0B;">
            <div class="flex items-center gap-3 flex-1 min-h-0">
              <div class="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0" style="background-color: #AFCA0B;">
                <svg class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div class="min-w-0">
                <h2 class="text-base font-bold font-heading leading-tight" style="color: #AFCA0B;">Jetzt Lokalteam gründen</h2>
                <p class="text-xs text-gray-500 mt-0.5 line-clamp-2">und mit Bewerten anfangen</p>
              </div>
            </div>
            <NuxtLink
              to="/register_localteam"
              class="mt-2 inline-block w-full text-center px-3 py-2 text-white text-sm font-semibold rounded-md hover:opacity-90 transition-opacity"
              style="background-color: #AFCA0B;"
            >
              Jetzt anfangen →
            </NuxtLink>
          </div>

          <!-- Dashboard Maßnahmen-Statistiken box -->
          <div class="flex flex-col bg-white shadow-xl border-2 p-4 h-36" style="border-color: #006e94;">
            <div class="flex items-center gap-3 flex-1 min-h-0">
              <div class="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0" style="background-color: #006e94;">
                <svg class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div class="min-w-0">
                <h2 class="text-base font-bold font-heading leading-tight" style="color: #006e94;">Dashboard<br>Maßnahmen-Statistiken</h2>
                <p class="text-xs text-gray-500 mt-0.5 line-clamp-2">Sektoren &amp; Maßnahmen-Analyse aller Kommunen</p>
              </div>
            </div>
            <NuxtLink
              to="/stats#massnahmenstatistiken"
              class="mt-2 inline-block w-full text-center px-3 py-2 text-white text-sm font-semibold rounded-md hover:opacity-90 transition-opacity"
              style="background-color: #006e94;"
            >
              Zum Dashboard →
            </NuxtLink>
          </div>

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
  <div class="mt-12 mb-4 rounded-sm shadow-list p-8 bg-rating-3-light flex flex-col sm:flex-row items-center gap-6">
    <img src="~/assets/icons/icon_location_green_marker.svg" class="h-14 w-auto flex-shrink-0 opacity-80" />
    <div class="flex-1 text-center sm:text-left">
      <h2 class="font-heading text-h2 font-bold text-green mb-2">
        Deine Kommune ist nicht dabei?
      </h2>
      <p class="text-gray-600 text-sm mb-4">
        Starte selbst die Bewertung und bringe aktiven Klimaschutz in deine Gemeinde.
        Gründe ein Lokalteam — wir begleiten dich durch den Prozess.
      </p>
      <NuxtLink
        to="/register_localteam"
        class="inline-block px-6 py-2.5 bg-green text-white font-semibold rounded-md hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-green focus:ring-offset-2 transition-colors"
      >
        Jetzt anfangen →
      </NuxtLink>
    </div>
  </div>

  <!-- Mobile cal.com overlay -->
  <teleport to="body">
    <transition name="mun-cal-fade">
      <div v-if="showCalMobile"
           class="fixed inset-0 z-[10001] bg-black/60 flex items-center justify-center p-4"
           @click.self="closeCalMobile">
        <div class="relative bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
          <div class="flex justify-end p-2 flex-shrink-0">
            <button @click="closeCalMobile"
                    class="text-gray-500 hover:text-gray-700 text-2xl leading-none"
                    aria-label="Close">✕</button>
          </div>
          <div id="my-cal-inline-onboarding-mobile"
               class="flex-1 overflow-y-auto min-h-[400px]"></div>
        </div>
      </div>
    </transition>
  </teleport>

</div>
</template>

<script setup>
const majorCitySelected = '/icons/major-city-light.svg'
const majorCityNotSelected = '/icons/major-city-dark.svg'
const minorCitySelected = '/icons/minor-city-light.svg'
const minorCityNotSelected = '/icons/minor-city-dark.svg'

import { ref, onMounted, computed, nextTick, watch } from 'vue'
import lodash from "lodash";
import { isRaster } from "~/shared/utils";

const { sortBy, last, get } = lodash;
const { $directus, $readItems, $t, $locale } = useNuxtApp();
const rankingColumn = ref(null)
const rankingColumnHeight = ref(0)

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
  nextTick(updateRankingColumnHeight)

  // Re-measure on window resize (only on client)
  if (process.client) {
    window.addEventListener('resize', updateRankingColumnHeight)
  }
})

// Also re-measure whenever the DOM changes (reactively)
watchEffect(async () => {
  // wait for DOM updates after reactive changes
  await nextTick()
  updateRankingColumnHeight()
})


//MetaTags
const title = ref($t("municipalities.nav_label"));
useHead({
  title,
});

const route = useRoute();
const router = useRouter();
const isMapView = computed(() => route.query.view === 'map'); // Default to map view if no query param or 'map'

let selectedCatalogVersion = await getCatalogVersion($directus, $readItems, route);
onMounted(() => {
  setCatalogVersionUrl(route, router, selectedCatalogVersion);
});

// Fetch all relevant municipalityScores from directus
async function fetchMunicipalityScores(catalogVersionId) {
  return await useAsyncData(`municipalities_ranking_scores_${catalogVersionId}`, () => {
  return $directus.request(
    $readItems("municipality_scores", {
      fields: ["id", "catalog_version", "rank", "score_total", "percentage_rated", "municipality.name", 
      { municipality: ["id", "slug", "state", "municipality_type", "status", "geolocation", "date_updated"] }],
      filter: { catalog_version: { _eq: catalogVersionId }, percentage_rated: { _gt: 0} },
      limit: -1,
      sort: "-score_total",
    })
  )
});
};

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
        { organisation: ["id", "name", "logo", "link"] }
      ],
      sort: "-date_created",
      limit: -1,
    })
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
  }
);


const majorCityScores = computed(() => getSublist((municipalityScore) => municipalityScore.municipality.municipality_type === 'big_city'));
const minorCitiesScores = computed(() => getSublist((municipalityScore) => municipalityScore.municipality.municipality_type === 'small_city'));
const filteredMunicipalityScores = computed(() => {
  if (selected.value === 'major_city') return majorCityScores.value;
  if (selected.value === 'minor_city') return minorCitiesScores.value;
  return municipalityScores.value ?? [];
});

function getSublist(condition) {
  return (municipalityScores.value?.filter(condition) || [])
    .map((item, index) => ({
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
      day: "numeric"
    }) +
    ", " +
    lastUpdatedAt.toLocaleTimeString($locale);
});

// Toggle between cities, towns, or all — persisted in the URL so catalog changes retain it
const selected = computed({
  get() {
    const v = route.query.filter
    return v === 'major_city' || v === 'minor_city' ? v : 'all'
  },
  set(val) {
    router.replace({ query: { ...route.query, filter: val === 'all' ? undefined : val } })
  },
})

const filterOpen = ref(false)

// Mobile cal.com overlay
const showCalMobile = ref(false)
async function openCalMobile() {
  showCalMobile.value = true
  await nextTick()
  const container = document.getElementById('my-cal-inline-onboarding-mobile')
  if (container) container.innerHTML = ''
  if (window?.Cal?.ns?.onboarding) {
    window.Cal.ns.onboarding('inline', {
      elementOrSelector: '#my-cal-inline-onboarding-mobile',
      config: { layout: 'month_view' },
      calLink: 'stadt-land-klima/onboarding',
    })
  }
}
function closeCalMobile() { showCalMobile.value = false }
watch(showCalMobile, (open) => { if (import.meta.client) document.body.style.overflow = open ? 'hidden' : '' })
const activeFilterCount = computed(() => {
  let count = 0
  if (isMapView.value) count++
  if (selected.value !== 'all') count++
  if (route.query.v === 'beta') count++
  return count
})

</script>

<style scoped>
.mun-cal-fade-enter-active, .mun-cal-fade-leave-active { transition: opacity .2s; }
.mun-cal-fade-enter-from, .mun-cal-fade-leave-to { opacity: 0; }
</style>


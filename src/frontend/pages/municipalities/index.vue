<template>
  <div class="flex flex-col items-center mb-10">
    <div class="prose mb-8 mt-10 max-w-full text-center">
      <h1 v-if="selectedCatalogVersion.name === 'beta'" class="mb-0 whitespace-pre-line">
        {{ $t("municipalities.heading") }} <br/>2025
      </h1>
      <h1 v-else class="mb-0 whitespace-pre-line">
        {{ $t("municipalities.heading") }} <br/>2026
      </h1>
      <p class="mt-0 text-xs">
        <ClientOnly>
          {{ $t("municipalities.last_updated_at") + lastUpdatedAtStr }}
        </ClientOnly>
      </p>
      <p v-if="selectedCatalogVersion.name === 'beta'">
        <NuxtLink to="/municipalities?v=v1.0" class="text-blue-500">
          {{ $t("ranking.preview_2026") }}
        </NuxtLink>
      </p>
      <p v-else>
        <span class="font-bold text-red">
          {{ $t("ranking.warn_preview") }}
        </span>
        <br/>
        <NuxtLink to="/municipalities?v=beta" class="text-blue-500">
        {{ $t("ranking.view_current") }}
      </NuxtLink>
      </p>
    </div>

    <!-- Button Row -->
    <div class="flex flex-col w-full items-center gap-2 mb-5 md:flex-row md:justify-center md:max-w-4xl">
      <!-- First row (1 button centered) -->
      <div class="flex justify-center w-full md:w-auto">
        <button
          class="flex items-center p-2 rounded border transition w-1/2 md:w-auto hover:scale-105 text-xs md:text-sm group"
          :class="selected === 'all' ? 'bg-[#AFCA0B] text-white' : 'border-[#AFCA0B] text-[#AFCA0B]'"
          @click="selected = 'all'"
        >
          <div class="flex gap-0">
            <img class="h-6 w-6 flex-shrink-0" :src="selected === 'all' ? minorCitySelected : minorCityNotSelected" :alt="$t('municipalities.all')" />
            <img class="h-6 w-6 flex-shrink-0" :src="selected === 'all' ? majorCitySelected : majorCityNotSelected" />
          </div>
          <div class="flex items-center transition">
            <div class="border-l h-6 mx-1 border-current"></div>
            <span class="font-bold whitespace-nowrap">
              {{ $t('municipalities.all') }}
            </span>
          </div>
        </button>
      </div>

      <!-- Second row (2 buttons) -->
      <div class="flex w-full gap-2 md:w-auto">
        <!-- Major cities -->
        <button
          class="flex items-center p-2 rounded border transition w-1/2 md:w-auto hover:scale-105 text-xs md:text-sm group"
          :class="selected === 'major_city' ? 'bg-[#AFCA0B] text-white' : 'border-[#AFCA0B] text-[#AFCA0B]'"
          @click="selected = 'major_city'"
        >
          <img class="h-6 w-6 flex-shrink-0" :src="selected === 'major_city' ? majorCitySelected : majorCityNotSelected" :alt="$t('municipalities.major_city.plural')" />
          <div class="flex items-center transition h-full">
            <div class="border-l h-6 mx-1 border-current"></div>
            <span class="font-bold whitespace-nowrap">
              {{ $t('municipalities.major_city.plural') }}
            </span>
          </div>
        </button>

        <!-- Minor cities -->
        <button
          class="flex items-center p-2 rounded border transition w-1/2 md:w-auto hover:scale-105 text-xs md:text-sm group"
          :class="selected === 'minor_city' ? 'bg-[#AFCA0B] text-white' : 'border-[#AFCA0B] text-[#AFCA0B]'"
          @click="selected = 'minor_city'"
        >
          <img class="h-6 w-6 flex-shrink-0" :src="selected === 'minor_city' ? minorCitySelected : minorCityNotSelected" :alt="$t('municipalities.minor_city.plural')" />
          <div class="flex items-center transition">
            <div class="border-l h-6 mx-1 border-current"></div>
            <span class="font-bold whitespace-nowrap">
              {{ $t('municipalities.minor_city.plural') }}
            </span>
          </div>
        </button>
      </div>
    </div>

    <!-- Subtitle below buttons -->
    <div class="h-5">
      <p v-if="selected === 'major_city'" class="text-xs text-center italic">
        {{ $t("municipalities.major_city.threshold") }}
      </p>
      <p v-else-if="selected === 'minor_city'" class="text-xs text-center italic">
        {{ $t("municipalities.minor_city.threshold") }}
      </p>
    </div>
  </div>

  <!-- Mobile: Single column layout -->
  <div class="block lg:hidden">
    <!-- Conditional Content -->
     <div>
      <section>
        <TheMap v-if="isMapView && selected === 'major_city'" :municipality-scores="majorCityScores" :catalog-version="selectedCatalogVersion"/>
        <TheMap v-else-if="isMapView && selected === 'minor_city'" :municipality-scores="minorCitiesScores" :catalog-version="selectedCatalogVersion"/>
        <TheMap v-else-if="isMapView" :municipality-scores="municipalityScores" :catalog-version="selectedCatalogVersion"/>

        <TheRanking v-if="!isMapView && selected === 'major_city'" :municipality-scores="majorCityScores" :catalog-version="selectedCatalogVersion"/>
        <TheRanking v-else-if="!isMapView && selected === 'minor_city'" :municipality-scores="minorCitiesScores" :catalog-version="selectedCatalogVersion"/>
        <TheRanking v-else-if="!isMapView" :municipality-scores="municipalityScores" :catalog-version="selectedCatalogVersion"/>
      </section>
     </div>
  </div>

  <!-- Desktop: Two column layout -->
  <div class="hidden lg:grid lg:grid-cols-3 lg:gap-8 w-full">
    <!-- Left Column: Municipality Ranking (2/3 width) -->
    <div ref="rankingColumn" class="lg:col-span-2">
      <!-- Conditional Content -->
      <div class="w-full max-w-screen-xl">
        <TheMap v-if="isMapView && selected === 'major_city'" :municipality-scores="majorCityScores" :catalog-version="selectedCatalogVersion"/>
        <TheMap v-else-if="isMapView && selected === 'minor_city'" :municipality-scores="minorCitiesScores" :catalog-version="selectedCatalogVersion"/>
        <TheMap v-else-if="isMapView" :municipality-scores="municipalityScores" :catalog-version="selectedCatalogVersion"/>

        <TheRanking v-if="!isMapView && selected === 'major_city'" :municipality-scores="majorCityScores" :catalog-version="selectedCatalogVersion"/>
        <TheRanking v-else-if="!isMapView && selected === 'minor_city'" :municipality-scores="minorCitiesScores" :catalog-version="selectedCatalogVersion"/>
        <TheRanking v-else-if="!isMapView" :municipality-scores="municipalityScores" :catalog-version="selectedCatalogVersion"/>
      </div>
    </div>

    <!-- Right Column: Success Projects (1/3 width) -->
    <div class="lg:col-span-1 mb-3 overflow-y-auto" v-if="projects && projects.length > 0"  :style="{ maxHeight: rankingColumnHeight + 'px' }">
      <div class="sticky">
        <!-- <h2 class="text-2xl font-bold max-w-md mb-6 mx-auto text-center">{{ $t("projects.title")}}</h2> -->
        <div class="space-y-4 max-w-md mx-auto">
          <OnboardingBox name="Otto" avatar-src="https://stadt-land-klima.de/backend/assets/56a814bb-fac4-4b80-88d7-a6fc8bd71580?width=96&height=96"/>
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
            :image_id="project.image"
            :organisation="project.organisation"
          />
        </div>
      </div>
    </div>
  </div>


</template>

<script setup>
import majorCitySelected from '~/assets/images/major-city-light.svg'
import majorCityNotSelected from '~/assets/images/major-city-dark.svg'
import minorCitySelected from '~/assets/images/minor-city-light.svg'
import minorCityNotSelected from '~/assets/images/minor-city-dark.svg'

import { ref, onMounted, computed } from 'vue'
import lodash from "lodash";
import { getCatalogVersion } from '~/composables/getCatalogVersion.js';
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

// Change the URL to match the catalog version, if it didn't to begin with
if (process.client && route.query.v != selectedCatalogVersion.name) {
  onMounted(() => {
    router.replace({ query: { ...route.query, v: selectedCatalogVersion.name } });
  });
}

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
        "image",
        "abstract",
        "author",
        "date_created",
        "municipality_name",
        "state",
        { organisation: ["name", "logo", "link"] }
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

    // Fetch new catalog version info
    selectedCatalogVersion = await getCatalogVersion($directus, $readItems, route);

    // Refresh municipality scores with new version
    const { data: newData } = await fetchMunicipalityScores(selectedCatalogVersion.id);
    municipalityScores.value = newData.value;

    // Optionally refresh articles too
    await refreshNuxtData("articles_ranking");
  }
);


const majorCityScores = getSublist((municipalityScore) => municipalityScore.municipality.municipality_type === 'big_city');
const minorCitiesScores = getSublist((municipalityScore) => municipalityScore.municipality.municipality_type === 'small_city');

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

// Toggle between cities, towns, or all
const selected = ref('all')


</script>


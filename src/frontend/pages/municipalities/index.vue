<template>
  <div class="flex flex-col items-center mb-10">
    <div class="prose mb-8 mt-10 max-w-full text-center">
      <h1 class="mb-0 whitespace-pre-line">
        {{ $t("municipalities.heading") }}
      </h1>
      <p class="mt-0 text-xs">
        {{ $t("municipalities.last_updated_at") + lastUpdatedAtStr }}
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
    <div v-if="selected === 'major_city'">
      <section>
        <the-ranking :municipalities="majorCities"></the-ranking>
      </section>
    </div>
    <div v-else-if="selected === 'minor_city'">
      <section>
        <the-ranking :municipalities="minorCities"></the-ranking>
      </section>
    </div>
    <div v-else>
      <section>
        <the-ranking :municipalities="municipalities"></the-ranking>
      </section>
    </div>
  </div>

  <!-- Desktop: Two column layout -->
  <div class="hidden lg:grid lg:grid-cols-3 lg:gap-8 w-full">
    <!-- Left Column: Municipality Ranking (2/3 width) -->
    <div class="lg:col-span-2">
      <!-- Conditional Content -->
      <div class="w-full max-w-screen-xl">
        <TheMap v-if="isMapView && selected === 'major_city'" :municipalities="majorCities"/>
        <TheMap v-else-if="isMapView && selected === 'minor_city'" :municipalities="minorCities"/>
        <TheMap v-else-if="isMapView" :municipalities="municipalities"/>

        <TheRanking v-if="!isMapView && selected === 'major_city'" :municipalities="majorCities"/>
        <TheRanking v-else-if="!isMapView && selected === 'minor_city'" :municipalities="minorCities"/>
        <TheRanking v-else-if="!isMapView" :municipalities="municipalities"/>
      </div>
    </div>

    <!-- Right Column: Success Projects (1/3 width) -->
    <div class="lg:col-span-1 mb-3" v-if="projects && projects.length > 0">
      <div class="sticky top-8">
        <!-- <h2 class="text-2xl font-bold max-w-md mb-6 mx-auto text-center">{{ $t("projects.title")}}</h2> -->
        <div class="space-y-4 max-w-md mx-auto">
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
import { ref, onMounted, computed } from 'vue'
import lodash from "lodash";
const { sortBy, last, get } = lodash;
const { $fetchArticlesWithOrganisations, $directus, $readItems, $t, $locale } = useNuxtApp();

//MetaTags
const title = ref($t("municipalities.nav_label"));
useHead({
  title,
});

const route = useRoute();
const isMapView = computed(() => route.query.view !== 'list'); // Default to map view if no query param or 'map'

// Fetch all published municipalities from directus
const { data: municipalities } = await useAsyncData("municipalities", () => {
  return $directus.request(
    $readItems("municipalities", {
      fields: ["slug", "name", "score_total", "place", "state", "date_updated", "municipality_type", "percentage_rated", "status", "geolocation"],
      sort: "-score_total",
      limit: -1,
      filter: { status: { _eq: "published" } },
    })
  )
});

const { data: projects } = await useAsyncData(
  "articles-with-organisations",
  () => $fetchArticlesWithOrganisations()
);


// todo fix "place" for these views
const majorCities = getSublist((municipality) => municipality.municipality_type === 'big_city');
const minorCities = getSublist((municipality) => municipality.municipality_type === 'small_city');

function getSublist(condition) {
  return (municipalities.value?.filter(condition) || [])
    .map((item, index) => ({
      ...item,
      place: index + 1,
    }));
}

const lastUpdatedAtStr = ref("");
onMounted(() => {
  const lastUpdatedAt = new Date(get(last(sortBy(municipalities.value, ["date_updated"])), "date_updated"));
  lastUpdatedAtStr.value =
    lastUpdatedAt.toLocaleDateString($locale, { year: "numeric", month: "2-digit", day: "numeric" }) +
    ", " +
    lastUpdatedAt.toLocaleTimeString($locale);
});

// Toggle between cities, towns, or all
const selected = ref('all')

import majorCitySelected from '~/assets/images/major-city-light.svg'
import majorCityNotSelected from '~/assets/images/major-city-dark.svg'
import minorCitySelected from '~/assets/images/minor-city-light.svg'
import minorCityNotSelected from '~/assets/images/minor-city-dark.svg'
</script>


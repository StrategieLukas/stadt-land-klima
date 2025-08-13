<template>
<div class="flex flex-col items-center mb-10 max-w-screen-xl w-full mx-auto">
  <!-- Header -->
  <div class="prose mb-8 mt-10 max-w-full text-center">
    <h1 class="mb-0 whitespace-pre-line">{{ $t("municipalities.heading") }}</h1>
    <p class="mt-0 text-xs">{{ $t("municipalities.last_updated_at") + lastUpdatedAtStr }}</p>
  </div>

  <!-- Toggle Buttons -->
  <div class="flex flex-wrap gap-2 justify-center mb-5 max-w-4xl">
    <!-- Dummy MapToggle button -->
    <button @click="mapToggle = !mapToggle"
      class="p-2 border rounded text-xs md:text-sm hover:scale-105 transition"
    >
      {{ mapToggle ? 'Show Rankings' : 'Show Map' }}
    </button>

    <!-- All / Major / Minor cities buttons -->
    <button
      class="flex items-center p-2 rounded border transition hover:scale-105 text-xs md:text-sm"
      :class="selected === 'all' ? 'bg-[#AFCA0B] text-white' : 'border-[#AFCA0B] text-[#AFCA0B]'"
      @click="selected = 'all'"
    >
      <img class="h-6 w-6 mr-1" :src="selected === 'all' ? minorCitySelected : minorCityNotSelected" alt="all"/>
      <img class="h-6 w-6 mr-2" :src="selected === 'all' ? majorCitySelected : majorCityNotSelected" alt="all"/>
      <span class="font-bold">{{ $t('municipalities.all') }}</span>
    </button>

    <button
      class="flex items-center p-2 rounded border transition hover:scale-105 text-xs md:text-sm"
      :class="selected === 'major_city' ? 'bg-[#AFCA0B] text-white' : 'border-[#AFCA0B] text-[#AFCA0B]'"
      @click="selected = 'major_city'"
    >
      <img class="h-6 w-6 mr-2" :src="selected === 'major_city' ? majorCitySelected : majorCityNotSelected"/>
      <span class="font-bold">{{ $t('municipalities.major_city.plural') }}</span>
    </button>

    <button
      class="flex items-center p-2 rounded border transition hover:scale-105 text-xs md:text-sm"
      :class="selected === 'minor_city' ? 'bg-[#AFCA0B] text-white' : 'border-[#AFCA0B] text-[#AFCA0B]'"
      @click="selected = 'minor_city'"
    >
      <img class="h-6 w-6 mr-2" :src="selected === 'minor_city' ? minorCitySelected : minorCityNotSelected"/>
      <span class="font-bold">{{ $t('municipalities.minor_city.plural') }}</span>
    </button>
  </div>

  <!-- Subtitle -->
  <p v-if="selected === 'major_city'" class="text-xs text-center italic">
    {{ $t("municipalities.major_city.threshold") }}
  </p>
  <p v-else-if="selected === 'minor_city'" class="text-xs text-center italic">
    {{ $t("municipalities.minor_city.threshold") }}
  </p>

  <!-- Map / Rankings display -->
  <div class="w-full max-w-screen-xl mt-4">
    <TheMap v-if="mapToggle && selected === 'major_city'" :municipalities="majorCities"/>
    <TheMap v-else-if="mapToggle && selected === 'minor_city'" :municipalities="minorCities"/>
    <TheMap v-else-if="mapToggle" :municipalities="municipalities"/>

    <TheRanking v-if="!mapToggle && selected === 'major_city'" :municipalities="majorCities"/>
    <TheRanking v-else-if="!mapToggle && selected === 'minor_city'" :municipalities="minorCities"/>
    <TheRanking v-else-if="!mapToggle" :municipalities="municipalities"/>
  </div>
</div>
</template>


<script setup>
import { ref, onMounted } from 'vue'
import TheMap from "~/components/TheMap.vue"
import TheRanking from "~/components/TheRanking.vue"
import lodash from "lodash";

const { sortBy, last, get } = lodash;
const { $directus, $readItems, $t, $locale } = useNuxtApp();
const mapToggle = ref(true)
const selected = ref('all')

//MetaTags
const title = ref($t("municipalities.nav_label"));
useHead({ title });

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

const majorCities = getSublist(m => m.municipality_type === 'big_city');
const minorCities = getSublist(m => m.municipality_type === 'small_city');

function getSublist(condition) {
  return (municipalities.value?.filter(condition) || [])
    .map((item, index) => ({ ...item, place: index + 1 }));
}

const lastUpdatedAtStr = ref("");
onMounted(() => {
  const lastUpdatedAt = new Date(get(last(sortBy(municipalities.value, ["date_updated"])), "date_updated"));
  lastUpdatedAtStr.value = lastUpdatedAt.toLocaleDateString($locale, { year: "numeric", month: "2-digit", day: "numeric" }) +
    ", " + lastUpdatedAt.toLocaleTimeString($locale);
});

// Icons
import majorCitySelected from '~/assets/images/major-city-light.svg'
import majorCityNotSelected from '~/assets/images/major-city-dark.svg'
import minorCitySelected from '~/assets/images/minor-city-light.svg'
import minorCityNotSelected from '~/assets/images/minor-city-dark.svg'
</script>


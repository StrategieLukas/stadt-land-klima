<script setup>
import { ref } from 'vue'
import TheMap from "~/components/TheMap.vue"
import lodash from "lodash";

const { sortBy, last, get } = lodash;
const { $directus, $readItems, $t, $locale } = useNuxtApp();
const mapToggle = ref(true)

//MetaTags
const title = ref($t("municipalities.nav_label"));
useHead({
  title,
});

// Fetch all published municipalities from directus
const { data: municipalities } = await useAsyncData("municipalities", () => {
  return $directus.request(
    $readItems("municipalities", {
      fields: ["slug", "name", "score_total", "place", "state", "date_updated", "municipality_type", "percentage_rated", "status", "geolocation"],
      sort: "-score_total",
      limit: -1,
      filter: {
        status: {
          _eq: "published",
        },
      },
    })
  )
});

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



  <!-- Show map if mapToggle is true -->
  <div v-if="mapToggle">
    <div v-if="selected === 'major_city'">
      <section>
        <TheMap :municipalities="majorCities" />
      </section>
    </div>
    <div v-else-if="selected === 'minor_city'">
      <section>
        <TheMap :municipalities="minorCities"/>
      </section>
    </div>
    <div v-else>
      <section>
        <TheMap :municipalities="municipalities"/>
      </section>
    </div>
  </div>

  <!-- Show rankings if mapToggle is false -->
  <div v-else>
    <div v-if="selected === 'major_city'">
      <section>
        <TheRanking :municipalities="majorCities"/>
      </section>
    </div>
    <div v-else-if="selected === 'minor_city'">
      <section>
        <TheRanking :municipalities="minorCities"/>
      </section>
    </div>
    <div v-else>
      <section>
        <TheRanking :municipalities="municipalities"/>
      </section>
    </div>
  </div>

</template>

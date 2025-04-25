<script setup>
import { ref } from 'vue'
import lodash from "lodash";
const { sortBy, last, get } = lodash;
const { $directus, $readItems, $t, $locale } = useNuxtApp();

//MetaTags
const title = ref($t("municipalities.nav_label"));
useHead({
  title,
});

// Fetch all published municipalities from directus
const { data: municipalities } = await useAsyncData("municipalities", () => {
  return $directus.request(
    $readItems("municipalities", {
      fields: ["slug", "name", "score_total", "place", "state", "date_updated", "municipality_type"],
      sort: "-score_total",
      limit: -1,
      filter: {
        status: {
          _eq: "published",
        },
      },
    }),
  );
});

// todo fix "place" for these views
const cities = getSublist((municipality) => municipality.municipality_type === 'big_city');
const towns = getSublist((municipality) => municipality.municipality_type === 'small_city');

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

import citySelected from '~/assets/images/city-light.svg'
import cityNotSelected from '~/assets/images/city-dark.svg'
import townSelected from '~/assets/images/town-light.svg'
import townNotSelected from '~/assets/images/town-dark.svg'
// TODO - translations
</script>

<template>

  <div>
    <div class="prose mb-8 mt-10 max-w-full text-center">
      <h1 class="mb-0 whitespace-pre-line">
        {{ $t("municipalities.heading") }}
      </h1>
      <p class="mt-0 text-xs">
        {{ $t("municipalities.last_updated_at") + lastUpdatedAtStr }}
      </p>
    </div>
  </div>

  <!-- Button row -->
  <div class="flex flex-row justify-center gap-2 w-full px-4 sm:px-0 sm:w-auto sm:gap-4">
    <!-- Major cities -->
    <div class="flex flex-col items-center w-1/2 sm:w-[22%] max-w-[240px]">
      <img :src="selected === 'city' ? citySelected : cityNotSelected" alt="Großstädte"
        class="cursor-pointer w-full h-auto" @click="selected = (selected === 'city' ? 'all' : 'city')" />
      <p v-if="selected === 'city'" class="text-xs text-center mt-1 italic">
        ab 100.000 Personen
      </p>
      <!-- Blank space to stop menu from bobbing up and down when buttons are selected and subtitles appear -->
      <p v-else class="h-8"></p>
    </div>

    <!-- Small cities -->
    <div class="flex flex-col items-center w-1/2 sm:w-[22%] max-w-[240px]">
      <img :src="selected === 'town' ? townSelected : townNotSelected" alt="Städte und Gemeinden"
        class="cursor-pointer w-full h-auto" @click="selected = (selected === 'town' ? 'all' : 'town')" />
      <p v-if="selected === 'town'" class="text-xs text-center mt-1 italic">
        unter 100.000 Personen
      </p>
      <!-- Blank space to stop menu from bobbing up and down when buttons are selected and subtitles appear -->
      <p v-else class="h-8"></p>
    </div>
  </div>



  <!-- Conditional Content -->
  <div v-if="selected === 'city'">
    <section>
      <the-ranking :municipalities="cities"></the-ranking>
    </section>
  </div>
  <div v-if="selected === 'town'">
    <section>
      <the-ranking :municipalities="towns"></the-ranking>
    </section>
  </div>
  <div v-else>
    <section>
      <the-ranking :municipalities="municipalities"></the-ranking>
    </section>
  </div>

</template>

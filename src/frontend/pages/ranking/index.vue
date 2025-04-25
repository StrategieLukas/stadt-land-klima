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
const cities = municipalities.value?.filter((municipality) => municipality.municipality_type === 'big_city') || [];
const towns = municipalities.value?.filter((municipality) => municipality.municipality_type === 'small_city') || [];


const lastUpdatedAtStr = ref("");
onMounted(() => {
  const lastUpdatedAt = new Date(get(last(sortBy(municipalities.value, ["date_updated"])), "date_updated"));
  lastUpdatedAtStr.value =
    lastUpdatedAt.toLocaleDateString($locale, { year: "numeric", month: "2-digit", day: "numeric" }) +
    ", " +
    lastUpdatedAt.toLocaleTimeString($locale);
});

// Toggle between "grossstaedte" and "gemeinden"
const selected = ref('city')

import citySelected from '~/assets/images/city-light.svg'
import cityNotSelected from '~/assets/images/city-dark.svg'
import townSelected from '~/assets/images/town-light.svg'
import townNotSelected from '~/assets/images/town-dark.svg'
// TODO - translations
</script>

<template>
  <div class="flex flex-col items-center mb-10">
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
    <div class="flex gap-2 mb-1">
      <!-- Major cities -->
      <img
        :src="selected === 'city'
          ? citySelected
          : cityNotSelected"
        alt="Großstädte"
        class="cursor-pointer h-10"
        @click="selected = 'city'"
      />

      <!-- Small cities -->
      <img
        :src="selected === 'town'
          ? townSelected
          : townNotSelected"
        alt="Städte und Gemeinden"
        class="cursor-pointer h-10"
        @click="selected = 'town'"
      />
    </div>

  </div>



    <!-- Conditional Content -->
    <div v-if="selected === 'city'">
      <section>
        <the-ranking :municipalities="cities"></the-ranking>
      </section>
    </div>
    <div v-else>
      <section>
        <the-ranking :municipalities="towns"></the-ranking>
      </section>
    </div>
  
</template>

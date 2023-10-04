<template lang="">
  <div class="w-full flex-col justify-center">
    <div class="mb-8">
      <item-ranking :municipality="municipality" />
    </div>
    <div class="mb-4">
      <municipality-polar-chart :sub-scores="subScores" :name-municipality="municipality.name" />
    </div>
    <p class="mb-4 mt-0 text-center text-xs">
      {{ $t("municipalities.last_updated_at") + lastUpdatedAtStr  }}
    </p>
    <div class="mx-auto mb-8 flex justify-center">
      <implementation-traffic-light />
    </div>

    <!-- Accordion -->
    <!-- Municipality description -->
    <div class="collapse collapse-plus rounded-sm p-2 shadow-list">
      <input type="radio" name="sectors-accordion" checked="checked" />

      <div class="collapse-title flex items-end gap-4">
        <img src="~/assets/icons/icon_location.svg" class="h-auto w-10 opacity-50" />

        <h2 class="font-heading text-2xl leading-none text-green">
          {{ $t("municipality.about_heading", { ":name": municipality.name }) }}
        </h2>
      </div>

      <div class="collapse-content">
        <div class="prose" v-html="municipality.description"></div>
      </div>
    </div>

    <!-- Measures -->
    <div
      v-for="(sectorRatings, sector) in sortedRatings"
      :key="sector"
      class="collapse-plus collapse rounded-sm p-2 shadow-list"
    >
      <input type="radio" name="sectors-accordion" />

      <div class="collapse-title flex items-end gap-4">
        <img :src="sectorImages[sector]" class="h-auto w-10 opacity-50" />

        <h2 class="font-heading text-2xl leading-none text-green">
          {{ $t(`measure_sectors.${sector}.title`) }}
        </h2>
      </div>

      <div class="collapse-content">
        <ul class="mb-8 divide-y divide-slate-300">
          <li
            v-for="item in sectorRatings"
            :key="item.id"
            :class="[ratingColorClass[transformToArrayPositions(item.rating)], 'flex items-center justify-stretch gap-3 bg-opacity-10 p-3']"
          >
            <div class="shrink-0">
              <img :src="ratingImages[transformToArrayPositions(item.rating)]" class="my-auto h-auto w-5" />
            </div>

            <div class="grow text-sm">
              {{ item.measure.name }}
            </div>

            <NuxtLink
              :to="`/measures/${item.measure.slug}`"
              class="flex h-5 w-5 shrink-0 items-center justify-center self-start rounded-full bg-slate-500 text-sm font-bold text-white hover:bg-slate-600 focus:bg-slate-600"
              target="measure"
            >
              ?
            </NuxtLink>
          </li>
        </ul>

        <ul class="flex items-end gap-4">
          <li v-for="(rating,index) in 4" class="flex flex-col items-center gap-4">
            <img :src="ratingImages[index]" class="h-auto w-5" />
            <div>{{ $t(`measure_rating.${index}_caption`) }}</div>
          </li>
        </ul>
      </div>
    </div>

    <!-- Participate -->
    <div class="collapse-plus collapse rounded-sm p-2 shadow-list">
      <input type="radio" name="sectors-accordion" checked="checked" />

      <div class="collapse-title flex items-end gap-4">
        <img src="~/assets/icons/icon_team.svg" class="h-auto w-10 opacity-50" />

        <h2 class="font-heading text-2xl leading-none text-green">
          {{ $t("municipality.participate_heading") }}
        </h2>
      </div>

      <div class="collapse-content">
        <div class="prose whitespace-pre-line">
          {{ $t("municipality.participate_body") }}
        </div>
      </div>
    </div>

    <!-- Data collection -->
    <div class="collapse-plus collapse rounded-sm p-2 shadow-list">
      <input type="radio" name="sectors-accordion" checked="checked" />

      <div class="collapse-title flex items-end gap-4">
        <img src="~/assets/icons/icon_info.svg" class="h-auto w-10 opacity-50" />

        <h2 class="font-heading text-2xl leading-none text-green">
          {{ $t("municipality.data_collection_heading") }}
        </h2>
      </div>

      <div class="collapse-content">
        <div class="prose whitespace-pre-line">
          {{ $t("municipality.data_collection_body") }}
        </div>
      </div>
    </div>
  </div>
</template>
<script setup>
import lodash from "lodash";
const { range } = lodash;
import sectorImages from "../shared/sectorImages.js";
import ratingImages from "../shared/ratingImages.js";
const { $t, $locale } = useNuxtApp();
const props = defineProps({
  municipality: {
    type: Object,
    required: true,
  },
  sortedRatings: {
    type: Object,
    required: true,
  },
});
const ratingColorClass = {
  3: "bg-rating-2",
  2: "bg-light-green",
  1: "bg-rating-1",
  0: "bg-rating-0",
};
let lastUpdatedAtStr =ref("");
onMounted(() => {
  const lastUpdatedAt = new Date(municipality.date_updated);
    lastUpdatedAtStr.value =
    lastUpdatedAt.toLocaleDateString($locale, { year: "numeric", month: "2-digit", day: "numeric" }) +
    ", " +
    lastUpdatedAt.toLocaleTimeString($locale);
})

const municipality = props.municipality;
const subScores = createSubScoreObject(municipality);


function createSubScoreObject(municipality) {
  const temp = {};
  for (const [key, value] of Object.entries(municipality)) {
    if (key.includes("score")) {
      temp[key] = value;
    }
  }
  return temp;
}
function transformToArrayPositions(value) {
  const tempVal = Number(value);
  if (tempVal === 0) return 0;
  if (tempVal === 0.3333) return 1;
  if (tempVal === 0.6666) return 2;
  return 3
}
</script>
<style lang=""></style>

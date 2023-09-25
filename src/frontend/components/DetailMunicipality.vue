<template lang="">
  <div class="w-full flex-col justify-center">
    <div class="mb-8">
      <item-ranking :municipality="municipality" />
    </div>
    <div class="mb-4">
      <municipality-polar-chart
        :sub-scores="subScores"
        :name-municipality="municipality.name"
      />
      <div
        v-for="key in Object.keys(sortedRatings)" :key="key" class="py-2"
      >
        <collapse-sector :ratingsSector="sortedRatings[key]" />
      </div>
    </div>
    <p class="mt-0 text-xs text-center mb-4">
      {{ $t('municipalities.last_updated_at', {':updated_at': lastUpdatedAtStr }) }}
    </p>
    <div class="mx-auto flex justify-center mb-8">
      <implementation-traffic-light />
    </div>

    <div class="collapse p-2 rounded-sm shadow-list">
      <input type="radio" name="sectors-accordion" checked="checked" />

      <div class="collapse-title flex items-end gap-4">
        <img src="~/assets/icons/icon_location.svg" class="w-10 h-auto opacity-50" />

        <h2 class="font-heading text-light-green text-2xl leading-none">
          {{ $t('municipality.about_heading', {':name': municipality.name }) }}
        </h2>

        <img src="~/assets/icons/icon_chevron_right.svg" class="ml-auto rotate-90 w-4 h-auto" />
      </div>

      <div class="collapse-content">
        <div class="prose" v-html="municipality.description"></div>
      </div>
    </div>

    <div
      v-for="sector in Object.keys(sortedRatings)"
      :key="sector"
      class="collapse p-2 rounded-sm shadow-list"
    >
      <div class="collapse-title flex items-end gap-4">
        <img :src="sectorImages[sector]" class="w-10 h-auto opacity-50" />

        <h2 class="font-heading text-light-green text-2xl leading-none">
          {{ $t(`measure_sectors.${sector}.title`) }}
        </h2>

        <img src="~/assets/icons/icon_chevron_right.svg" class="ml-auto rotate-90 w-4 h-auto" />
      </div>

      <div class="collapse-content">
        <div class="prose">
          {{ $t(`measure_sectors.${sector}.description`) }}
        </div>
      </div>
    </div>
  </div>
</template>
<script setup>
const { $t, $locale } = useNuxtApp();
import sectorImages from '../shared/sectorImages.js';
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
const municipality = props.municipality;
const subScores = createSubScoreObject(municipality);
const lastUpdatedAt = new Date(municipality.date_updated);
const lastUpdatedAtStr = lastUpdatedAt.toLocaleDateString($locale, {year: 'numeric', month: '2-digit', day: 'numeric'}) + ', ' + lastUpdatedAt.toLocaleTimeString($locale);

function createSubScoreObject(municipality) {
  const temp = {};
  for (const [key, value] of Object.entries(municipality)) {
    if (key.includes("score")) {
      temp[key] = value;
    }
  }
  return temp;
}
</script>
<style lang=""></style>

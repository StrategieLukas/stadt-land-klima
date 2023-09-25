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
    </div>
    <p class="mt-0 text-xs text-center mb-4">
      {{ $t('municipalities.last_updated_at', {':updated_at': lastUpdatedAtStr }) }}
    </p>
    <div class="mx-auto flex justify-center mb-8">
      <implementation-traffic-light />
    </div>

    <!-- Accordion -->
    <!-- Municipality description -->
    <div class="collapse collapse-plus p-2 rounded-sm shadow-list">
      <input type="radio" name="sectors-accordion" checked="checked" />

      <div class="collapse-title flex items-end gap-4">
        <img src="~/assets/icons/icon_location.svg" class="w-10 h-auto opacity-50" />

        <h2 class="font-heading text-green text-2xl leading-none">
          {{ $t('municipality.about_heading', {':name': municipality.name }) }}
        </h2>
      </div>

      <div class="collapse-content">
        <div class="prose" v-html="municipality.description"></div>
      </div>
    </div>

    <!-- Measures -->
    <div
      v-for="sectorRatings, sector in sortedRatings"
      :key="sector"
      class="collapse collapse-plus p-2 rounded-sm shadow-list"
    >
      <input type="radio" name="sectors-accordion" />

      <div class="collapse-title flex items-end gap-4">
        <img :src="sectorImages[sector]" class="w-10 h-auto opacity-50" />

        <h2 class="font-heading text-green text-2xl leading-none">
          {{ $t(`measure_sectors.${sector}.title`) }}
        </h2>
      </div>

      <div class="collapse-content">
        <ul class="divide-y divide-slate-300 mb-8">
          <li
            v-for="item in sectorRatings"
            :key="item.id"
            :class="[ratingColorClass[item.rating], 'bg-opacity-10 p-3 flex items-center justify-stretch gap-3']"
          >
            <div class="shrink-0">
              <img :src="ratingImages[item.rating]" class="w-5 h-auto my-auto" />
            </div>

            <div class="grow text-sm">
              {{ item.measure.name }}
            </div>

            <NuxtLink
              :to="`/measures/${item.measure.slug}`"
              class="shrink-0 self-start rounded-full text-white flex items-center justify-center w-5 h-5 text-sm font-bold bg-slate-500 hover:bg-slate-600 focus:bg-slate-600"
              target="measure"
            >
              ?
            </NuxtLink>
          </li>
        </ul>

        <ul class="flex items-end gap-4">
          <li v-for="rating in range(3, 0)" class="flex flex-col gap-4 items-center">
            <img :src="ratingImages[rating]" class="w-5 h-auto" />
            <div>{{ $t(`measure_rating.${rating}_caption`) }}</div>
          </li>
        </ul>
      </div>
    </div>

    <!-- Participate -->
    <div class="collapse collapse-plus p-2 rounded-sm shadow-list">
      <input type="radio" name="sectors-accordion" checked="checked" />

      <div class="collapse-title flex items-end gap-4">
        <img src="~/assets/icons/icon_team.svg" class="w-10 h-auto opacity-50" />

        <h2 class="font-heading text-green text-2xl leading-none">
          {{ $t('municipality.participate_heading') }}
        </h2>
      </div>

      <div class="collapse-content">
        <div class="prose whitespace-pre-line">
          {{ $t('municipality.participate_body') }}
        </div>
      </div>
    </div>

    <!-- Data collection -->
    <div class="collapse collapse-plus p-2 rounded-sm shadow-list">
      <input type="radio" name="sectors-accordion" checked="checked" />

      <div class="collapse-title flex items-end gap-4">
        <img src="~/assets/icons/icon_info.svg" class="w-10 h-auto opacity-50" />

        <h2 class="font-heading text-green text-2xl leading-none">
          {{ $t('municipality.data_collection_heading') }}
        </h2>
      </div>

      <div class="collapse-content">
        <div class="prose whitespace-pre-line">
          {{ $t('municipality.data_collection_body') }}
        </div>
      </div>
    </div>
  </div>
</template>
<script setup>
import { range } from 'lodash';
import sectorImages from '../shared/sectorImages.js';
import ratingImages from '../shared/ratingImages.js';
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
  3: 'bg-rating-3',
  2: 'bg-rating-2',
  1: 'bg-rating-1',
};
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

<template>
  <div
    v-for="(sectorRatings, sector) in sortedRatings"
    :key="sector"
    class="collapse-plus collapse rounded-sm p-2 px-0 shadow-list md:px-2 mb-4"
  >
    <input type="checkbox" name="sectors-accordion" autocomplete="off" />
    <div class="collapse-title flex items-start gap-4 px-2 md:px-4">
      <img :src="sectorImages[sector]" class="h-auto w-12 opacity-50 md:w-14 lg:w-18" />
      <div class="grow">
        <h2 class="mb-2 font-heading text-h2 leading-none text-green">
          {{ $t(`measure_sectors.${sector}.title`) }}
        </h2>
        <ProgressBar
          :score-total="Math.round(Number(municipality['score_' + sector]) * 10) / 10"
          layout="compact"
        />
      </div>
    </div>
    <div class="collapse-content px-2 md:px-4">
      <h3 class="mb-2 font-heading text-h2 text-black">
        {{ $t("measure_sector.measures_in_detail") }}
      </h3>
      <ul class="mb-2 flex items-end justify-center gap-4">
        <li
          v-for="(rating, _) in [0, 1, 2, 3, null]"
          :key="`rating-image-${rating}`"
          class="flex flex-col items-center"
        >
          <img :src="ratingIcons[rating]" class="h-auto w-5" />
          <div class="text-sm">
            {{ $t(rating === null ? 'measure_rating.not_applicable_caption' : `measure_rating.${rating}_caption`) }}
          </div>
        </li>
      </ul>
      <ul class="mb-8 divide-y-2 divide-slate-300">
        <li v-for="item in sectorRatings" :key="item.id">
          <div class="collapse-plus collapse rounded-none">
            <input
              type="checkbox"
              :id="`rating-${item.id}-accordion`"
              v-model="openItems[item.id]"
              autocomplete="off"
            />

            <!-- Header -->
            <div
              :class="[
                ratingColor[ratingIndex(item.rating)],
                ratingHeaderOpacity[ratingIndex(item.rating)],
                'collapse-title flex items-center justify-stretch gap-3 p-3 px-2 pr-6 md:px-4'
              ]"
            >
              <div class="shrink-0">
                <img
                  :src="ratingIcons[ratingIndex(item.rating)]"
                  class="my-auto h-auto w-5"
                />
              </div>

              <h3 class="font-heading text-h3 font-medium">
                {{ item.measure.name }}
              </h3>
            </div>

            <!-- Content (lazy loaded) -->
            <div
              :class="[
                ratingColor[ratingIndex(item.rating)],
                ratingTextOpacity[ratingIndex(item.rating)],
                'collapse-content md:px-12 lg:px-12'
              ]"
            >
              <!-- Mount only when collapse is opened -->
              <KeepAlive>
                <MeasureDetails
                  v-if="openItems[item.id]"
                  :measure_rating="item"
                  :municipality="municipality"
                />
              </KeepAlive>
            </div>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import sectorImages from "../shared/sectorImages.js";
import ratingIcons, { ratingIndex } from "../shared/ratingIcons.js";
import { ratingColor, ratingTextOpacity, ratingHeaderOpacity } from "../shared/ratingColors.js";
import ProgressBar from '~/components/ProgressBar.vue'
import MeasureDetails from '~/components/MeasureDetails.vue'
import { reactive } from 'vue'

// Track which collapses are open
const openItems = reactive({})

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
</script>

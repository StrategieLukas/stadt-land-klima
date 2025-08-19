<template lang="">
  <div class="w-full flex-col justify-center">
    <div class="mb-8">
      <item-ranking :municipality="municipality" />
    </div>
    <div class="mb-4">
      <municipality-polar-chart :sub-scores="subScores" :name-municipality="municipality.name" />
    </div>
    <p class="mb-4 mt-0 text-center text-xs">
      {{ $t("municipalities.last_updated_at") + formatLastUpdated(municipality.date_updated, $locale) }}
    </p>
    <div class="mx-auto mb-8 flex justify-center">
      <implementation-traffic-light />
    </div>

    <!-- Accordion -->
    <!-- Municipality description -->
    <div v-if="municipality.description" class="collapse-plus collapse rounded-sm p-2 px-0 shadow-list md:px-2">
      <input type="checkbox" name="sectors-accordion" checked="checked" autocomplete="off" />

      <div class="collapse-title flex items-center gap-4 px-2 md:px-4">
        <img src="~/assets/icons/icon_location.svg" class="h-auto w-12 opacity-50 md:w-14 lg:w-18" />

        <h2 class="font-heading text-h2 leading-none text-green">
          {{ $t("municipality.about_heading", { ":name": municipality.name }) }}
        </h2>
      </div>

      <div class="collapse-content px-2 md:px-4">
        <div class="has-long-links prose" v-html="sanitizeHtml(linkifyStr(municipality.description))"></div>
      </div>
    </div>

    <!-- Notice about current developments, if it exists -->
    <div v-if="municipality.overall_status_comment" class="collapse-plus collapse rounded-sm p-2 px-0 shadow-list md:px-2">
      <input type="checkbox" name="sectors-accordion" autocomplete="off" />

      <div class="collapse-title flex items-center gap-4 px-2 md:px-4">
        <img src="~/assets/icons/icon_info.svg" class="h-auto w-12 opacity-50 md:w-14 lg:w-18" />

        <h2 class="font-heading text-h2 leading-none text-green">
          {{ $t("municipality.overall_status_heading") }}
        </h2>
      </div>

      <div v-if="municipality.overall_status_comment" class="collapse-content px-2 md:px-4">
        <div class="has-long-links prose" v-html="sanitizeHtml(linkifyStr(municipality.overall_status_comment))"></div>
      </div>
    </div>


    <!-- Measures -->
    <div
      v-for="(sectorRatings, sector) in sortedRatings"
      :key="sector"
      class="collapse-plus collapse rounded-sm p-2 px-0 shadow-list md:px-2"
    >
      <input type="checkbox" name="sectors-accordion" autocomplete="off" />

      <!-- Sector header -->
      <div class="collapse-title flex items-start gap-4 px-2 md:px-4">
        <img :src="sectorImages[sector]" class="h-auto w-12 opacity-50 md:w-14 lg:w-18" />

        <div class="grow">
          <h2 class="mb-2 font-heading text-h2 leading-none text-green">
            {{ $t(`measure_sectors.${sector}.title`) }}
          </h2>
          <ProgressBar :score-total="Math.round(Number(municipality['score_' + sector]) * 10) / 10" layout="compact" />
        </div>
      </div>

      <div class="collapse-content px-2 md:px-4">
        <!-- Additional Info above the list of measure -->
        <h3 class="mb-2 font-heading text-h2 text-black">
          {{ $t("measure_sector.measures_in_detail") }}
        </h3>
        <ul class="mb-2 flex items-end justify-center gap-4">
          <li v-for="(rating, _) in [0,1,2,3,null]" :key="`rating-image-${rating}`" class="flex flex-col items-center">
            <img :src="ratingIcons[rating]" class="h-auto w-5" />
            <div class="text-sm">{{ $t(rating === null ? 'measure_rating.not_applicable_caption' : `measure_rating.${rating}_caption`) }}</div>
          </li>
        </ul>

        <!-- List of individual measure ratings for the given sector -->

        <ul class="mb-8 divide-y-2 divide-slate-300">
          <li
            v-for="item in sectorRatings"
            :key="item.id"
          >
            <div class="collapse-plus collapse rounded-none">
              <input type="checkbox" :name="`rating-${item.id}-accordion`" autocomplete="off"/>

              <div
                :class="[`${ratingColor[ratingIndex(item.rating)]}-light`,
                'collapse-title text-black flex items-center justify-stretch gap-3 p-3 px-2 pr-6 md:px-4']"
              >
                <div class="shrink-0">
                  <img :src="ratingIcons[ratingIndex(item.rating)]" class="my-auto h-auto w-5" />
                </div>

                <h3 class="font-heading text-h3 font-medium">
                  {{ item.measure.name }}
                </h3>
              </div>

              <!-- More info on the measure when clicked -->
              <div
                :class="[
                  `${ratingColor[ratingIndex(item.rating)]}-light`,
                  'collapse-content md:px-12 lg:px-12'
                ]"
              >
                <MeasureDetails :measure_rating="item" :municipality="municipality" />
              </div>
            </div>
          </li>
        </ul>
      </div>
    </div>

    <!-- Participate -->
    <div class="collapse-plus collapse rounded-sm p-2 px-0 shadow-list md:px-2">
      <input type="checkbox" name="sectors-accordion" autocomplete="off" />

      <div class="collapse-title flex items-center gap-4 px-2 md:px-4">
        <img src="~/assets/icons/icon_team.svg" class="h-auto w-12 opacity-50 md:w-14 lg:w-18" />

        <h2 class="font-heading text-h2 leading-none text-green">
          {{ $t("municipality.participate_heading") }}
        </h2>
      </div>

      <div v-if="municipality.public_contact" class="collapse-content px-2 md:px-4">
        <div class="has-long-links prose" v-html="sanitizeHtml(linkifyStr(municipality.public_contact))"></div>
      </div>
    </div>

    <!-- Data collection -->
    <!-- <div class="collapse-plus collapse rounded-sm p-2 px-0 shadow-list md:px-2">
      <input type="checkbox" name="sectors-accordion" autocomplete="off" />

      <div class="collapse-title flex items-end gap-4 px-2 md:px-4">
        <img src="~/assets/icons/icon_info.svg" class="h-auto w-12 opacity-50 md:w-14 lg:w-18" />

        <h2 class="font-heading text-h2 leading-none text-green">
          {{ $t("municipality.data_collection_heading") }}
        </h2>
      </div>

      <div class="collapse-content px-2 md:px-4">
        <div class="prose whitespace-pre-line">
          {{ $t("municipality.data_collection_body") }}
        </div>
      </div>
    </div> -->
  </div>
</template>

<script setup>
import lodash from "lodash";
import sanitizeHtml from "sanitize-html";
import linkifyStr from "linkify-string";
import sectorImages from "../shared/sectorImages.js";
import ratingIcons, { ratingIndex } from "../shared/ratingIcons.js";
import { formatLastUpdated } from "../shared/utils.js";
import { ratingColor } from "../shared/ratingColors.js";

const { range } = lodash;
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


const municipality = props.municipality;
const subScores = createSubScoreObject(municipality);

function createSubScoreObject(municipality) {
  const temp = {};
  for (const [key, value] of Object.entries(municipality)) {
    if (key.includes("score")) {
      temp[key] = Number(value);
    }
  }
  return temp;
}

</script>
<style lang=""></style>

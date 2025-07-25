<template lang="">
  <div class="w-full flex-col justify-center">
    <div class="mb-8">
      <item-ranking :municipality="municipality" />
    </div>
    <div class="mb-4">
      <municipality-polar-chart :sub-scores="subScores" :name-municipality="municipality.name" />
    </div>
    <p class="mb-4 mt-0 text-center text-xs">
      {{ $t("municipalities.last_updated_at") + formatLastUpdated(municipality.date_updated) }}
    </p>
    <div class="mx-auto mb-8 flex justify-center">
      <implementation-traffic-light />
    </div>

    <!-- Accordion -->
    <!-- Municipality description -->
    <div class="collapse-plus collapse rounded-sm p-2 px-0 shadow-list md:px-2">
      <input type="checkbox" name="sectors-accordion" checked="checked" autocomplete="off" />

      <div class="collapse-title flex items-center gap-4 px-2 md:px-4">
        <img src="~/assets/icons/icon_location.svg" class="h-auto w-12 opacity-50 md:w-14 lg:w-18" />

        <h2 class="font-heading text-h2 leading-none text-green">
          {{ $t("municipality.about_heading", { ":name": municipality.name }) }}
        </h2>
      </div>

      <div class="collapse-content px-2 md:px-4">
        <div class="has-long-links prose" v-html="sanitizeHtml(municipality.description)"></div>
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

      <div class="collapse-content px-2 md:px-4">
        <div class="has-long-links prose" v-html="sanitizeHtml(municipality.overall_status_comment)"></div>
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
            <img :src="ratingImages[rating]" class="h-auto w-5" />
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
              :class="[ratingColor[ratingIndex(item.rating)], ratingHeaderOpacity[ratingIndex(item.rating)], 'collapse-title flex items-center justify-stretch gap-3 p-3 px-2 pr-6 md:px-4']"
              >
                <div class="shrink-0">
                  <img :src="ratingImages[ratingIndex(item.rating)]" class="my-auto h-auto w-5" />
                </div>

                <h3 class="font-heading text-h3 font-medium">
                  {{ item.measure.name }}
                </h3>
              </div>

              <!-- More info on the measure when clicked -->
              <div 
              :class="[ratingColor[ratingIndex(item.rating)], ratingTextOpacity[ratingIndex(item.rating)], 'collapse-content md:px-12 lg:px-12']"
              >
                <MeasureDetails :measure="item.measure" />
                
                <div v-if="item.applicable">
                  <div v-if="item.current_progress" class="mb-4">
                    <h4 class="mb-2 text-light-blue">
                      {{ $t("ratings_measure.achievement_heading") }}
                    </h4>

                    <div class="has-long-links prose whitespace-pre-line" v-html="linkifyStr(item.current_progress)" />
                  </div>
                  <div v-if="item.source">
                    <h4 class="mb-2 text-light-blue">
                      {{ $t("ratings_measure.source_heading") }}
                    </h4>

                    <div class="has-long-links prose whitespace-pre-line" v-html="linkifyStr(item.source)" />
                  </div>
                  <dl v-if="item.date_updated" class="mt-2 flex flex-row gap-2 text-sm">
                    <dt class="font-bold">{{ $t("ratings_measure.last_updated") }}:</dt>
                    <dd>{{ formatLastUpdated(item.date_updated) }}</dd>
                  </dl>
                </div>

                <div v-if="!item.applicable">
                  <div v-if="item.why_not_applicable">
                    <h4 class="mb-2 text-light-blue">
                      {{ $t("ratings_measure.why_not_applicable_heading") }}
                    </h4>

                    <div class="has-long-links prose whitespace-pre-line" v-html="linkifyStr(item.why_not_applicable)" />
                  </div>
                </div>

                <div class="mt-8">
                  <NuxtLink
                    :to="`/measures/sectors/${sector}#measure-${item.measure.slug}`"
                    class="text-light-blue underline"
                    target="measure"
                  >
                    {{ $t("municipality_rating.link_to_measure") }} ↗
                  </NuxtLink>
                </div>
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

      <div class="collapse-content px-2 md:px-4">
        <div class="has-long-links prose" v-html="sanitizeHtml(municipality.public_contact)"></div>
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
const { range } = lodash;
import sectorImages from "../shared/sectorImages.js";
import ratingImages from "../shared/ratingImages.js";
import { ratingColor, ratingTextOpacity, ratingHeaderOpacity } from "../shared/ratingColors.js";
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

/**
 * @param {string} dateString
 * @returns {string} Properly formatted date and time
 */
const formatLastUpdated = (dateString) => {
  const lastUpdatedAt = new Date(dateString);
  return `${lastUpdatedAt.toLocaleDateString($locale, {
    year: "numeric",
    month: "2-digit",
    day: "numeric",
  })}, ${lastUpdatedAt.toLocaleTimeString($locale)}`;
};

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
function ratingIndex(value) {
  if(value === null) return null;
  const tempVal = Number(value);
  if (tempVal === 0) return 0;
  if (tempVal === 0.3333) return 1;
  if (tempVal === 0.6666) return 2;
  return 3;
}
</script>
<style lang=""></style>

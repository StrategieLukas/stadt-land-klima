<template>
  <div
    class="slk-ranking-card relative mb-3 flex items-stretch gap-4 px-4 py-5 sm:pl-10"
    :class="[isRanking ? 'shadow-list' : '', colorClass.bg, colorClass.theme]"
    :data-testid="isRanking ? undefined : 'municipality-assessment-summary'"
  >
    <div class="relative h-full shrink-0 pt-6">
      <img src="~/assets/icons/icon_location_green_marker.svg" alt="" class="my-auto h-auto w-8" />

      <div
        class="absolute top-0 w-full text-center font-heading text-3xl font-bold break-keep whitespace-nowrap text-black"
      >
        {{ (municipalityScore.rank ?? 0) > 0 ? municipalityScore.rank : "?" }}
      </div>
    </div>

    <div class="min-w-0 grow">
      <div class="flex flex-row items-start">
        <div class="mb-2">
          <h3 class="font-heading text-h2 font-bold break-words text-black">
            {{ isRanking ? municipality.name : $t("municipality.hero.score") }}
          </h3>
          <p v-if="isRanking">{{ municipality.state }}</p>
          <p v-else class="text-sm">
            {{ $t("municipality.hero.catalog", { ":version": municipalityScore.catalog_version.name }) }}
          </p>
        </div>
      </div>
      <progress-bar :score-total="scoreTotalRounded"></progress-bar>
    </div>

    <div v-if="isRanking" class="flex items-start">
      <svg
        class="h-6 w-4 text-black dark:text-white"
        viewBox="0 0 14 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        aria-hidden="true"
      >
        <path d="M1 1l12 11L1 23" />
      </svg>
    </div>
    <PdfExportForm
      v-else-if="complete"
      class="shrink-0"
      :action="`/api/pdf/municipality/${municipality.slug}`"
      :request="{ slug: municipality.slug, catalogVersion: props.municipalityScore.catalog_version?.name }"
    >
      <button
        type="submit"
        class="flex h-10 w-16 cursor-pointer items-center justify-center bg-gray text-white focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        {{ $t("municipality.hero.pdf") }}
      </button>
    </PdfExportForm>
  </div>
</template>
<script setup lang="ts">
import type { PropType } from "vue";
import type { MunicipalityScore } from "~/types/components/municipality";
import { isMunicipalityScoreComplete } from "~/shared/municipality-score-publishing";

const props = defineProps({
  municipalityScore: {
    type: Object as PropType<MunicipalityScore>,
    required: true,
  },
  isRanking: {
    type: Boolean as PropType<boolean | undefined>,
    required: false,
    default: false,
  },
});
const municipality = computed(() => props.municipalityScore.municipality);
const scoreTotalRounded = computed(() => Math.round(Number(props.municipalityScore.score_total) * 10) / 10);
const complete = computed(() => isMunicipalityScoreComplete(props.municipalityScore));

const colors = {
  0: { bg: "bg-rating-0/10", theme: "slk-ranking-card--rating-0" },
  20: { bg: "bg-rating-1/10", theme: "slk-ranking-card--rating-1" },
  40: { bg: "bg-rating-2/10", theme: "slk-ranking-card--rating-2" },
  60: { bg: "bg-rating-3/10", theme: "slk-ranking-card--rating-3" },
  80: { bg: "bg-rating-4/10", theme: "slk-ranking-card--rating-4" },
};

const colorClass = computed(() => {
  let c = colors[0];

  for (const [score, color] of Object.entries(colors)) {
    if (Number(props.municipalityScore.score_total) < Number(score)) {
      return c;
    }

    c = color;
  }

  return c;
});
</script>
<style lang=""></style>

<template>
  <div
    class="relative mb-3 flex items-stretch gap-4 py-5 pr-4 pl-10"
    :class="[isRanking ? 'shadow-list' : '', colorClass.bg]"
  >
    <div class="relative h-full pt-6">
      <img src="~/assets/icons/icon_location_green_marker.svg" class="my-auto h-auto w-8" />

      <div
        class="absolute top-0 w-full text-center font-heading text-3xl font-bold break-keep whitespace-nowrap text-black"
      >
        {{ (municipalityScore.rank ?? 0) > 0 ? municipalityScore.rank : "?" }}
      </div>
    </div>

    <div class="grow">
      <div class="flex flex-row items-start">
        <div class="mb-2">
          <h3 class="font-heading text-h2 font-bold text-black">{{ municipality.name }}</h3>
          <p>{{ municipality.state }}</p>
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
      v-else
      :action="`/api/pdf/municipality/${municipality.slug}`"
      :request="{ slug: municipality.slug, catalogVersion: props.municipalityScore.catalog_version?.name }"
    >
      <button type="submit" class="flex h-10 w-16 cursor-pointer items-center justify-center bg-gray text-white">
        PDF
      </button>
    </PdfExportForm>
  </div>
</template>
<script setup lang="ts">
import type { PropType } from "vue";
import type { MunicipalityScore } from "~/types/components/municipality";

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
const municipality = props.municipalityScore.municipality;
const scoreTotalRounded = Math.round(Number(props.municipalityScore.score_total) * 10) / 10;

const colors = {
  0: { bg: "bg-rating-0/10" },
  20: { bg: "bg-rating-1/10" },
  40: { bg: "bg-rating-2/10" },
  60: { bg: "bg-rating-3/10" },
  80: { bg: "bg-rating-4/10" },
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

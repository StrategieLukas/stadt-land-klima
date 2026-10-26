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
    <button
      v-else
      type="button"
      :disabled="isGeneratingPdf"
      class="flex h-10 w-16 cursor-pointer items-center justify-center bg-gray text-white disabled:cursor-wait disabled:opacity-70"
      @click="fetchPDF"
    >
      <SlkFlowerSpinner v-if="isGeneratingPdf" :size="20" color="#fbfbfb" />
      <span v-else>PDF</span>
    </button>
  </div>
</template>
<script setup lang="ts">
import { clientFailure } from "~/shared/securityLog";

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

const isGeneratingPdf = ref(false);

async function fetchPDF() {
  if (isGeneratingPdf.value) return;
  if (!municipality.slug) return;

  isGeneratingPdf.value = true;
  try {
    const response = await $fetch<Blob>(`/api/pdf/municipality/${municipality.slug}`, {
      method: "POST",
      responseType: "blob",
      body: {
        slug: municipality.slug,
        catalogVersion: props.municipalityScore.catalog_version?.name,
      },
    });

    const blob = new Blob([response], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  } catch (err) {
    clientFailure("app.components.ItemRanking.fetchPDF.failed", err);
  } finally {
    isGeneratingPdf.value = false;
  }
}
</script>
<style lang=""></style>

<template lang="">
  <div
    class="relative mb-3 flex items-stretch gap-4 bg-opacity-10 py-5 pl-10 pr-4"
    :class="[isRanking ? 'shadow-list' : '', colorClass.bg]"
  >
    <div class="relative h-full pt-6">
      <img src="~/assets/icons/icon_location_green_marker.svg" class="my-auto h-auto w-8" />

      <div class="absolute top-0 w-full text-center font-heading text-3xl font-bold text-black break-keep whitespace-nowrap">
        {{ municipalityScore.rank > 0 ? municipalityScore.rank : "?" }}
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
      @click="fetchPDF"
      class="flex h-10 w-16 items-center justify-center bg-gray text-white disabled:cursor-wait disabled:opacity-70"
    >
      <SlkFlowerSpinner v-if="isGeneratingPdf" :size="20" color="#fbfbfb" />
      <span v-else>PDF</span>
    </button>
    
  </div>
</template>
<script setup>

const props = defineProps({
  municipalityScore: {
    type: Object,
    required: true,
  },
  isRanking: {
    type: Boolean,
    required: false,
    default: false,
  },
});
const municipality = props.municipalityScore.municipality;
const scoreTotalRounded = Math.round(Number(props.municipalityScore.score_total) * 10) / 10;

const colors = {
  0: { bg: "bg-rating-0" },
  20: { bg: "bg-rating-1" },
  40: { bg: "bg-rating-2" },
  60: { bg: "bg-rating-3" },
  80: { bg: "bg-rating-4" },
};

const colorClass = computed(() => {
  let c = colors[0];

  for (const score in colors) {
    if (Number(props.municipalityScore.score_total) < score) {
      return c;
    }

    c = colors[score];
  }

  return c;
});

const config = useRuntimeConfig(); // Nuxt 3 way to access runtime config
const isGeneratingPdf = ref(false);

async function fetchPDF() {
  if (isGeneratingPdf.value) return;
  console.log("municipality: ", municipality)
  if (!municipality.slug) return;

  isGeneratingPdf.value = true;
  try {
    const baseUrl = config.public.clientDirectusUrl;
    const token = config.public.directusToken;

    const response = await fetch(`${baseUrl}/pdf-service/municipality/${municipality.slug}/${props.municipalityScore.catalog_version.name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ slug: municipality.slug }),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');

  } catch (err) {
    console.error('Error fetching PDF:', err);
  } finally {
    isGeneratingPdf.value = false;
  }
}


</script>
<style lang=""></style>

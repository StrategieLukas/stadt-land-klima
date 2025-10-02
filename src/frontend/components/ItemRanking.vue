<template lang="">
  <div
    class="relative mb-3 flex items-stretch gap-4 bg-opacity-10 py-5 pl-10 pr-4"
    :class="[isRanking ? 'shadow-list' : '', colorClass.bg]"
  >
    <div class="relative h-full pt-6">
      <img src="~/assets/icons/icon_location_green_marker.svg" class="my-auto h-auto w-8" />

      <div class="absolute top-0 w-full text-center font-heading text-3xl font-bold text-black break-keep whitespace-nowrap">
        {{ municipality.place || "?" }}
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
      <img src="~/assets/icons/icon_chevron_right.svg" class="h-auto w-4" />
    </div>
    <button v-else @click="fetchPDF(municipality)" class="flex items-start h-3">PDF</button>
    
  </div>
</template>
<script setup>
const colors = {
  0: { bg: "bg-ranking-0-2" },
  20: { bg: "bg-ranking-2-4" },
  40: { bg: "bg-ranking-4-6" },
  60: { bg: "bg-ranking-6-8" },
  80: { bg: "bg-ranking-8-10" },
};

const colorClass = computed(() => {
  let c = colors[0];

  for (const score in colors) {
    if (Number(municipality.score_total) < score) {
      return c;
    }

    c = colors[score];
  }

  return c;
});

const config = useRuntimeConfig(); // Nuxt 3 way to access runtime config

async function fetchPDF(municipality) {
  console.log("municipality: ", municipality)
  if (!municipality.slug) return;

  try {
    const baseUrl = config.public.clientDirectusUrl;
    const token = config.public.directusToken;

    const response = await fetch(`${baseUrl}/pdf-service/municipality/${municipality.slug}`, {
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
  }
}

const props = defineProps({
  municipality: {
    type: Object,
    required: true,
  },
  isRanking: {
    type: Boolean,
    required: false,
    default: false,
  },
});
const municipality = props.municipality;
const scoreTotalRounded = Math.round(Number(municipality.score_total) * 10) / 10;
</script>
<style lang=""></style>

<template lang="">
    <div
      class="relative mb-3 flex items-stretch pl-10 pr-4 py-5 gap-4 bg-opacity-10"
      :class="[
        isRanking ? 'shadow-list': '',
        colorClass.bg,
      ]"
    >
      <div class="relative h-full pt-6">
        <img
          src="~/assets/icons/icon_location_green_marker.svg"
          class="w-8 h-auto my-auto"
        />

        <div class="absolute top-0 w-full text-center font-bold text-3xl text-black font-heading">
          {{ municipality.placement || '?' }}
        </div>
      </div>

      <div class="grow">
        <div class="flex flex-row items-start">
          <div class="mb-2">
            <h3 class="text-2xl font-heading text-black font-bold">{{ municipality.name }}</h3>
            <p>{{ municipality.state }}</p>
          </div>
        </div>
        <progress-bar :score-total="Number(municipality.score_total)"></progress-bar>
      </div>

      <div v-if="isRanking" class="flex items-start">
        <img src="~/assets/icons/icon_chevron_right.svg" class="w-4 h-auto" />
      </div>
    </div>
</template>
<script setup>
const colors = {
  0: {bg: 'bg-ranking-0-2' },
  20: {bg: 'bg-ranking-2-4' },
  40: {bg: 'bg-ranking-4-6' },
  60: {bg: 'bg-ranking-6-8' },
  80: {bg: 'bg-ranking-8-10' },
};

const colorClass = computed(() => {
  let c = colors[0];

  for(let score in colors) {
    if (Number(municipality.score_total) < score) {
      return c;
    }

    c = colors[score];
  }

  return c;
});

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
</script>
<style lang=""></style>

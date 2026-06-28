<template lang="">
  <div class="flex flex-col">
    <div
      :class="['relative w-full border', colorClass.border, layout === 'compact' ? 'h-4 rounded-sm' : 'h-8 rounded-md']"
    >
      <div
        :class="[
          'relative flex h-full items-center justify-end overflow-visible transition-all ease-out',
          colorClass.bg,
          durationClass,
        ]"
        :style="{ width: width + '%' }"
      >
        <div
          class="slk-progress-label relative mr-1 whitespace-nowrap font-heading font-bold"
          :class="[
            layout === 'compact' ? colorClass.text_compact + ' top-0.25 text-sm' : colorClass.text_default + ' text-xl',
          ]"
        >
          {{ scoreTotal.toFixed(1) }}
        </div>
      </div>
    </div>
    <div class="ml-auto text-sm">100</div>
  </div>
</template>
<script setup>
import { computed, ref, onMounted } from "vue";
const props = defineProps({
  scoreTotal: {
    type: Number,
    required: true,
  },
  layout: {
    type: String,
    validator(value) {
      return ["default", "compact"];
    },
    default: "default",
  },
});
const colors = {
  0: {
    bg: "bg-rating-0",
    border: "border-rating-0",
    text_default: "text-black left-9",
    text_compact: "text-black left-5",
  },
  5: {
    bg: "bg-rating-0",
    border: "border-rating-0",
    text_default: "text-black sm:text-white left-11 sm:left-0",
    text_compact: "text-black sm:text-white left-7 sm:left-0",
  },
  12: {
    bg: "bg-rating-0",
    border: "border-rating-0",
    text_default: "text-black sm:text-white left-14 sm:left-0",
    text_compact: "text-black sm:text-white left-9 sm:left-0",
  },
  20: {
    bg: "bg-rating-1",
    border: "border-rating-1",
    text_default: "slk-progress-label--on-bright",
    text_compact: "slk-progress-label--on-bright",
  },
  40: {
    bg: "bg-rating-2",
    border: "border-rating-2",
    text_default: "slk-progress-label--on-bright",
    text_compact: "slk-progress-label--on-bright",
  },
  60: {
    bg: "bg-rating-3",
    border: "border-rating-3",
    text_default: "slk-progress-label--on-bright",
    text_compact: "slk-progress-label--on-bright",
  },
  80: {
    bg: "bg-rating-4",
    border: "border-rating-4",
    text_default: "slk-progress-label--on-bright",
    text_compact: "slk-progress-label--on-bright",
  },
};
const durations = {
  0: "duration-[500ms]",
  20: "duration-[700ms]",
  40: "duration-[900ms]",
  60: "duration-[1100ms]",
  80: "duration-[1300ms]",
};

const width = ref(0);
const colorClass = getColorClass(props.scoreTotal);
const durationClass = computed(() => {
  return getDurationClass(props.scoreTotal);
});

function getDurationClass(scoreTotal) {
  let d = durations[0];

  for (const score in durations) {
    if (scoreTotal < score) {
      return d;
    }

    d = durations[score];
  }

  return d;
}

function getColorClass(scoreTotal) {
  let c = colors[0];

  for (const score in colors) {
    if (scoreTotal < score) {
      return c;
    }

    c = colors[score];
  }

  return c;
}

onMounted(() => {
  setTimeout(() => {
    width.value = props.scoreTotal;
  }, 100);
});
</script>
<style lang=""></style>

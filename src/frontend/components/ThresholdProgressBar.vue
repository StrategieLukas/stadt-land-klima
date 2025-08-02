<template>
  <div class="relative w-full max-w-3xl h-6 rounded bg-base-200 overflow-visible">
    <!-- Background progress bar -->
    <div
      class="absolute top-0 left-0 h-full transition-all duration-300"
      :class="currentRatingColor"
      :style="{ width: progressRatio + '%' }"
    ></div>

    <!-- Threshold markers -->
    <div
      v-for="(t, index) in thresholds"
      :key="index"
      class="absolute top-0 h-full w-[6px] -translate-x-1/2 border border-black"
      :class="t.color"
      :style="{ left: t.position + '%' }"
    ></div>

    <!-- Text label -->
    <div
      class="absolute right-0 top-1/2 -translate-y-1/2 pr-2 text-sm font-bold text-white"
      :style="{ right: (100 - progressRatio) + '%' }"
    >
      {{ progress.toFixed(1) }}
    </div>

    <!-- 100 marker -->
    <div class="absolute bottom-[-1.5rem] right-0 text-xs text-gray-400">100</div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  progress: Number,
  orangeThreshold: Number,
  lightGreenThreshold: Number,
  darkGreenThreshold: Number,
})

// Determine the "max" reference point
const maxValue = computed(() =>
  props.progress < props.darkGreenThreshold ? props.darkGreenThreshold : props.progress
)

const progressRatio = computed(() =>
  Math.min((props.progress / maxValue.value) * 100, 100)
)

const thresholds = computed(() => {
  const scale = (value) => (value / maxValue.value) * 100

  return [
    {
      color: 'bg-rating-1',
      position: scale(props.orangeThreshold),
    },
    {
      color: 'bg-rating-2',
      position: scale(props.lightGreenThreshold),
    },
    {
      color: 'bg-rating-3',
      position: scale(props.darkGreenThreshold),
    },
  ]
})

const currentRatingColor = computed(() => {
  if(props.progress > props.darkGreenThreshold) {
    return 'bg-rating-3'
  } else if(props.progress > props.lightGreenThreshold) {
    return 'bg-rating-2'
  } else if(props.progress > props.orangeThreshold) {
    return 'bg-rating-1'
  } else {
    return 'bg-rating-0'
  }
  
})
</script>

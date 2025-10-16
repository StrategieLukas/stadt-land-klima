<template>
  <div class="w-full max-w-3xl">
    <!-- Progress Bar Container -->
    <div
      class="relative w-full h-8 rounded-md bg-neutral-200 border border-base-300 overflow-visible shadow-sm group"
    >
      <!-- Filled Progress Bar -->
      <div
        ref="fillRef"
        class="absolute top-0 left-0 h-full rounded-md transition-all duration-500 ease-out group-hover:brightness-105"
        :class="currentRatingColor"
        :style="{ 
          width: fillWidth + '%',
          transitionDuration: '1000ms',
        }"
      ></div>

      <!-- Threshold Markers -->
      <div
        v-for="(t, index) in thresholds"
        :key="index"
        class="absolute flex flex-col items-center transition-all duration-300 ease-out"
        :style="{
          left: t.position === 0 ? '0%' : `calc(${t.position}% - 3px)`,
          top: '50%',
          transform: 'translate(-50%, -50%)',
        }"
      >
        <!-- Marker -->
        <div
          class="w-[10px] h-8 rounded-sm border border-black group-hover:shadow-md"
          :class="t.color"
        />
        <!-- Value Label -->
      <div
        v-if="!(t.hideLabelOnMobile || t.hideLabelOnDesktop)"
        class="absolute -top-6 px-1.5 py-0.5 text-xs font-semibold text-white rounded shadow-sm whitespace-nowrap"
        :class="[t.color, 'bg-opacity-90']"
      >
        {{ t.value }}
        <span class="hidden sm:inline">{{ unit }}</span>
      </div>

      <!-- Show only on mobile if desktop label should be hidden -->
      <div
        v-else-if="t.hideLabelOnDesktop && !t.hideLabelOnMobile"
        class="absolute -top-6 px-1.5 py-0.5 text-xs font-semibold text-white rounded shadow-sm whitespace-nowrap block sm:hidden"
        :class="[t.color, 'bg-opacity-90']"
      >
        {{ t.value }}
        <span class="hidden sm:inline">{{ unit }}</span>
      </div>

      <!-- Show only on desktop if mobile label should be hidden -->
      <div
        v-else-if="t.hideLabelOnMobile && !t.hideLabelOnDesktop"
        class="absolute -top-6 px-1.5 py-0.5 text-xs font-semibold text-white rounded shadow-sm whitespace-nowrap hidden sm:block"
        :class="[t.color, 'bg-opacity-90']"
      >
        {{ t.value }}
        <span class="hidden sm:inline">{{ unit }}</span>
      </div>

      </div>
    </div>

    <!-- Progress Label Underneath -->
    <div class="mt-1 text-sm font-bold text-base-content">
      {{ $t("generic.value_achieved") }} : {{ progress.toFixed(1) }} {{ unit }}
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue'

const props = defineProps({
  progress: Number,
  unit: String,
  redThreshold: Number,
  orangeThreshold: Number,
  yellowThreshold: Number,
  lightGreenThreshold: Number,
  darkGreenThreshold: Number,
})

// Determine max range for scaling
const maxValue = computed(() =>
  props.progress < props.darkGreenThreshold ? props.darkGreenThreshold : props.progress
)

const progressRatio = computed(() =>
  Math.min((props.progress / maxValue.value) * 100, 100)
)

// Start animation from 0 → target width
const fillWidth = ref(0)
onMounted(() => {
  requestAnimationFrame(() => {
    fillWidth.value = progressRatio.value
  })
})

const hideMobileLabels = computed(() => props.progress > 3 * props.darkGreenThreshold)
const hideDesktopLabels = computed(() => props.progress > 5 * props.darkGreenThreshold)

const thresholds = computed(() => {
  const scale = (value) => (value / maxValue.value) * 100

  return [
    {
      value: props.redThreshold,
      color: 'bg-rating-0',
      position: scale(props.redThreshold),
      hideLabelOnMobile: hideMobileLabels.value,
      hideLabelOnDesktop: hideDesktopLabels.value,
    },
    {
      value: props.orangeThreshold,
      color: 'bg-rating-1',
      position: scale(props.orangeThreshold),
      hideLabelOnMobile: hideMobileLabels.value,
      hideLabelOnDesktop: hideDesktopLabels.value,
    },
      {
      value: props.yellowThreshold,
      color: 'bg-rating-2',
      position: scale(props.yellowThreshold),
      hideLabelOnMobile: hideMobileLabels.value,
      hideLabelOnDesktop: hideDesktopLabels.value,
    },
    {
      value: props.lightGreenThreshold,
      color: 'bg-rating-3',
      position: scale(props.lightGreenThreshold),
      hideLabelOnMobile: hideMobileLabels.value,
      hideLabelOnDesktop: hideDesktopLabels.value,
    },
    {
      value: props.darkGreenThreshold,
      color: 'bg-rating-4',
      position: scale(props.darkGreenThreshold),
    },
  ]
})

const currentRatingColor = computed(() => {
  if (props.progress > props.darkGreenThreshold) {
    return 'bg-rating-4'
  } else if (props.progress > props.lightGreenThreshold) {
    return 'bg-rating-3'
  } else if (props.progress > props.yellowThreshold) {
    return 'bg-rating-2'
  } else if (props.progress > props.orangeThreshold) {
    return 'bg-rating-1'
  } else {
    return 'bg-rating-0'
  }
})



</script>

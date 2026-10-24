<template>
  <div class="flex flex-col">
    <div
      :class="['relative w-full border', colorClass.border, layout === 'compact' ? 'h-4 rounded-xs' : 'h-8 rounded-md']"
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
          class="slk-progress-label relative mr-1 font-heading font-bold whitespace-nowrap"
          :class="[
            layout === 'compact' ? colorClass.text_compact + ' top-0.25 text-sm' : colorClass.text_default + ' text-xl',
          ]"
        >
          {{ scoreTotal.toFixed(1) }}
        </div>
      </div>
    </div>
    <div v-if="showScaleMaximum" data-testid="progress-scale-maximum" class="ml-auto text-sm">100</div>
  </div>
</template>
<script setup lang="ts">
import { computed, ref, onMounted } from "vue";
const props = defineProps({
  scoreTotal: {
    type: Number,
    required: true,
  },
  layout: {
    type: String as PropType<string | undefined>,
    validator(value: string) {
      return ["default", "compact"].includes(value);
    },
    default: "default",
  },
  showScaleMaximum: {
    type: Boolean as PropType<boolean | undefined>,
    default: true,
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
  20: { bg: "bg-rating-1", border: "border-rating-1", text_default: "text-white", text_compact: "text-white" },
  40: { bg: "bg-rating-2", border: "border-rating-2", text_default: "text-black", text_compact: "text-black" },
  60: { bg: "bg-rating-3", border: "border-rating-3", text_default: "text-white", text_compact: "text-white" },
  80: { bg: "bg-rating-4", border: "border-rating-4", text_default: "text-white", text_compact: "text-white" },
};
const durations = {
  0: "duration-500",
  20: "duration-700",
  40: "duration-900",
  60: "duration-1100",
  80: "duration-1300",
};

const width = ref(0);
const colorClass = getColorClass(props.scoreTotal);
const durationClass = computed(() => {
  return getDurationClass(props.scoreTotal);
});

function getDurationClass(scoreTotal: number) {
  let d = durations[0];

  for (const [score, duration] of Object.entries(durations)) {
    if (scoreTotal < Number(score)) {
      return d;
    }

    d = duration;
  }

  return d;
}

function getColorClass(scoreTotal: number) {
  let c = colors[0];

  for (const [score, color] of Object.entries(colors)) {
    if (scoreTotal < Number(score)) {
      return c;
    }

    c = color;
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

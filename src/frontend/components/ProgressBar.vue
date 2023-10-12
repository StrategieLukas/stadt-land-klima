<template lang="">
  <div>
    <div
      :class="['relative w-full border', colorClass.border, layout === 'compact' ? 'h-4 rounded-sm' : 'h-8 rounded-md']"
    >
      <div
        :class="[
          'relative flex h-full items-center justify-end overflow-hidden transition-all ease-out',
          colorClass.bg,
          durationClass,
        ]"
        :style="{ width: width + '%' }"
      >
        <div
          class="mr-1 font-heading font-bold"
          :class="[colorClass.text, layout === 'compact' ? 'text-sm' : 'text-xl']"
        >
          {{ scoreTotal }}
        </div>
      </div>
    </div>
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
  0: { bg: "bg-ranking-0-2", border: "border-ranking-0-2", text: "text-white" },
  20: { bg: "bg-ranking-2-4", border: "border-ranking-2-4", text: "text-white" },
  40: { bg: "bg-ranking-4-6", border: "border-ranking-4-6", text: "text-black" },
  60: { bg: "bg-ranking-6-8", border: "border-ranking-6-8", text: "text-white" },
  80: { bg: "bg-ranking-8-10", border: "border-ranking-8-10", text: "text-white" },
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

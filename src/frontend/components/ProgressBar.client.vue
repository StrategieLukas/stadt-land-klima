<template lang="">
  <div>
    <div :class="['w-full h-8 relative border rounded-md', colorClass.border]">
      <div :class="['relative h-full flex items-center justify-end transition-all ease-out overflow-hidden', colorClass.bg, durationClass]" :style="{width: width + '%'}">
        <div class="text-white font-bold text-xl mr-2">{{ scoreTotal }}</div>
      </div>
    </div>
  </div>
</template>
<script setup>
import { computed, ref, onMounted } from 'vue';
const props = defineProps({
  scoreTotal: {
    type: Number,
    required: true,
  },
});

const colors = {
  0: {bg: 'bg-ranking-0-2', border: 'border-ranking-0-2'},
  20: {bg: 'bg-ranking-2-4', border: 'border-ranking-2-4' },
  40: {bg: 'bg-ranking-4-6', border: 'border-ranking-4-6' },
  60: {bg: 'bg-ranking-6-8', border: 'border-ranking-6-8' },
  80: {bg: 'bg-ranking-8-10', border: 'border-ranking-8-10' },
};
const durations = {
  0: 'duration-[500ms]',
  20: 'duration-[700ms]',
  40: 'duration-[900ms]',
  60: 'duration-[1100ms]',
  80: 'duration-[1300ms]',
};

const width = ref(0);
const colorClass = ref(colors[0]);
const durationClass = computed(() => {
  return getDurationClass(props.scoreTotal);
});

function getDurationClass(scoreTotal) {
  let d = durations[0];

  for(let score in durations) {
    if (scoreTotal < score) {
      return d;
    }

    d = durations[score];
  }

  return d;
}

function getColorClass(scoreTotal) {
  let c = colors[0];

  for(let score in colors) {
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
    colorClass.value = getColorClass(props.scoreTotal);
  }, 500);
})
</script>
<style lang=""></style>

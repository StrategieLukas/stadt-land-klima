<template>
  <nav
    class="no-scrollbar sticky z-30 -mx-4 flex items-center gap-2 overflow-x-auto border-b border-gray-100 bg-white/90 px-4 py-2 backdrop-blur-xs"
    :style="`top: ${top}px`"
  >
    <button
      v-for="(step, i) in steps"
      :key="step.index"
      class="flex flex-none items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors"
      :class="activeIndex === step.index ? 'bg-[#006e94] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'"
      @click="scrollToStep(step.index)"
    >
      <span
        class="flex h-4 w-4 flex-none items-center justify-center rounded-full text-[10px] font-bold"
        :class="activeIndex === step.index ? 'bg-white/20' : 'bg-gray-300/60'"
        >{{ i + 1 }}</span
      >
      {{ t(step.title) }}
    </button>
  </nav>
</template>

<script setup lang="ts">
import type { ResolvedStep } from "~/composables/useCollectionRender";
import { useSlzLocale } from "~/composables/useSlzLocale";

const _props = defineProps<{
  steps: ResolvedStep[];
  activeIndex: number;
  top?: number | undefined;
}>();

const emit = defineEmits<{ (e: "scroll-to", index: number): void }>();

const { t } = useSlzLocale();

function scrollToStep(index: number) {
  emit("scroll-to", index);
}
</script>

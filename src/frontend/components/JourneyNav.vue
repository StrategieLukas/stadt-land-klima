<template>
  <nav
    class="sticky z-30 bg-white/90 backdrop-blur-sm border-b border-gray-100 -mx-4 px-4 py-2 flex items-center gap-2 overflow-x-auto no-scrollbar"
    :style="`top: ${top}px`"
  >
    <button
      v-for="(step, i) in steps"
      :key="step.index"
      class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap flex-none"
      :class="activeIndex === step.index
        ? 'bg-[#006e94] text-white'
        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'"
      @click="scrollToStep(step.index)"
    >
      <span
        class="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold flex-none"
        :class="activeIndex === step.index ? 'bg-white/20' : 'bg-gray-300/60'"
      >{{ i + 1 }}</span>
      {{ t(step.title) }}
    </button>
  </nav>
</template>

<script setup lang="ts">
import type { ResolvedStep } from '~/composables/useCollectionRender'
import { useSlzLocale } from '~/composables/useSlzLocale'

const props = defineProps<{
  steps: ResolvedStep[]
  activeIndex: number
  top?: number
}>()

const emit = defineEmits<{ (e: 'scroll-to', index: number): void }>()

const { t } = useSlzLocale()

function scrollToStep(index: number) {
  emit('scroll-to', index)
}
</script>

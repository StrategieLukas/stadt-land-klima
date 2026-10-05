<template>
  <Teleport to="body">
    <div aria-hidden="true" class="pointer-events-none">
      <!-- 2px progress line at top of viewport -->
      <div class="fixed top-0 left-0 right-0 z-50 h-0.5 bg-gray-200">
        <div
          class="h-full bg-[#006e94] transition-all duration-300 ease-out"
          :style="{ width: pct + '%' }"
        />
      </div>
      <!-- Step counter chip -->
      <div
        class="fixed top-2 right-3 z-50 bg-[#006e94]/90 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full leading-tight"
        :aria-label="`Schritt ${current + 1} von ${total}`"
      >
        {{ current + 1 }}&thinsp;/&thinsp;{{ total }}
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  current: number
  total: number
}>()

const pct = computed(() =>
  props.total > 0 ? ((props.current + 1) / props.total) * 100 : 0
)
</script>

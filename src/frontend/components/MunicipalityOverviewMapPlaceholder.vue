<template>
  <div
    class="data-overview-map-size overflow-hidden rounded-lg border border-(--slk-border) bg-(--slk-surface-subdued)"
    role="status"
    :aria-label="$t(state === 'loading' ? 'generic.loading' : titleKey)"
    :aria-busy="state === 'loading' ? true : undefined"
  >
    <div
      v-if="state === 'loading'"
      class="h-full w-full animate-pulse bg-gray-200 motion-reduce:animate-none"
      aria-hidden="true"
    />
    <div v-else class="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <span aria-hidden="true"><Icon icon="mdi:map-clock-outline" class="h-12 w-12 text-(--slk-text-subtle)" /></span>
      <p class="font-semibold">{{ $t(titleKey) }}</p>
      <p class="max-w-sm text-sm text-(--slk-text-subtle)">
        {{ $t(state === "error" ? "data.dashboard.unavailable" : "data.dashboard.map_pending_description") }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue";

const props = withDefaults(defineProps<{ state?: "loading" | "pending" | "error" }>(), { state: "loading" });
const titleKey = computed(() =>
  props.state === "error" ? "data.dashboard.map_unavailable" : "data.dashboard.map_pending_title",
);
</script>

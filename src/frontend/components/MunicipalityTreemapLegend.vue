<template>
  <div
    class="text-gray-600 mt-4 flex flex-col gap-3 text-xs sm:flex-row sm:flex-wrap sm:items-center sm:justify-center"
  >
    <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
      <span class="text-gray-700 font-semibold">{{ $t("municipality.chart.treemap.legend.colors") }}:</span>
      <span v-for="entry in ratingEntries" :key="entry.key" class="inline-flex items-center gap-1.5">
        <span class="h-3 w-3 rounded-sm" :class="entry.colorClass" aria-hidden="true"></span>
        <span>{{ entry.label }}</span>
      </span>
    </div>
    <div class="text-gray-700 flex items-center gap-1.5 font-medium">
      <span class="border-gray-300 inline-block h-3 w-5 rounded-sm border bg-white" aria-hidden="true"></span>
      <span>{{ $t("municipality.chart.treemap.legend.size") }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const { $t } = useNuxtApp();

const ratingEntries = computed(() => [
  { key: "hardly_or_not", colorClass: "bg-rating-0", label: $t("rating.hardly_or_not") },
  { key: "initial_steps", colorClass: "bg-rating-1", label: $t("rating.initial_steps") },
  { key: "halfway", colorClass: "bg-rating-2", label: $t("rating.halfway") },
  { key: "mostly", colorClass: "bg-rating-3", label: $t("rating.mostly") },
  { key: "completed", colorClass: "bg-rating-4", label: $t("rating.completed") },
]);
</script>

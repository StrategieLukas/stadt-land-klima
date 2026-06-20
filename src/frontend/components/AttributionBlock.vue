<template>
  <div v-if="hasContent" class="bg-gray-50 border-gray-100 text-gray-500 mt-4 rounded-lg border px-4 py-3 text-xs">
    <div class="text-gray-400 mb-2 text-[10px] font-bold uppercase tracking-wide">Attribution / Quelle</div>
    <div class="flex flex-wrap gap-x-5 gap-y-1.5">
      <span v-if="attribution" class="inline-flex items-baseline gap-1">
        <span class="text-gray-600 font-semibold">Quelle:</span>
        <a
          v-if="attributionUrl"
          :href="attributionUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="hover:text-gray-700 underline"
          >{{ attribution }}</a
        >
        <span v-else>{{ attribution }}</span>
      </span>
      <span v-if="licenseName" class="inline-flex items-baseline gap-1">
        <span class="text-gray-600 font-semibold">Lizenz:</span>
        <a
          v-if="licenseUrl"
          :href="licenseUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="hover:text-gray-700 underline"
          >{{ licenseName }}</a
        >
        <span v-else>{{ licenseName }}</span>
      </span>
      <span v-if="effectiveDate" class="inline-flex items-baseline gap-1">
        <span class="text-gray-600 font-semibold">Stand:</span>
        <span>{{ formattedDate }}</span>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { SummaryAggregate } from "~/types/slz-api";

const props = defineProps<{
  summary?: SummaryAggregate | null;
}>();

const meta = computed(() => props.summary?.metadata ?? null);

const attribution = computed(() => meta.value?.attribution ?? null);
const attributionUrl = computed(() => meta.value?.attribution_url ?? null);
const licenseName = computed(() => meta.value?.license_name ?? null);
const licenseUrl = computed(() => meta.value?.license_url ?? null);
const effectiveDate = computed(() => meta.value?.effective_date ?? null);

const hasContent = computed(() => !!(attribution.value || licenseName.value || effectiveDate.value));

const formattedDate = computed(() => {
  if (!effectiveDate.value) return "";
  try {
    return new Date(effectiveDate.value).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return effectiveDate.value;
  }
});
</script>

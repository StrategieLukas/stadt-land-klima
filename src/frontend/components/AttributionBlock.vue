<template>
  <div
    v-if="hasContent"
    class="text-gray-500 text-xs"
    :class="embedded ? 'bg-transparent' : 'bg-gray-50 border-gray-100 mt-4 rounded-lg border px-4 py-3'"
  >
    <div class="text-gray-400 mb-2 text-[10px] font-bold uppercase tracking-wide">Attribution / Quelle</div>
    <ul class="space-y-1.5">
      <li v-for="(item, index) in attributionItems" :key="`${item.source}-${index}`" class="leading-relaxed">
        <span class="text-gray-600 font-semibold">Quelle:</span>
        <a
          v-if="item.sourceUrl"
          :href="item.sourceUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="hover:text-gray-700 underline"
          >{{ item.source }}</a
        >
        <span v-else>{{ item.source }}</span>
        <template v-if="item.attribution && item.attribution !== item.source">
          <span> · {{ item.attribution }}</span>
        </template>
        <template v-if="item.licenseName">
          <span> · </span>
          <a
            v-if="item.licenseUrl"
            :href="item.licenseUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="hover:text-gray-700 underline"
            >{{ item.licenseName }}</a
          >
          <span v-else>{{ item.licenseName }}</span>
        </template>
      </li>
      <li v-if="effectiveDate" class="inline-flex items-baseline gap-1">
        <span class="text-gray-600 font-semibold">Stand:</span>
        <span>{{ formattedDate }}</span>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { SourceAttribution, SummaryAggregate } from "~/types/slz-api";
import { localizedText } from "~/utils/dataProducts";

const props = defineProps<{
  summary?: SummaryAggregate | null;
  sources?: SourceAttribution[] | null;
  embedded?: boolean;
}>();

const meta = computed(() => props.summary?.metadata ?? null);

const effectiveDate = computed(() => meta.value?.effective_date ?? null);

const attributionItems = computed(() => {
  const sourceItems = (props.sources ?? [])
    .map((source) => ({
      source: localizedText(source.source) || source.attribution || "",
      sourceUrl: source.source_url ?? source.sourceUrl ?? null,
      attribution: source.attribution ?? "",
      licenseName: source.license_name ?? source.licenseName ?? "",
      licenseUrl: source.license_url ?? source.licenseUrl ?? null,
    }))
    .filter((source) => source.source || source.attribution || source.licenseName);

  if (sourceItems.length) return sourceItems;

  const aggregateSource = meta.value?.attribution || meta.value?.license_name;
  if (!aggregateSource) return [];
  return [
    {
      source: aggregateSource,
      sourceUrl: meta.value?.attribution_url ?? null,
      attribution: meta.value?.attribution ?? "",
      licenseName: meta.value?.license_name ?? "",
      licenseUrl: meta.value?.license_url ?? null,
    },
  ];
});

const hasContent = computed(() => attributionItems.value.length > 0 || !!effectiveDate.value);

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

<template>
  <div
    v-if="hasContent"
    class="data-attribution text-xs text-(--slk-text-muted)"
    :class="
      embedded ? 'bg-transparent' : 'mt-4 rounded-lg border border-(--slk-border) bg-(--slk-surface-subdued) px-4 py-3'
    "
  >
    <p v-if="attributionItems.length" class="mb-2 font-semibold text-(--slk-text)">
      {{ $t(attributionItems.length === 1 ? "stats.labels.data_source.singular" : "stats.labels.data_source.plural") }}
    </p>
    <ul class="space-y-1.5">
      <li v-for="(item, index) in attributionItems" :key="index" class="leading-relaxed break-words">
        <template v-if="item.source">
          <a v-if="item.sourceUrl" :href="item.sourceUrl" target="_blank" rel="noopener noreferrer" class="underline">
            {{ item.source }}
          </a>
          <span v-else>{{ item.source }}</span>
        </template>
        <span v-if="item.attribution"> · {{ item.attribution }}</span>
        <template v-if="item.licenseName">
          <span v-if="item.source || item.attribution"> · </span>
          <span class="font-semibold">{{ $t("stats.labels.data_license") }}: </span>
          <a v-if="item.licenseUrl" :href="item.licenseUrl" target="_blank" rel="noopener noreferrer" class="underline">
            {{ item.licenseName }}
          </a>
          <span v-else>{{ item.licenseName }}</span>
        </template>
      </li>
      <li v-if="formattedDate" class="flex flex-wrap items-baseline gap-1">
        <span class="font-semibold">{{ $t("data.dashboard.updated") }}:</span>
        <span>{{ formattedDate }}</span>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { Collection, CollectionSummary } from "~/types/slz-api";
import { resolveDataAttribution } from "~/utils/dataAttribution";

const props = defineProps<{
  summary?: CollectionSummary | null | undefined;
  collection?: Collection | null | undefined;
  fallbackAttribution?: string | null | undefined;
  embedded?: boolean | undefined;
}>();
const { $locale } = useNuxtApp();
const { t } = useSlzLocale();
const attributionItems = computed(() => resolveDataAttribution(props, t));
const formattedDate = computed(() => {
  const value = props.summary?.aggregate?.metadata?.effective_date;
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat($locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Berlin",
  }).format(date);
});
const hasContent = computed(() => attributionItems.value.length > 0 || !!formattedDate.value);
</script>

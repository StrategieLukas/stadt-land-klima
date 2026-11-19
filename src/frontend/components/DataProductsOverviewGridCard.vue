<template>
  <button
    type="button"
    class="group flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white text-left shadow-xs transition-all hover:border-stats-dark hover:shadow-list focus:outline-hidden focus-visible:ring-2 focus-visible:ring-stats-dark"
    :aria-pressed="compact ? expanded : undefined"
    :aria-expanded="showKpi || compact ? undefined : expanded"
    :aria-controls="compact ? 'data-explorer' : !showKpi && expanded ? 'data-collection-detail' : undefined"
    :class="[
      { 'ring-2 ring-stats-dark': expanded && !compact, 'data-product-picker-selected': expanded && compact },
      compact ? 'h-[104px]' : 'h-[250px] xl:h-[260px]',
    ]"
    @click="$emit('select')"
  >
    <div class="relative min-h-0 flex-1 overflow-hidden bg-gray-100">
      <img
        v-if="coverImageUrl"
        :src="coverImageUrl"
        :alt="title"
        class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        loading="lazy"
      />
      <div class="pointer-events-none absolute inset-0 bg-linear-to-t from-black/85 via-black/20 to-black/10" />
      <span
        v-if="coverImageUrl && coverImageAttribution"
        class="pointer-events-none absolute top-1.5 right-1.5 z-2 max-w-[45%] truncate rounded-sm bg-black/60 px-1.5 py-0.5 text-[9px] font-medium text-white/90 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
        :title="coverImageAttribution"
      >
        {{ coverImageAttribution }}
      </span>
      <div
        v-if="!coverImageUrl"
        class="relative z-0 flex h-full w-full items-center justify-center"
        :style="fallbackBackground"
      >
        <Icon
          :icon="iconifyStr ? String(iconifyStr) : 'mdi:chart-line'"
          class="h-10 w-10 text-white/75 drop-shadow-sm"
        />
      </div>

      <div class="absolute inset-x-0 top-0 z-1 flex items-start justify-between gap-2 p-3">
        <span
          class="inline-flex max-w-[70%] items-center rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide text-white uppercase shadow-xs"
          :style="{ backgroundColor: color }"
        >
          {{ sector }}
        </span>
      </div>

      <div class="absolute inset-x-0 bottom-0 z-1 px-3 pb-3">
        <h3 class="line-clamp-2 text-sm leading-tight font-black text-white drop-shadow-sm sm:text-base">
          {{ title }}
        </h3>
      </div>
    </div>

    <div
      v-if="showKpi"
      class="flex-none border-t border-gray-100 p-3 transition-colors"
      :style="{ backgroundColor: kpiTintBackground }"
    >
      <div>
        <div class="mb-1.5 flex items-center justify-between gap-2">
          <span class="truncate text-[10px] font-semibold tracking-wide text-gray-400 uppercase">
            {{ kpiLabel || "Kennwert" }}
          </span>
          <span class="text-[11px] font-bold tabular-nums" :style="{ color: kpiCategoryColor }" :title="kpiTooltip">
            {{ kpiDisplay }}
          </span>
        </div>
        <ThresholdBar
          v-if="kpi && kpiValue !== null && hasThresholds"
          :thresholds="kpi.thresholds!"
          :value="kpiValue"
          :unit="unitLabel"
          :is-percentage="kpi.is_percentage"
        />
        <div v-else class="h-7 rounded-full bg-gray-100" />
      </div>
    </div>
  </button>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { Collection } from "~/types/slz-api";
import { useCollectionResources } from "~/composables/useCollectionResources";
import {
  collectionCoverImage,
  collectionIconifyStr,
  firstKpiElement,
  formatKpiValue,
  kpiValueFromAggregate,
  localizedText,
  normalizeCollection,
  sectorColor,
  sectorKey,
  sectorLabel,
} from "~/utils/dataProducts";

const props = withDefaults(
  defineProps<{
    collection: Collection;
    ars: string;
    baseUrl: string;
    population?: number | null | undefined;
    showKpi?: boolean | undefined;
    expanded?: boolean | undefined;
    compact?: boolean | undefined;
  }>(),
  { showKpi: true, expanded: false, compact: false },
);

defineEmits<{
  (e: "select"): void;
}>();

const collectionDetails = ref<Collection | null>(null);
const aggregate = ref<Record<string, unknown> | null>(null);
const canonicalKpi = ref<{ value: number | null; precision?: number | null | undefined } | null>(null);
const resources = useCollectionResources(props.baseUrl);
const runtimeConfig = useRuntimeConfig();
const { $translateDynamic, $t: _$t, $locale } = useNuxtApp();
let generation = 0;

const effectiveCollection = computed(() => collectionDetails.value ?? normalizeCollection(props.collection));
const title = computed(() => {
  const titles = effectiveCollection.value.title;
  const language = $locale.startsWith("de") ? "de-DE" : $locale.startsWith("it") ? "it-IT" : "de-DE";
  return titles?.[language] || titles?.["de-DE"] || localizedText(titles) || effectiveCollection.value.id;
});
const sector = computed(() => {
  const key = sectorKey(effectiveCollection.value);
  const translationKey = `measure_sectors.${key}.title`;
  const translated = $translateDynamic(translationKey);
  return translated && translated !== translationKey ? translated : sectorLabel(effectiveCollection.value);
});
const color = computed(() => sectorColor(effectiveCollection.value));
const coverImage = computed(() =>
  collectionCoverImage(effectiveCollection.value, runtimeConfig.public.clientDirectusUrl),
);
const coverImageUrl = computed(() => coverImage.value.url);
const coverImageAttribution = computed(() => coverImage.value.attribution);
const iconifyStr = computed(() => collectionIconifyStr(effectiveCollection.value));
const kpi = computed(() => firstKpiElement(effectiveCollection.value));
const hasThresholds = computed(() => !!kpi.value?.thresholds && Object.keys(kpi.value.thresholds).length > 0);
const kpiLabel = computed(() => localizedText(kpi.value?.label) || localizedText(kpi.value?.title));
const unitLabel = computed(() => localizedText(kpi.value?.unit));
const kpiValue = computed(() => {
  if (canonicalKpi.value && typeof canonicalKpi.value.value === "number") return canonicalKpi.value.value;
  return kpiValueFromAggregate(kpi.value, aggregate.value, props.population);
});
const kpiDisplay = computed(() =>
  kpi.value ? formatKpiValue(kpi.value, kpiValue.value, canonicalKpi.value?.precision) : "Keine KPI",
);
const kpiCategoryColor = computed(() => {
  const v = kpiValue.value;
  const thresholds = kpi.value?.thresholds ?? {};
  if (v === null || !Object.keys(thresholds).length) return color.value;
  if (thresholds.darkgreen != null && v >= thresholds.darkgreen) return "#1EA64A";
  if (thresholds.lightgreen != null && v >= thresholds.lightgreen) return "#8DC63F";
  if (thresholds.yellow != null && v >= thresholds.yellow) return "#F7A600";
  if (thresholds.orange != null && v >= thresholds.orange) return "#F36633";
  return "#E30613";
});
const kpiTintBackground = computed(() => hexToRgba(kpiCategoryColor.value ?? color.value ?? "#006e94", 0.11));
const kpiTooltip = computed(() => {
  const parts = [kpiLabel.value, kpiDisplay.value, unitLabel.value].filter(Boolean);
  return parts.join(" · ");
});

const fallbackBackground = computed(
  () => `background: linear-gradient(135deg, ${color.value}18, ${color.value}38); color: ${color.value};`,
);

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return `rgba(0, 110, 148, ${alpha})`;
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

async function loadSummary() {
  const current = ++generation;
  const id = props.collection.id;
  const ars = props.ars;
  collectionDetails.value = null;
  aggregate.value = null;
  canonicalKpi.value = null;
  if (!props.showKpi || !ars || !id) return;
  const [metadata, summary] = await Promise.allSettled([
    kpi.value ? Promise.resolve(normalizeCollection(props.collection)) : resources.metadata(id),
    resources.summary(id, ars),
  ]);
  if (current !== generation || id !== props.collection.id || ars !== props.ars) return;
  if (metadata.status === "fulfilled") collectionDetails.value = normalizeCollection(metadata.value);
  if (summary.status !== "fulfilled") return;
  aggregate.value = summary.value.aggregate;
  const kpiValues = summary.value.kpi_values ?? summary.value.kpiValues ?? {};
  canonicalKpi.value = kpi.value ? (kpiValues[kpi.value.plot_id] ?? null) : null;
}

// Start every grid KPI after hydration; the shared page loader bounds concurrency.
onMounted(() => {
  void loadSummary();
  watch(
    () => [props.collection.id, props.ars, props.showKpi],
    () => void loadSummary(),
  );
});

onBeforeUnmount(() => ++generation);
</script>

<style scoped>
.data-product-picker-selected {
  border-color: var(--slk-blue);
  box-shadow:
    0 0 0 2px var(--slk-surface),
    0 0 0 6px var(--slk-blue);
}
.data-product-picker-selected:focus-visible {
  outline: 2px solid var(--slk-text);
  outline-offset: 8px;
}
</style>

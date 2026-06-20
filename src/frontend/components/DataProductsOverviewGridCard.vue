<template>
  <button
    ref="cardRef"
    type="button"
    class="border-gray-200 group flex min-h-[230px] flex-col overflow-hidden rounded-lg border bg-white text-left shadow-sm transition-all hover:border-[#006e94]/30 hover:shadow-list focus:outline-none focus-visible:ring-2 focus-visible:ring-[#006e94]"
    @click="$emit('select')"
  >
    <div class="bg-gray-100 relative h-24 overflow-hidden">
      <img
        v-if="coverImageUrl"
        :src="coverImageUrl"
        :alt="title"
        class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        loading="lazy"
      />
      <div v-else class="flex h-full w-full items-center justify-center" :style="fallbackBackground">
        <Icon
          :icon="iconifyStr ? String(iconifyStr) : 'mdi:chart-line'"
          class="h-10 w-10 opacity-50"
          :style="{ color: color }"
        />
      </div>
      <span
        class="absolute left-2 top-2 max-w-[calc(100%-1rem)] truncate rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm"
        :style="{ backgroundColor: color }"
      >
        {{ sector }}
      </span>
    </div>

    <div class="flex flex-1 flex-col p-3">
      <h3 class="text-gray-900 line-clamp-2 min-h-[2.5rem] text-sm font-bold leading-snug">
        {{ title }}
      </h3>

      <div class="mt-auto pt-3">
        <div class="mb-1.5 flex items-center justify-between gap-2">
          <span class="text-gray-400 truncate text-[10px] font-semibold uppercase tracking-wide">
            {{ kpiLabel || "Kennwert" }}
          </span>
          <span class="text-gray-900 text-[11px] font-bold tabular-nums" :title="kpiTooltip">
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
        <div v-else class="bg-gray-100 h-3 rounded-full" />
      </div>
    </div>
  </button>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import type { Collection, CollectionSummary } from "~/types/slz-api";
import {
  collectionCoverImageUrl,
  collectionIconifyStr,
  firstKpiElement,
  formatKpiValue,
  kpiValueFromAggregate,
  localizedText,
  normalizeCollection,
  sectorColor,
  sectorLabel,
} from "~/utils/dataProducts";

const props = defineProps<{
  collection: Collection;
  ars: string;
  baseUrl: string;
  population?: number | null;
}>();

defineEmits<{
  (e: "select"): void;
}>();

const cardRef = ref<HTMLElement | null>(null);
const collectionDetails = ref<Collection | null>(null);
const aggregate = ref<Record<string, unknown> | null>(null);
const hasRequestedSummary = ref(false);
const hasRequestedDetails = ref(false);
let observer: IntersectionObserver | null = null;

const effectiveCollection = computed(() => collectionDetails.value ?? normalizeCollection(props.collection));
const title = computed(() => localizedText(effectiveCollection.value.title) || effectiveCollection.value.id);
const sector = computed(() => sectorLabel(effectiveCollection.value));
const color = computed(() => sectorColor(effectiveCollection.value));
const coverImageUrl = computed(() => collectionCoverImageUrl(effectiveCollection.value));
const iconifyStr = computed(() => collectionIconifyStr(effectiveCollection.value));
const kpi = computed(() => firstKpiElement(effectiveCollection.value));
const hasThresholds = computed(() => !!kpi.value?.thresholds && Object.keys(kpi.value.thresholds).length > 0);
const kpiLabel = computed(() => localizedText(kpi.value?.label) || localizedText(kpi.value?.title));
const unitLabel = computed(() => localizedText(kpi.value?.unit));
const kpiValue = computed(() => kpiValueFromAggregate(kpi.value, aggregate.value, props.population));
const kpiDisplay = computed(() => (kpi.value ? formatKpiValue(kpi.value, kpiValue.value) : "Keine KPI"));
const kpiTooltip = computed(() => {
  const parts = [kpiLabel.value, kpiDisplay.value, unitLabel.value].filter(Boolean);
  return parts.join(" · ");
});

const fallbackBackground = computed(
  () => `background: linear-gradient(135deg, ${color.value}18, ${color.value}38); color: ${color.value};`,
);

async function loadSummary() {
  if (hasRequestedSummary.value || !props.ars || !props.collection.id) return;
  hasRequestedSummary.value = true;
  try {
    if (!kpi.value) {
      await loadCollectionDetails();
    }
    if (!kpi.value) return;
    const data = await $fetch<CollectionSummary>(`${props.baseUrl}/api/collections/${props.collection.id}/summary/`, {
      params: { area: props.ars },
      timeout: 10000,
    });
    aggregate.value = (data?.aggregate as Record<string, unknown>) ?? null;
  } catch (_) {
    aggregate.value = null;
  }
}

async function loadCollectionDetails() {
  if (hasRequestedDetails.value || collectionDetails.value) return;
  hasRequestedDetails.value = true;
  try {
    const data = await $fetch<Collection>(`${props.baseUrl}/api/collections/${props.collection.id}/`, {
      timeout: 8000,
    });
    collectionDetails.value = normalizeCollection(data);
  } catch (_) {
    collectionDetails.value = null;
  }
}

onMounted(() => {
  if (!cardRef.value || typeof IntersectionObserver === "undefined") {
    loadSummary();
    return;
  }
  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        loadSummary();
        observer?.disconnect();
        observer = null;
      }
    },
    { rootMargin: "360px 0px" },
  );
  observer.observe(cardRef.value);
});

onBeforeUnmount(() => observer?.disconnect());
</script>

<template>
  <button
    ref="cardRef"
    type="button"
    class="border-gray-200 group flex h-[250px] flex-col overflow-hidden rounded-lg border bg-white text-left shadow-sm transition-all hover:border-[#006e94]/30 hover:shadow-list focus:outline-none focus-visible:ring-2 focus-visible:ring-[#006e94] xl:h-[260px]"
    @click="$emit('select')"
  >
    <div class="bg-gray-100 relative min-h-0 flex-1 overflow-hidden">
      <img
        v-if="coverImageUrl"
        :src="coverImageUrl"
        :alt="title"
        class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        loading="lazy"
      />
      <div
        class="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/10"
      />
      <span
        v-if="coverImageUrl && coverImageAttribution"
        class="pointer-events-none absolute right-1.5 top-1.5 z-[2] max-w-[45%] truncate rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-medium text-white/90 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100"
        :title="coverImageAttribution"
      >
        {{ coverImageAttribution }}
      </span>
      <div v-if="!coverImageUrl" class="relative z-0 flex h-full w-full items-center justify-center" :style="fallbackBackground">
        <Icon
          :icon="iconifyStr ? String(iconifyStr) : 'mdi:chart-line'"
          class="h-10 w-10 text-white/75 drop-shadow"
        />
      </div>

      <div class="absolute inset-x-0 top-0 z-[1] flex items-start justify-between gap-2 p-3">
        <span
          class="inline-flex max-w-[70%] items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm"
          :style="{ backgroundColor: color }"
        >
          {{ sector }}
        </span>
      </div>

      <div class="absolute inset-x-0 bottom-0 z-[1] px-3 pb-3">
        <h3 class="line-clamp-2 text-sm font-black leading-tight text-white drop-shadow sm:text-base">
          {{ title }}
        </h3>
      </div>
    </div>

    <div
      class="border-gray-100 flex-none border-t p-3 transition-colors"
      :style="{ backgroundColor: kpiTintBackground }"
    >
      <div>
        <div class="mb-1.5 flex items-center justify-between gap-2">
          <span class="text-gray-400 truncate text-[10px] font-semibold uppercase tracking-wide">
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
        <div v-else class="bg-gray-100 h-7 rounded-full" />
      </div>
    </div>
  </button>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import type { Collection, CollectionSummary } from "~/types/slz-api";
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
const canonicalKpi = ref<{ value: number | null; precision?: number | null } | null>(null);
const hasRequestedSummary = ref(false);
const hasRequestedDetails = ref(false);
const runtimeConfig = useRuntimeConfig();
const { $t } = useNuxtApp();
let observer: IntersectionObserver | null = null;

const effectiveCollection = computed(() => collectionDetails.value ?? normalizeCollection(props.collection));
const title = computed(() => localizedText(effectiveCollection.value.title) || effectiveCollection.value.id);
const sector = computed(() => {
  const key = sectorKey(effectiveCollection.value);
  const translationKey = `measure_sectors.${key}.title`;
  const translated = $t(translationKey);
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
const kpiTintBackground = computed(() => hexToRgba(kpiCategoryColor.value, 0.11));
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
    const kpiValues = data?.kpi_values ?? data?.kpiValues ?? {};
    canonicalKpi.value =
      (kpiValues?.[kpi.value.plot_id] as { value: number | null; precision?: number | null } | undefined) ?? null;
  } catch (_) {
    aggregate.value = null;
    canonicalKpi.value = null;
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

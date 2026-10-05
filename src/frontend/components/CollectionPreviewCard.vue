<template>
  <div
    :data-collection-id="collection.id"
    class="border-gray-100 overflow-hidden rounded-2xl border bg-white shadow-sm"
  >
    <!-- Card header: sector color strip + title -->
    <div class="flex items-start justify-between gap-3 px-5 pb-3 pt-4" :style="`border-left: 4px solid ${sectorColor}`">
      <div class="min-w-0">
        <span
          class="mb-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white"
          :style="`background: ${sectorColor}`"
          >{{ sectorDisplay }}</span
        >
        <h3 class="text-gray-900 text-base font-bold leading-snug">{{ t(collection.title) }}</h3>
        <p v-if="collectionDescription" class="text-gray-500 mt-1 line-clamp-2 text-xs leading-relaxed">
          {{ collectionDescription }}
        </p>
      </div>
    </div>

    <!-- Step-0 preview: KPI + map -->
    <div class="px-5 pb-4">
      <div v-if="kpiEl0 || mapEl0" class="grid gap-4" :class="kpiEl0 && mapEl0 ? 'grid-cols-5' : 'grid-cols-1'">
        <!-- KPI column -->
        <div v-if="kpiEl0" :class="mapEl0 ? 'col-span-2' : 'col-span-1'">
          <KPICard
            :element="kpiEl0"
            :collection-slug="collection.id"
            :ars="ars"
            :base-url="baseUrl"
            :population="population"
          />
        </div>
        <!-- Map column -->
        <div v-if="mapEl0" :class="kpiEl0 ? 'col-span-3' : 'col-span-1'" style="height: 280px">
          <ClientOnly>
            <MapLibreRenderElement
              v-if="mapLibreSpec(mapEl0)"
              :element="mapEl0"
              :ars="ars"
              :export-ars="ars"
              :export-title="t(mapEl0.title) || collectionTitle"
              :export-subtitle="t(mapEl0.description) || collectionDescription"
              :export-collection-name="collectionTitle"
            />
            <VegaChart
              v-else-if="mapEl0.vegalite_spec"
              :spec="mapEl0.vegalite_spec"
              :export-ars="ars"
              :export-title="t(mapEl0.title) || collectionTitle"
              :export-subtitle="t(mapEl0.description) || collectionDescription"
              :export-collection-name="collectionTitle"
            />
          </ClientOnly>
        </div>
      </div>
      <div v-else-if="step0Description" class="text-gray-600 py-2 text-sm leading-relaxed">
        {{ step0Description }}
      </div>
    </div>

    <!-- Expand / collapse toggle -->
    <div class="flex items-center justify-between px-5 pb-4">
      <button
        v-if="!expanded"
        class="inline-flex items-center gap-1.5 text-sm font-medium text-[#006e94] transition-colors hover:underline"
        :disabled="expandLoading"
        @click="expand"
      >
        <template v-if="expandLoading">
          <SlkFlowerSpinner :size="14" />
          Wird geladen…
        </template>
        <template v-else>
          Alle {{ stepCount }} Schritte anzeigen
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </template>
      </button>
      <NuxtLink
        :to="`/data/${areaSlug}/${collection.id}`"
        class="text-gray-400 ml-auto text-xs transition-colors hover:text-[#006e94]"
      >
        Eigene Seite →
      </NuxtLink>
    </div>

    <!-- Expanded steps (all narrative steps) -->
    <div v-if="expanded" class="border-gray-100 border-t">
      <div class="px-5">
        <JourneyStep
          v-for="step in renderSteps"
          :key="step.index"
          :step="step"
          :collection="collection"
          :ars="ars"
          :base-url="baseUrl"
          :population="population"
        />
      </div>
      <div class="px-5 pb-5 pt-2">
        <button
          class="inline-flex items-center gap-1.5 text-sm font-medium text-[#006e94] hover:underline"
          @click="expanded = false"
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
          </svg>
          Weniger anzeigen
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import type { Collection } from "~/types/slz-api";
import { useSlzLocale } from "~/composables/useSlzLocale";
import { useCollectionRender } from "~/composables/useCollectionRender";
import sectorImages from "~/shared/sectorImages.js";
import { hasMapVisual, mapLibreSpec } from "~/utils/dataProducts";

const SECTOR_COLORS: Record<string, string> = {
  energy: "#F59E0B",
  transport: "#3B82F6",
  agriculture: "#10B981",
  management: "#006e94",
  other: "#6B7280",
};

const props = defineProps<{
  collection: Collection;
  areaSlug: string;
  ars: string;
  baseUrl: string;
  population?: number | null;
}>();

const { t } = useSlzLocale();
const { steps: renderSteps, loading: expandLoading, loadFromRender } = useCollectionRender(props.baseUrl);

const expanded = ref(false);
const stepsLoaded = ref(false);

const sectorKey = computed(() => {
  const s = props.collection.sector;
  if (!s) return "other";
  return s.toLowerCase();
});

const sectorColor = computed(() => SECTOR_COLORS[sectorKey.value] ?? SECTOR_COLORS.other);

const sectorDisplay = computed(() => {
  const sl = props.collection.sector_label;
  if (!sl) return props.collection.sector ?? "";
  if (typeof sl === "string") return sl;
  return t(sl as Record<string, string>);
});

const collectionDescription = computed(
  () => props.collection.description?.["de-DE"] || props.collection.description?.["en-US"] || "",
);
const collectionTitle = computed(() => t(props.collection.title) || props.collection.id);

const step0Elements = computed(() => (props.collection.render_elements ?? []).filter((e) => (e.step ?? 0) === 0));

const kpiEl0 = computed(() => step0Elements.value.find((e) => e.type === "kpi") ?? null);

const mapEl0 = computed(() => step0Elements.value.find((e) => e.type === "map" && hasMapVisual(e)) ?? null);

const step0Description = computed(() => {
  const step0 = props.collection.narrative_steps?.[0];
  return step0 ? t(step0.description) : "";
});

const stepCount = computed(
  () => props.collection.narrative_steps?.length ?? (props.collection.hasNarrativeSteps ? 1 : 0),
);

async function expand() {
  if (!stepsLoaded.value) {
    await loadFromRender(props.collection.id, props.ars);
    stepsLoaded.value = true;
  }
  expanded.value = true;
}
</script>

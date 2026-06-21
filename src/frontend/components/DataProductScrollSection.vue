<template>
  <section
    ref="sectionRef"
    :id="collection.id"
    :data-collection-id="collection.id"
    :data-sector-key="sectorKeyValue"
    class="border-gray-100 overflow-visible border-t pb-6 pt-10"
    :style="`scroll-margin-top: ${scrollMarginTop}px`"
  >
    <div class="border-gray-200 overflow-hidden rounded-lg border bg-white shadow-sm">
      <div
        class="grid min-h-[900px] overflow-hidden sm:min-h-[820px] xl:min-h-[540px] xl:grid-cols-12 xl:items-stretch"
      >
        <div class="border-gray-200 flex min-h-0 flex-col overflow-hidden xl:col-span-5 xl:border-r">
          <div
            class="group/cover relative flex min-h-[340px] flex-1 flex-col justify-end overflow-hidden bg-white xl:min-h-0"
          >
            <img
              v-if="coverImageUrl"
              :src="coverImageUrl"
              :alt="title"
              class="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
            />
            <span
              v-if="coverImageUrl && coverImageAttribution"
              class="pointer-events-none absolute right-2 top-2 z-[1] max-w-[calc(100%-1rem)] truncate rounded bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white/90 opacity-0 transition-opacity focus-within:opacity-100 group-hover/cover:opacity-100"
              :title="coverImageAttribution"
            >
              {{ coverImageAttribution }}
            </span>
            <div
              v-if="!coverImageUrl"
              class="absolute inset-0 flex items-center justify-center"
              :style="fallbackBackground"
            >
              <Icon
                :icon="iconifyStr ? String(iconifyStr) : 'mdi:chart-areaspline'"
                class="h-20 w-20 opacity-35"
                :style="{ color }"
              />
            </div>
            <div class="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
            <div class="relative p-5 lg:p-6">
              <span
                class="mb-3 inline-flex max-w-full items-center rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white shadow-sm"
                :style="{ backgroundColor: color }"
              >
                {{ sector }}
              </span>
              <h2 class="text-3xl font-black leading-none text-white sm:text-4xl lg:text-5xl">
                {{ title }}
              </h2>
            </div>
          </div>

          <div class="border-gray-200 flex-none border-t">
            <KPICard
              v-if="kpi"
              :element="kpi"
              :collection-slug="collection.id"
              :ars="ars"
              :base-url="baseUrl"
              :population="population"
              flush
            />
            <p v-else-if="description" class="text-gray-600 text-sm leading-relaxed">
              {{ description }}
            </p>
          </div>
        </div>

        <div class="min-h-[380px] sm:min-h-[480px] xl:col-span-7 xl:min-h-0">
          <div class="flex h-full flex-col overflow-hidden bg-white">
            <div v-if="primaryVisual" class="border-gray-100 flex-none border-b px-4 py-2.5">
              <p class="text-gray-900 text-sm font-bold leading-snug">{{ primaryVisualTitle }}</p>
              <p v-if="primaryVisualSubtitle" class="text-gray-500 mt-1 line-clamp-2 text-xs leading-relaxed">
                {{ primaryVisualSubtitle }}
              </p>
            </div>
            <div
              v-if="renderLoading && !hasLoaded"
              class="text-gray-500 flex min-h-0 flex-1 items-center justify-center gap-2 text-sm"
            >
              <SlkFlowerSpinner :size="24" />
              Datenprodukt wird geladen…
            </div>
            <div v-else-if="primaryMapLibreSpec && primaryVisual" class="min-h-0 flex-1">
              <ClientOnly>
                <MapLibreRenderElement
                  :element="primaryVisual"
                  :ars="ars"
                  :export-area-name="areaName"
                  :export-ars="ars"
                  :export-title="primaryVisualTitle"
                  :export-subtitle="primaryVisualSubtitle"
                  :export-collection-name="title"
                  :export-updated-at="exportUpdatedAt"
                  :export-attribution="exportAttribution"
                />
              </ClientOnly>
            </div>
            <div v-else-if="primaryVisualSpec" class="min-h-0 flex-1">
              <ClientOnly>
                <VegaChart
                  :spec="primaryVisualSpec"
                  :export-area-name="areaName"
                  :export-ars="ars"
                  :export-title="primaryVisualTitle"
                  :export-subtitle="primaryVisualSubtitle"
                  :export-collection-name="title"
                  :export-updated-at="exportUpdatedAt"
                  :export-attribution="exportAttribution"
                />
              </ClientOnly>
            </div>
            <DataImage
              v-else-if="primaryVisual?.type === 'image'"
              class="min-h-0 flex-1"
              :element="primaryVisual"
              :collection-slug="collection.id"
              :base-url="baseUrl"
            />
            <div v-else class="text-gray-400 bg-gray-50 flex min-h-0 flex-1 items-center justify-center text-sm">
              Keine Kartenvisualisierung verfügbar.
            </div>
          </div>
        </div>
      </div>

      <div class="border-gray-200 border-t p-4">
        <DataProductJourneyCarousel
          v-if="hasLoaded && journeySteps.length"
          :steps="journeySteps"
          :collection="collection"
          :ars="ars"
          :base-url="baseUrl"
          :population="population"
          :area-name="areaName"
          :export-updated-at="exportUpdatedAt"
          :export-attribution="exportAttribution"
        />

        <div v-else-if="renderError" class="text-gray-400 text-sm">
          Weitere Visualisierungen konnten nicht geladen werden.
        </div>

        <div v-else>
          <div class="mb-3 flex items-center justify-between gap-3">
            <div class="bg-gray-100 h-4 w-24 animate-pulse rounded" />
            <div class="flex items-center gap-2">
              <div class="bg-gray-100 h-6 w-20 animate-pulse rounded" />
              <div class="bg-gray-100 h-6 w-6 animate-pulse rounded" />
              <div class="bg-gray-100 h-6 w-6 animate-pulse rounded" />
            </div>
          </div>
          <div class="grid gap-4 lg:grid-cols-2">
            <div class="border-gray-100 overflow-hidden rounded-lg border bg-white">
              <div class="border-gray-100 border-b p-4">
                <div class="bg-gray-100 h-4 w-2/3 animate-pulse rounded" />
                <div class="bg-gray-100 mt-2 h-3 w-4/5 animate-pulse rounded" />
              </div>
              <div class="bg-gray-50 m-3 h-[220px] animate-pulse rounded" />
            </div>
            <div class="border-gray-100 hidden overflow-hidden rounded-lg border bg-white lg:block">
              <div class="border-gray-100 border-b p-4">
                <div class="bg-gray-100 h-4 w-1/2 animate-pulse rounded" />
                <div class="bg-gray-100 mt-2 h-3 w-3/4 animate-pulse rounded" />
              </div>
              <div class="bg-gray-50 m-3 h-[220px] animate-pulse rounded" />
            </div>
          </div>
        </div>
      </div>

      <div class="border-gray-200 border-t p-4">
        <AttributionBlock
          :summary="collectionSummary?.aggregate ?? null"
          :sources="collectionSummary?.source_attributions ?? collectionSummary?.sourceAttributions ?? []"
          embedded
        />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useCollectionRender } from "~/composables/useCollectionRender";
import type { Collection, CollectionSummary, RenderElement } from "~/types/slz-api";
import {
  bestVisualElement,
  collectionCoverImage,
  collectionIconifyStr,
  firstKpiElement,
  injectAreaIntoSpec,
  localizedText,
  mapLibreSpec,
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
  scrollMarginTop: number;
  areaName?: string;
}>();

const sectionRef = ref<HTMLElement | null>(null);
const hasLoaded = ref(false);
const collectionDetails = ref<Collection | null>(null);
const collectionSummary = ref<CollectionSummary | null>(null);
const runtimeConfig = useRuntimeConfig();
let observer: IntersectionObserver | null = null;

const {
  steps: renderSteps,
  loading: renderLoading,
  error: renderError,
  load,
  loadFromRender,
} = useCollectionRender(props.baseUrl);

const effectiveCollection = computed(() => collectionDetails.value ?? normalizeCollection(props.collection));
const title = computed(() => localizedText(effectiveCollection.value.title) || effectiveCollection.value.id);
const coverImage = computed(() =>
  collectionCoverImage(effectiveCollection.value, runtimeConfig.public.clientDirectusUrl),
);
const coverImageUrl = computed(() => coverImage.value.url);
const coverImageAttribution = computed(() => coverImage.value.attribution);
const iconifyStr = computed(() => collectionIconifyStr(effectiveCollection.value));
const description = computed(() => {
  const firstStepDescription = localizedText(effectiveCollection.value.narrative_steps?.[0]?.description);
  return firstStepDescription || localizedText(effectiveCollection.value.description);
});
const sector = computed(() => sectorLabel(effectiveCollection.value));
const sectorKeyValue = computed(() => sectorKey(effectiveCollection.value));
const color = computed(() => sectorColor(effectiveCollection.value));
const kpi = computed(() => firstKpiElement(effectiveCollection.value));
const summaryMetadata = computed(() => collectionSummary.value?.aggregate?.metadata ?? null);
const exportUpdatedAt = computed(() => summaryMetadata.value?.effective_date ?? "");
const exportAttribution = computed(() => {
  const meta = summaryMetadata.value;
  const aggregateAttribution = [meta?.attribution, meta?.license_name].filter(Boolean).join(" | ");
  if (aggregateAttribution) return aggregateAttribution;
  const sources = collectionSummary.value?.source_attributions ?? collectionSummary.value?.sourceAttributions ?? [];
  return sources
    .map((source) =>
      [localizedText(source.source), source.attribution, source.license_name ?? source.licenseName]
        .filter(Boolean)
        .join(" | "),
    )
    .filter(Boolean)
    .join("; ");
});

const loadedElements = computed(() => renderSteps.value.flatMap((step) => step.elements));

const primaryVisual = computed<RenderElement | null>(
  () => bestVisualElement(loadedElements.value) ?? bestVisualElement(effectiveCollection.value.render_elements ?? []),
);

const primaryVisualSpec = computed(() =>
  !primaryMapLibreSpec.value && primaryVisual.value?.vegalite_spec
    ? injectAreaIntoSpec(primaryVisual.value.vegalite_spec as object, props.ars)
    : null,
);
const primaryMapLibreSpec = computed(() => mapLibreSpec(primaryVisual.value));
const primaryVisualTitle = computed(() => localizedText(primaryVisual.value?.title) || title.value);
const primaryVisualSubtitle = computed(() => localizedText(primaryVisual.value?.description) || description.value);

const primaryMapPlotId = computed(() => (primaryVisual.value?.type === "map" ? primaryVisual.value.plot_id : null));
const primaryKpiPlotId = computed(() => kpi.value?.plot_id ?? null);

const journeySteps = computed(() => {
  const heroPlotIds = new Set([primaryMapPlotId.value, primaryKpiPlotId.value].filter(Boolean));
  if (!heroPlotIds.size) return renderSteps.value;

  return renderSteps.value
    .map((step) => ({
      ...step,
      elements: step.elements.filter((element) => !heroPlotIds.has(element.plot_id)),
    }))
    .filter((step) => step.elements.length > 0);
});

const fallbackBackground = computed(() => `background: linear-gradient(135deg, ${color.value}18, ${color.value}36);`);

async function loadSectionData() {
  if (hasLoaded.value || !props.collection.id) return;
  try {
    if (props.ars) await loadFromRender(props.collection.id, props.ars);
    if (!renderSteps.value.length) await load(props.collection.id, props.collection);
    try {
      collectionDetails.value = await $fetch<Collection>(`${props.baseUrl}/api/collections/${props.collection.id}/`, {
        timeout: 8000,
      }).then((data) => normalizeCollection(data));
    } catch (_) {
      collectionDetails.value = null;
    }
  } finally {
    hasLoaded.value = true;
  }

  if (!props.ars) return;
  try {
    collectionSummary.value = await $fetch<CollectionSummary>(
      `${props.baseUrl}/api/collections/${props.collection.id}/summary/`,
      { params: { area: props.ars } },
    );
  } catch (_) {
    collectionSummary.value = null;
  }
}

onMounted(() => {
  if (!sectionRef.value || typeof IntersectionObserver === "undefined") {
    loadSectionData();
    return;
  }
  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        loadSectionData();
        observer?.disconnect();
        observer = null;
      }
    },
    { rootMargin: "760px 0px" },
  );
  observer.observe(sectionRef.value);
});

onBeforeUnmount(() => observer?.disconnect());
</script>

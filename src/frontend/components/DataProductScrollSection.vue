<template>
  <section
    ref="sectionRef"
    :id="collection.id"
    :data-collection-id="collection.id"
    :data-sector-key="sectorKeyValue"
    class="border-gray-100 overflow-visible border-t pb-6 pt-10"
    :style="`scroll-margin-top: ${scrollMarginTop}px`"
  >
    <div class="grid h-[820px] gap-5 overflow-hidden sm:h-[760px] xl:h-[430px] xl:grid-cols-12 xl:items-stretch">
      <div class="flex min-h-0 flex-col gap-4 overflow-hidden xl:col-span-5">
        <div
          class="group/cover border-gray-200 relative flex h-[280px] flex-none flex-col justify-end overflow-hidden rounded-lg border bg-white shadow-sm xl:h-[280px]"
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
          <div class="relative p-5">
            <span
              class="mb-3 inline-flex max-w-full items-center rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white shadow-sm"
              :style="{ backgroundColor: color }"
            >
              {{ sector }}
            </span>
            <h2 class="text-3xl font-black leading-none text-white sm:text-4xl">
              {{ title }}
            </h2>
          </div>
        </div>

        <KPICard
          v-if="kpi"
          :element="kpi"
          :collection-slug="collection.id"
          :ars="ars"
          :base-url="baseUrl"
          :population="population"
        />

        <p v-if="description" class="text-gray-600 line-clamp-4 text-sm leading-relaxed">
          {{ description }}
        </p>
      </div>

      <div class="h-[340px] sm:h-[430px] xl:col-span-7 xl:h-full">
        <div class="border-gray-200 h-full overflow-hidden rounded-lg border bg-white shadow-sm">
          <div
            v-if="renderLoading && !hasLoaded"
            class="text-gray-500 flex h-full items-center justify-center gap-2 text-sm"
          >
            <SlkFlowerSpinner :size="24" />
            Datenprodukt wird geladen…
          </div>
          <div v-else-if="primaryVisualSpec" class="h-full">
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
            :element="primaryVisual"
            :collection-slug="collection.id"
            :base-url="baseUrl"
          />
          <div v-else class="text-gray-400 bg-gray-50 flex h-full items-center justify-center text-sm">
            Keine Kartenvisualisierung verfügbar.
          </div>
        </div>
      </div>
    </div>

    <div class="h-[688px] overflow-visible lg:h-[368px]">
      <DataProductJourneyCarousel
        v-if="hasLoaded && renderSteps.length"
        :steps="renderSteps"
        :collection="collection"
        :ars="ars"
        :base-url="baseUrl"
        :population="population"
        :area-name="areaName"
        :export-updated-at="exportUpdatedAt"
        :export-attribution="exportAttribution"
      />

      <div v-else-if="renderError" class="text-gray-400 mt-8 text-sm">
        Weitere Visualisierungen konnten nicht geladen werden.
      </div>

      <div v-else class="mt-8">
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

    <div class="overflow-visible">
      <AttributionBlock :summary="collectionSummary?.aggregate ?? null" />
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
  return [meta?.attribution, meta?.license_name].filter(Boolean).join(" | ");
});

const loadedElements = computed(() => renderSteps.value.flatMap((step) => step.elements));

const primaryVisual = computed<RenderElement | null>(
  () => bestVisualElement(loadedElements.value) ?? bestVisualElement(effectiveCollection.value.render_elements ?? []),
);

const primaryVisualSpec = computed(() =>
  primaryVisual.value?.vegalite_spec
    ? injectAreaIntoSpec(primaryVisual.value.vegalite_spec as object, props.ars)
    : null,
);
const primaryVisualTitle = computed(() => localizedText(primaryVisual.value?.title) || title.value);
const primaryVisualSubtitle = computed(() => localizedText(primaryVisual.value?.description) || description.value);

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

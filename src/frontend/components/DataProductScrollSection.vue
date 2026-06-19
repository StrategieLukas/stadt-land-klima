<template>
  <section
    ref="sectionRef"
    :id="collection.id"
    :data-collection-id="collection.id"
    :data-sector-key="sectorKeyValue"
    class="border-gray-100 border-t py-10"
    :style="`scroll-margin-top: ${scrollMarginTop}px`"
  >
    <div class="grid gap-5 xl:grid-cols-12 xl:items-stretch">
      <div class="flex flex-col gap-4 xl:col-span-5">
        <div
          class="border-gray-200 relative flex min-h-[280px] flex-col justify-end overflow-hidden rounded-lg border bg-white shadow-sm"
        >
          <img
            v-if="collection.cover_image_url"
            :src="collection.cover_image_url"
            :alt="title"
            class="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
          />
          <div v-else class="absolute inset-0 flex items-center justify-center" :style="fallbackBackground">
            <Icon
              :icon="collection.iconify_str ? String(collection.iconify_str) : 'mdi:chart-areaspline'"
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

        <p v-if="description" class="text-gray-600 text-sm leading-relaxed">
          {{ description }}
        </p>
      </div>

      <div class="xl:col-span-7">
        <div class="border-gray-200 h-full min-h-[340px] overflow-hidden rounded-lg border bg-white shadow-sm">
          <div
            v-if="renderLoading && !hasLoaded"
            class="text-gray-500 flex h-[340px] items-center justify-center gap-2 text-sm"
          >
            <SlkFlowerSpinner :size="24" />
            Datenprodukt wird geladen…
          </div>
          <div v-else-if="primaryVisualSpec" class="h-[340px] sm:h-[430px] xl:h-full xl:min-h-[430px]">
            <ClientOnly>
              <VegaChart :spec="primaryVisualSpec" />
            </ClientOnly>
          </div>
          <DataImage
            v-else-if="primaryVisual?.type === 'image'"
            :element="primaryVisual"
            :collection-slug="collection.id"
            :base-url="baseUrl"
          />
          <div v-else class="text-gray-400 bg-gray-50 flex h-[340px] items-center justify-center text-sm">
            Keine Kartenvisualisierung verfügbar.
          </div>
        </div>
      </div>
    </div>

    <DataProductJourneyCarousel
      v-if="hasLoaded && renderSteps.length"
      :steps="renderSteps"
      :collection="collection"
      :ars="ars"
      :base-url="baseUrl"
      :population="population"
    />

    <div v-else-if="renderError" class="text-gray-400 mt-6 text-sm">
      Weitere Visualisierungen konnten nicht geladen werden.
    </div>

    <AttributionBlock :summary="collectionSummary?.aggregate ?? null" />
  </section>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useCollectionRender } from "~/composables/useCollectionRender";
import type { Collection, CollectionSummary, RenderElement } from "~/types/slz-api";
import {
  bestVisualElement,
  firstKpiElement,
  injectAreaIntoSpec,
  localizedText,
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
}>();

const sectionRef = ref<HTMLElement | null>(null);
const hasLoaded = ref(false);
const collectionSummary = ref<CollectionSummary | null>(null);
let observer: IntersectionObserver | null = null;

const {
  steps: renderSteps,
  loading: renderLoading,
  error: renderError,
  load,
  loadFromRender,
} = useCollectionRender(props.baseUrl);

const title = computed(() => localizedText(props.collection.title) || props.collection.id);
const description = computed(() => {
  const firstStepDescription = localizedText(props.collection.narrative_steps?.[0]?.description);
  return firstStepDescription || localizedText(props.collection.description);
});
const sector = computed(() => sectorLabel(props.collection));
const sectorKeyValue = computed(() => sectorKey(props.collection));
const color = computed(() => sectorColor(props.collection));
const kpi = computed(() => firstKpiElement(props.collection));

const loadedElements = computed(() => renderSteps.value.flatMap((step) => step.elements));

const primaryVisual = computed<RenderElement | null>(
  () => bestVisualElement(loadedElements.value) ?? bestVisualElement(props.collection.render_elements ?? []),
);

const primaryVisualSpec = computed(() =>
  primaryVisual.value?.vegalite_spec
    ? injectAreaIntoSpec(primaryVisual.value.vegalite_spec as object, props.ars)
    : null,
);

const fallbackBackground = computed(() => `background: linear-gradient(135deg, ${color.value}18, ${color.value}36);`);

async function loadSectionData() {
  if (hasLoaded.value || !props.collection.id) return;
  try {
    if (props.ars) await loadFromRender(props.collection.id, props.ars);
    if (!renderSteps.value.length) await load(props.collection.id, props.collection);
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

<template>
  <div>
    <!-- ── Sticky breadcrumb + back nav ──────────────────────────────────── -->
    <nav class="relative sticky z-30" :style="`top: ${pillTop}px`">
      <div
        class="absolute inset-y-0 -z-10 border-b border-gray-100 bg-white/90 backdrop-blur-xs"
        style="left: calc((100% - 100vw) / 2); right: calc((100% - 100vw) / 2)"
      />
      <div class="relative flex min-w-0 items-center gap-3 py-2">
        <NuxtLink
          :to="`/data/${areaSlug}`"
          class="flex flex-none items-center gap-1 text-xs text-[#006e94] hover:underline"
          @click="startDataRouteFeedback(`${area?.name ?? areaSlug} wird geladen...`)"
        >
          <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
          {{ area?.name ?? areaSlug }}
        </NuxtLink>
        <span class="text-xs text-gray-300 select-none">›</span>
        <span class="truncate text-xs font-medium text-gray-700">{{ collectionTitle }}</span>
      </div>
    </nav>

    <!-- ── Loading ───────────────────────────────────────────────────────── -->
    <div v-if="pageLoading || renderLoading || dataRouteLoading" class="py-16">
      <div class="flex items-center justify-center gap-2">
        <SlkFlowerSpinner :size="32" />
        <span class="text-sm text-gray-500">Datensatz wird geladen…</span>
      </div>
      <div class="mx-auto mt-8 grid max-w-5xl gap-5 xl:grid-cols-12">
        <div class="space-y-4 xl:col-span-5">
          <div class="h-52 animate-pulse rounded-lg bg-gray-100" />
          <div class="h-28 animate-pulse rounded-lg bg-gray-100" />
        </div>
        <div class="h-80 animate-pulse rounded-lg bg-gray-100 xl:col-span-7" />
      </div>
    </div>

    <!-- ── Error ─────────────────────────────────────────────────────────── -->
    <div v-else-if="renderError" class="py-16 text-center text-sm text-gray-400">
      Dieser Datensatz konnte nicht geladen werden.
    </div>

    <template v-else-if="renderSteps.length">
      <!-- ── Journey progress bar ─────────────────────────────────────── -->
      <ScrollProgressBar v-if="renderSteps.length > 1" :current="activeStepIndex" :total="renderSteps.length" />

      <!-- ── Journey step nav ───────────────────────────────────────────── -->
      <JourneyNav
        v-if="renderSteps.length > 1"
        :steps="renderSteps"
        :active-index="activeStepIndex"
        :top="pillTop + 44"
        @scroll-to="scrollToStep"
      />

      <!-- ── Steps ─────────────────────────────────────────────────────── -->
      <div ref="stepsContainer" class="mt-4">
        <JourneyStep
          v-for="step in renderSteps"
          :key="step.index"
          :step="step"
          :collection="collection!"
          :summary="collectionSummary"
          :ars="area?.ars ?? ''"
          :base-url="baseUrl"
          :population="area?.population ?? null"
          :area-name="exportAreaName"
          :export-updated-at="exportUpdatedAt"
          :export-attribution="exportAttribution"
        />
      </div>

      <!-- ── Attribution ───────────────────────────────────────────────── -->
      <AttributionBlock :summary="collectionSummary" :collection="collection" />
    </template>

    <!-- ── No narrative steps yet: fall back to DataProductPanel ─────────── -->
    <div v-else-if="collection" class="mt-6">
      <DataProductPanel
        :collection="collection"
        :initial-summary="collectionSummary"
        :ars="area?.ars ?? ''"
        :base-url="baseUrl"
        :municipality-name="exportAreaName"
        :population="area?.population ?? null"
        :export-updated-at="exportUpdatedAt"
        :export-attribution="exportAttribution"
      />
      <AttributionBlock :summary="collectionSummary" :collection="collection" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { singleRouteValue } from "~/shared/routeValues";
import { formatDataAttribution, resolveDataAttribution } from "~/utils/dataAttribution";
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import { useHeaderHeight } from "~/composables/useHeaderHeight";
import { useMobileHeaderHidden } from "~/composables/useMobileHeaderHidden";
import { resolveSlugToArea } from "~/composables/useAreaBySlug";
import { useCollectionRender } from "~/composables/useCollectionRender";
import { useSlzLocale } from "~/composables/useSlzLocale";
import { DEFAULT_DATA_PAGE_CONFIG, isCollectionVisible } from "~/utils/dataPageVisibility";

definePageMeta({
  key: (route) => route.path,
  middleware: ["data-availability"],
});

const route = useRoute();
const runtimeConfig = useRuntimeConfig();
const baseUrl = runtimeConfig.public.stadtlandzahlBaseUrl as string;

const areaSlug = computed(() => singleRouteValue(route.params.slug) ?? "");
const collectionSlug = computed(() => singleRouteValue(route.params.collection) ?? "");

const { data: dataPageConfig } = await useDataPageConfig();
if (!isCollectionVisible(collectionSlug.value, dataPageConfig.value ?? DEFAULT_DATA_PAGE_CONFIG)) {
  throw createError({ statusCode: 404 });
}

const { t } = useSlzLocale();
const headerHeight = useHeaderHeight();
const mobileHeaderHidden = useMobileHeaderHidden();

const isDesktop = useState("layout-isDesktop", () => true);
const pillTop = computed(() => (isDesktop.value ? headerHeight.value : mobileHeaderHidden.value ? 0 : 64));

// ── Collection + render data (SSR) ────────────────────────────────────────────

const { data: area } = await useAsyncData(`area-${areaSlug.value}`, () => resolveSlugToArea(areaSlug.value, true));
const productData = await useCollectionPageData(collectionSlug, () => area.value?.ars ?? "");
const collection = computed(() => productData.data.value?.collection ?? null);
const collectionSummary = computed(() => productData.data.value?.summary ?? null);

const {
  steps: renderSteps,
  loading: renderLoading,
  error: renderError,
  load,
  seedRender,
} = useCollectionRender(baseUrl);
const {
  isLoading: dataRouteLoading,
  start: startDataRouteFeedback,
  stop: stopDataRouteFeedback,
} = useDataRouteFeedback();

const collectionTitle = computed(() => {
  if (collection.value?.title) return t(collection.value.title);
  return collectionSlug.value;
});
const exportAreaName = computed(
  () => [area.value?.prefix, area.value?.name].filter(Boolean).join(" ") || area.value?.name || areaSlug.value,
);
const summaryMetadata = computed(() => collectionSummary.value?.aggregate?.metadata ?? null);
const exportUpdatedAt = computed(() => summaryMetadata.value?.effective_date ?? "");
const exportAttribution = computed(() =>
  formatDataAttribution(resolveDataAttribution({ summary: collectionSummary.value, collection: collection.value }, t)),
);

// ── Step observer ─────────────────────────────────────────────────────────────

const activeStepIndex = ref(0);
const stepsContainer = ref<HTMLElement | null>(null);
const pageLoading = computed(() => productData.status.value === "pending");
let stepObserver: IntersectionObserver | null = null;

const initialData = productData.data.value;
if (initialData?.render) seedRender(initialData.render);
else if (collection.value) await load(collectionSlug.value, collection.value);
else renderError.value = true;
stopDataRouteFeedback();
onMounted(initStepObserver);

onBeforeUnmount(() => {
  stepObserver?.disconnect();
});

function initStepObserver() {
  if (!stepsContainer.value) return;
  const stepEls = stepsContainer.value.querySelectorAll('[id^="step-"]');
  if (!stepEls.length) return;

  stepObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const idx = parseInt((entry.target as HTMLElement).id.replace("step-", ""), 10);
          if (!isNaN(idx)) activeStepIndex.value = idx;
        }
      }
    },
    { rootMargin: "-20% 0px -60% 0px", threshold: 0 },
  );

  stepEls.forEach((el) => {
    stepObserver!.observe(el);
  });
}

function scrollToStep(index: number) {
  const el = document.getElementById(`step-${index}`);
  if (!el) return;
  const offset = pillTop.value + (renderSteps.value.length > 1 ? 88 : 44);
  const top = el.getBoundingClientRect().top + window.scrollY - offset;
  window.scrollTo({ top, behavior: "smooth" });
}

// ── SEO ───────────────────────────────────────────────────────────────────────

usePageSeo({
  title: computed(() =>
    collection.value ? `${t(collection.value.title)} – ${area.value?.name ?? ""}` : collectionSlug.value,
  ),
});
</script>

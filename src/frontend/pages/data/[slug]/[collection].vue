<template>
  <div>
    <!-- ── Sticky breadcrumb + back nav ──────────────────────────────────── -->
    <nav class="relative sticky z-30" :style="`top: ${pillTop}px`">
      <div
        class="border-gray-100 absolute inset-y-0 -z-10 border-b bg-white/90 backdrop-blur-sm"
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
        <span class="text-gray-300 select-none text-xs">›</span>
        <span class="text-gray-700 truncate text-xs font-medium">{{ collectionTitle }}</span>
      </div>
    </nav>

    <!-- ── Loading ───────────────────────────────────────────────────────── -->
    <div v-if="pageLoading || renderLoading || dataRouteLoading" class="py-16">
      <div class="flex items-center justify-center gap-2">
        <SlkFlowerSpinner :size="32" />
        <span class="text-gray-500 text-sm">Datensatz wird geladen…</span>
      </div>
      <div class="mx-auto mt-8 grid max-w-5xl gap-5 xl:grid-cols-12">
        <div class="space-y-4 xl:col-span-5">
          <div class="bg-gray-100 h-52 animate-pulse rounded-lg" />
          <div class="bg-gray-100 h-28 animate-pulse rounded-lg" />
        </div>
        <div class="bg-gray-100 h-80 animate-pulse rounded-lg xl:col-span-7" />
      </div>
    </div>

    <!-- ── Error ─────────────────────────────────────────────────────────── -->
    <div v-else-if="renderError" class="text-gray-400 py-16 text-center text-sm">
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
          :ars="area?.ars ?? ''"
          :base-url="baseUrl"
          :population="area?.population ?? null"
          :area-name="exportAreaName"
          :export-updated-at="exportUpdatedAt"
          :export-attribution="exportAttribution"
        />
      </div>

      <!-- ── Attribution ───────────────────────────────────────────────── -->
      <AttributionBlock :summary="collectionSummary?.aggregate ?? null" />
    </template>

    <!-- ── No narrative steps yet: fall back to DataProductPanel ─────────── -->
    <div v-else-if="collection" class="mt-6">
      <DataProductPanel
        :collection="collection"
        :ars="area?.ars ?? ''"
        :base-url="baseUrl"
        :municipality-name="exportAreaName"
        :population="area?.population ?? null"
        :export-updated-at="exportUpdatedAt"
        :export-attribution="exportAttribution"
      />
      <AttributionBlock :summary="collectionSummary?.aggregate ?? null" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import { useHeaderHeight } from "~/composables/useHeaderHeight.js";
import { useMobileHeaderHidden } from "~/composables/useMobileHeaderHidden.js";
import { resolveSlugToArea } from "~/composables/useAreaBySlug.js";
import { useCollectionRender } from "~/composables/useCollectionRender";
import { useSlzLocale } from "~/composables/useSlzLocale";
import type { Collection, CollectionSummary } from "~/types/slz-api";

definePageMeta({
  key: (route) => route.fullPath,
});

const route = useRoute();
const runtimeConfig = useRuntimeConfig();
const baseUrl = runtimeConfig.public.stadtlandzahlBaseUrl as string;

const areaSlug = computed(() => route.params.slug as string);
const collectionSlug = computed(() => route.params.collection as string);

const { t } = useSlzLocale();
const headerHeight = useHeaderHeight();
const mobileHeaderHidden = useMobileHeaderHidden();

const isDesktop = ref(false);
const pillTop = computed(() => (isDesktop.value ? headerHeight.value : mobileHeaderHidden.value ? 0 : 64));

// ── Collection + render data (CSR) ────────────────────────────────────────────

const collection = ref<Collection | null>(null);
const collectionSummary = ref<CollectionSummary | null>(null);

const {
  steps: renderSteps,
  loading: renderLoading,
  error: renderError,
  load,
  loadFromRender,
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
function sourceLabel(value: Record<string, string> | string | null | undefined) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return t(value);
}
const exportAttribution = computed(() => {
  const meta = summaryMetadata.value;
  const aggregateAttribution = [meta?.attribution, meta?.license_name].filter(Boolean).join(" | ");
  if (aggregateAttribution) return aggregateAttribution;
  const sources = collectionSummary.value?.source_attributions ?? collectionSummary.value?.sourceAttributions ?? [];
  return sources
    .map((source) => [sourceLabel(source.source), source.attribution, source.license_name ?? source.licenseName].filter(Boolean).join(" | "))
    .filter(Boolean)
    .join("; ");
});

// ── Step observer ─────────────────────────────────────────────────────────────

const activeStepIndex = ref(0);
const stepsContainer = ref<HTMLElement | null>(null);
const pageLoading = ref(true);
let stepObserver: IntersectionObserver | null = null;
let mediaQueryList: MediaQueryList | null = null;
let mediaQueryCleanup: (() => void) | null = null;

onMounted(() => {
  mediaQueryList = window.matchMedia("(min-width: 1280px)");
  const updateIsDesktop = (e: MediaQueryList | MediaQueryListEvent) => {
    isDesktop.value = e.matches;
  };
  updateIsDesktop(mediaQueryList);
  mediaQueryList.addEventListener("change", updateIsDesktop);
  mediaQueryCleanup = () => mediaQueryList?.removeEventListener("change", updateIsDesktop);
});

onMounted(async () => {
  try {
    const data = await $fetch<Collection>(`${baseUrl}/api/collections/${collectionSlug.value}/`);
    collection.value = data;
    if (area.value?.ars) {
      await loadFromRender(collectionSlug.value, area.value.ars);
    } else {
      await load(collectionSlug.value, data);
    }
  } catch (_) {
    renderError.value = true;
  } finally {
    pageLoading.value = false;
    stopDataRouteFeedback();
  }

  // Fetch summary for attribution block (best-effort)
  if (area.value?.ars) {
    try {
      const s = await $fetch<CollectionSummary>(`${baseUrl}/api/collections/${collectionSlug.value}/summary/`, {
        params: { area: area.value.ars },
      });
      collectionSummary.value = s;
    } catch (_) {}
  }

  initStepObserver();
});

onBeforeUnmount(() => {
  mediaQueryCleanup?.();
  stepObserver?.disconnect();
});

// ── Area data (SSR) ────────────────────────────────────────────────────────────

const { data: area } = await useAsyncData(`area-${areaSlug.value}`, () => resolveSlugToArea(areaSlug.value));

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

  stepEls.forEach((el) => stepObserver!.observe(el));
}

function scrollToStep(index: number) {
  const el = document.getElementById(`step-${index}`);
  if (!el) return;
  const offset = pillTop.value + (renderSteps.value.length > 1 ? 88 : 44);
  const top = el.getBoundingClientRect().top + window.scrollY - offset;
  window.scrollTo({ top, behavior: "smooth" });
}

// ── SEO ───────────────────────────────────────────────────────────────────────

useHead({
  title: computed(() =>
    collection.value ? `${t(collection.value.title)} – ${area.value?.name ?? ""}` : collectionSlug.value,
  ),
});
</script>

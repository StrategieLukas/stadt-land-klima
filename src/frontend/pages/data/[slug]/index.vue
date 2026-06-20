<template>
  <div>
    <!-- ── Sticky breadcrumb nav ──────────────────────────────────────────── -->
    <nav class="sticky z-30" :style="`top: ${pillTop}px`">
      <!-- Full-viewport background: bleeds past the max-w container via negative offsets.
           No z-index needed — DOM order ensures content div (below) paints on top. -->
      <div
        class="border-gray-100 absolute border-b bg-white/90 backdrop-blur-sm"
        style="top: 0; bottom: 0; left: calc((100% - 100vw) / 2); right: calc((100% - 100vw) / 2)"
      />
      <div class="relative flex min-w-0 flex-wrap items-center gap-3 py-2 sm:flex-nowrap">
        <div class="flex-none">
          <GermanyMapIndicator
            v-if="displayLat !== null && displayLon !== null"
            :lat="displayLat"
            :lon="displayLon"
            :size="30"
          />
          <div v-else class="skeleton h-[30px] w-[30px] rounded-md" />
        </div>
        <ol class="flex min-w-0 flex-1 flex-wrap items-center gap-1 text-xs">
          <template v-if="!hasDisplayArea">
            <li class="skeleton h-3 w-20" />
            <li class="text-gray-300 select-none">›</li>
            <li class="skeleton h-3 w-28" />
          </template>
          <template v-else-if="!areaReady">
            <li>
              <BreadcrumbItem label="Deutschland" href="/data" :sibling-level="null" />
            </li>
            <li class="text-gray-300 select-none">›</li>
            <li class="skeleton h-3 w-32" />
            <li class="text-gray-300 select-none">›</li>
            <li class="text-gray-800 font-semibold">{{ `${displayArea?.prefix} ${displayArea?.name}`.trim() }}</li>
          </template>
          <template v-else>
            <template v-if="displayArea?.level > 1">
              <li>
                <BreadcrumbItem label="Deutschland" href="/data" :sibling-level="null" />
              </li>
              <li class="text-gray-300 select-none">›</li>
            </template>
            <template v-for="crumb in containedBy" :key="crumb.ars || crumb.name">
              <li>
                <BreadcrumbItem
                  :label="`${crumb.prefix} ${crumb.name}`.trim()"
                  :href="`/data/${areaToSlug(crumb.prefix, crumb.name)}`"
                  :sibling-level="crumb.level"
                  :ars-prefix="crumb.level === 4 ? crumb.ars.slice(0, 2) : ''"
                  :current-ars="area?.ars"
                />
              </li>
              <li class="text-gray-300 select-none">›</li>
            </template>
            <li>
              <BreadcrumbItem
                :label="`${displayArea?.prefix} ${displayArea?.name}`.trim()"
                is-current
                :sibling-level="displayArea?.level === 1 ? null : displayArea?.level"
                :ars-prefix="displayArea?.level === 4 ? displayArea?.ars?.slice(0, 2) : ''"
                :current-ars="displayArea?.ars"
              />
            </li>
          </template>
        </ol>
        <a
          v-if="areaReady && collections.length"
          href="#alle-datenprodukte"
          class="border-gray-200 text-gray-700 inline-flex flex-none items-center gap-1.5 rounded-lg border bg-white px-3 py-1.5 text-xs font-semibold shadow-sm transition-colors hover:border-[#006e94]/30 hover:text-[#006e94]"
          @click.prevent="scrollToAllProducts"
        >
          <Icon icon="mdi:view-grid-outline" class="h-4 w-4" />
          Alle Datenprodukte
        </a>
      </div>
    </nav>

    <!-- ── Route-level loading: avoid rendering stale area content during reused-page navigation. ── -->
    <section v-if="!hasDisplayArea" class="py-6">
      <div class="text-gray-500 mb-4 flex items-center justify-center gap-3 text-sm">
        <SlkFlowerSpinner :size="28" />
        <span>{{ dataRouteLabel }}</span>
      </div>
      <div class="grid gap-5 xl:grid-cols-12 xl:items-center">
        <div class="border-gray-200 rounded-lg border p-5 xl:col-span-5">
          <div class="skeleton mb-4 h-3 w-24" />
          <div class="skeleton mb-6 h-14 w-3/4" />
          <div class="grid grid-cols-2 gap-4">
            <div class="skeleton h-14" />
            <div class="skeleton h-14" />
            <div class="skeleton h-14" />
          </div>
        </div>
        <div class="skeleton h-[240px] rounded-lg sm:h-[280px] xl:col-span-7 xl:h-[320px]" />
      </div>
    </section>

    <!-- ── Overview layout (Germany / non-rateable Bundesland) ───────────── -->
    <template v-else-if="areaReady && usesOverviewLayout">
      <AreaOverview :area="area" :contained-by="containedBy" />
    </template>

    <!-- ── Scrollytelling layout (Kreis / Gemeinde) ───────────────────────── -->
    <template v-else>
      <!-- ── Hero (Übersicht) ─────────────────────────────────────────────── -->
      <section
        id="uebersicht"
        class="grid gap-5 py-4 xl:grid-cols-12 xl:items-center"
        :style="`scroll-margin-top: ${headerHeight + 16}px`"
      >
        <div
          class="group/hero border-gray-200 relative h-full overflow-hidden rounded-lg border p-5 shadow-sm xl:col-span-5"
          :class="areaReady && heroBackgroundImage ? 'bg-gray-900' : 'bg-white'"
          :style="areaReady ? heroBackgroundStyle : undefined"
        >
          <div v-if="!areaReady" class="skeleton absolute inset-0 rounded-none" />
          <div v-else-if="heroBackgroundImage" class="absolute inset-0 h-full bg-black/45 backdrop-blur-[1px]" />
          <span
            v-if="areaReady && heroBackgroundImage && heroBackgroundAttribution"
            class="pointer-events-none absolute right-2 top-2 z-[1] max-w-[calc(100%-1rem)] truncate rounded bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white/90 opacity-0 transition-opacity focus-within:opacity-100 group-hover/hero:opacity-100"
            :title="heroBackgroundAttribution"
          >
            {{ heroBackgroundAttribution }}
          </span>
          <div class="relative">
            <p
              class="mb-2 text-xs font-bold uppercase tracking-widest"
              :class="areaReady && heroBackgroundImage ? 'text-white/80' : 'text-[#006e94]'"
            >
              {{ displayArea?.prefix }}
            </p>
            <h1
              class="mb-4 text-5xl font-black leading-none xl:text-6xl"
              :class="areaReady && heroBackgroundImage ? 'text-white' : 'text-gray-900'"
            >
              {{ displayArea?.name }}
            </h1>

            <dl class="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <div v-if="displayArea?.population">
                <dt
                  class="mb-0.5 text-xs"
                  :class="areaReady && heroBackgroundImage ? 'text-white/70' : 'text-gray-500'"
                >
                  Einwohner
                </dt>
                <dd
                  class="text-2xl font-black tabular-nums"
                  :class="areaReady && heroBackgroundImage ? 'text-white' : 'text-gray-900'"
                >
                  {{ displayArea.population?.toLocaleString("de-DE") }}
                </dd>
              </div>
              <div v-if="displayArea?.level">
                <dt
                  class="mb-0.5 text-xs"
                  :class="areaReady && heroBackgroundImage ? 'text-white/70' : 'text-gray-500'"
                >
                  Verwaltungsebene
                </dt>
                <dd
                  class="text-2xl font-black"
                  :class="areaReady && heroBackgroundImage ? 'text-white' : 'text-gray-900'"
                >
                  {{ levelLabel(displayArea.level) }}
                </dd>
              </div>
              <div v-if="displayArea?.ars">
                <dt
                  class="mb-0.5 text-xs"
                  :class="areaReady && heroBackgroundImage ? 'text-white/70' : 'text-gray-500'"
                >
                  ARS
                </dt>
                <dd
                  class="text-2xl font-black tabular-nums"
                  :class="areaReady && heroBackgroundImage ? 'text-white' : 'text-gray-900'"
                >
                  {{ displayArea.ars }}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        <div class="xl:col-span-7">
          <DataAreaHeroMap
            v-if="areaReady"
            :area="area"
            :nearby-areas="nearbyAreas"
            :nearby-areas-loading="nearbyAreasLoading"
          />
          <div v-else class="skeleton h-[240px] rounded-lg sm:h-[280px] xl:h-[320px]" />
        </div>
      </section>

      <!-- ── Data product overview + scroll sections ──────────────────────── -->
      <section
        id="klimadaten"
        ref="exploreSection"
        class="py-2"
        :style="`scroll-margin-top: ${productScrollMarginTop}px`"
      >
        <div v-if="showCollectionsSkeleton">
          <div class="border-gray-100 border-t py-4">
            <div class="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div class="skeleton mb-2 h-3 w-28" />
                <div class="skeleton h-8 w-60" />
              </div>
              <div class="skeleton h-3 w-20" />
            </div>
            <div class="grid grid-cols-1 gap-3 xs:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
              <div
                v-for="i in 10"
                :key="i"
                class="border-gray-200 min-h-[230px] overflow-hidden rounded-lg border bg-white"
              >
                <div class="skeleton h-24 rounded-none" />
                <div class="space-y-3 p-3">
                  <div class="skeleton h-4 w-5/6" />
                  <div class="skeleton h-4 w-3/5" />
                  <div class="pt-14">
                    <div class="skeleton h-3 w-full" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="sticky z-20 -mx-2 bg-white/90 px-2 py-3 backdrop-blur-sm" :style="`top: ${sectorBarTop}px`">
            <div class="relative flex gap-2 overflow-hidden">
              <div v-for="i in 5" :key="i" class="skeleton h-8 w-36 rounded-full" />
            </div>
          </div>

          <div class="py-8">
            <div class="skeleton mb-4 h-10 w-72" />
            <div v-for="i in 2" :key="i" class="border-gray-100 overflow-visible border-t pb-6 pt-10">
              <div class="grid h-[820px] gap-5 sm:h-[760px] xl:h-[430px] xl:grid-cols-12">
                <div class="space-y-4 xl:col-span-5">
                  <div class="skeleton h-[280px] rounded-lg" />
                  <div class="skeleton h-28 rounded-lg" />
                  <div class="skeleton h-16 rounded-lg" />
                </div>
                <div class="skeleton h-[340px] rounded-lg sm:h-[430px] xl:col-span-7 xl:h-full" />
              </div>
              <div class="skeleton mt-6 h-[688px] rounded-lg lg:h-[368px]" />
              <div class="skeleton mt-4 h-[66px] rounded-lg" />
            </div>
          </div>
        </div>

        <template v-else-if="collections.length">
          <DataProductsOverviewGrid
            :collections="collections"
            :ars="displayArea?.ars ?? ''"
            :base-url="baseUrl"
            :population="displayArea?.population ?? null"
            :scroll-margin-top="productScrollMarginTop"
            @select="scrollToCollection"
          />

          <nav class="sticky z-20 -mx-2 bg-white/90 px-2 py-3 backdrop-blur-sm" :style="`top: ${sectorBarTop}px`">
            <div
              class="border-gray-100 pointer-events-none absolute border-b bg-white/90 backdrop-blur-sm"
              style="top: 0; bottom: 0; left: calc((100% - 100vw) / 2); right: calc((100% - 100vw) / 2)"
            />
            <div class="relative flex min-w-0 items-center gap-3">
              <div class="no-scrollbar flex items-center gap-2 overflow-x-auto">
                <button
                  v-for="sector in productSectors"
                  :key="sector.key"
                  type="button"
                  class="inline-flex flex-none items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold transition-colors"
                  :class="
                    sector.key === activeSectorKey
                      ? 'border-transparent text-white'
                      : 'border-gray-200 text-gray-500 bg-white hover:text-[#006e94]'
                  "
                  :style="sector.key === activeSectorKey ? { backgroundColor: sector.color } : undefined"
                  @click="scrollToSector(sector.key)"
                >
                  <img
                    v-if="sectorImages[sector.key]"
                    :src="sectorImages[sector.key]"
                    class="h-6 w-6 flex-shrink-0 grayscale"
                    :class="
                      sector.key === activeSectorKey
                        ? 'opacity-100 mix-blend-screen'
                        : 'opacity-60 mix-blend-multiply invert'
                    "
                    alt=""
                  />
                  {{ $t(`measure_sectors.${sector.key}.title`) }}
                </button>
              </div>
            </div>
          </nav>

          <div>
            <template v-for="group in groupedCollections" :key="group.key">
              <div
                :id="`sector-${group.key}`"
                :data-sector-heading-key="group.key"
                class="border-gray-100 flex items-center gap-2 border-t pb-2 pt-8"
                :style="`scroll-margin-top: ${productScrollMarginTop}px`"
              >
                <span class="h-3 w-3 rounded-full" :style="{ backgroundColor: group.color }" />
                <h2 class="text-gray-900 text-4xl font-black">{{ group.label }}</h2>
                <span class="text-gray-400 justify-self-end text-xs">{{ group.collections.length }} Datenprodukte</span>
              </div>
              <DataProductScrollSection
                v-for="col in group.collections"
                :key="col.id"
                :collection="col"
                :ars="displayArea?.ars ?? ''"
                :base-url="baseUrl"
                :population="displayArea?.population ?? null"
                :scroll-margin-top="productScrollMarginTop"
                :area-name="exportAreaName"
              />
            </template>
          </div>
        </template>

        <div v-else-if="collectionsReady" class="text-gray-400 py-10 text-center text-sm">
          Keine Klimadatensätze verfügbar.
        </div>
      </section> </template
    ><!-- end scrollytelling -->
  </div>
</template>

<script setup>
import { Icon } from "@iconify/vue";
import { ref, computed, nextTick, onMounted, onUnmounted, watch } from "vue";
import { useHeaderHeight } from "~/composables/useHeaderHeight.js";
import { useMobileHeaderHidden } from "~/composables/useMobileHeaderHidden.js";
import { fetchContainedBy, areaToSlug } from "~/composables/useAreaBySlug.js";
import { normalizeCollection, sectorColor, sectorKey, sectorLabel } from "~/utils/dataProducts";
import sectorImages from "~/shared/sectorImages.js";

definePageMeta({
  key: (route) => route.fullPath,
  middleware: [
    (to) => {
      if (String(to.params.slug ?? "") === "bundesrepublik-deutschland") {
        return navigateTo("/data", { redirectCode: 301 });
      }
    },
  ],
});

// ── Route + config ───────────────────────────────────────────────────────────

const { $directus, $readItems, $t } = useNuxtApp();
const route = useRoute();
const slug = computed(() => String(route.params.slug ?? ""));

const runtimeConfig = useRuntimeConfig();
const baseUrl = runtimeConfig.public.stadtlandzahlBaseUrl;
const { label: dataRouteLabel, seedArea, stop: stopDataRouteFeedback, clearSeedArea } = useDataRouteFeedback();

// ── Layout helpers ───────────────────────────────────────────────────────────

const headerHeight = useHeaderHeight();
const mobileHeaderHidden = useMobileHeaderHidden();
const isDesktop = useState("layout-isDesktop");

const pillTop = computed(() => (isDesktop.value ? headerHeight.value : mobileHeaderHidden.value ? 0 : 64));

onUnmounted(() => {
  removeProductSectionListeners?.();
});

// ── Main data (SSR) ──────────────────────────────────────────────────────────

const pageDataKey = computed(() => `data-area-page-${slug.value}`);

const { data: pageData, pending: areaPending } = useAsyncData(
  pageDataKey,
  async () => {
    const resolvedArea = await $fetch("/api/area-by-slug", {
      params: { slug: slug.value, includeGeo: true },
    });
    if (!resolvedArea) return { requestedSlug: slug.value, notFound: true };
    const ars = resolvedArea.ars;
    const [containedByChain, muniResult] = await Promise.all([
      fetchContainedBy(ars, resolvedArea.level).catch(() => []),
      $directus
        .request(
          $readItems("municipalities", {
            filter: { ars: { _eq: ars } },
            fields: ["image", "image_credits"],
            limit: 1,
          }),
        )
        .catch(() => []),
    ]);

    return {
      requestedSlug: slug.value,
      area: resolvedArea,
      containedBy: containedByChain ?? [],
      municipalityImageId: muniResult?.[0]?.image ?? null,
      municipalityImageCredits: muniResult?.[0]?.image_credits ?? null,
    };
  },
  { watch: [slug], lazy: process.client },
);

if (process.server && pageData.value?.notFound) {
  throw createError({ statusCode: 404, statusMessage: "Gebiet nicht gefunden" });
}

watch(pageData, (value) => {
  if (value?.requestedSlug === slug.value && value?.notFound) {
    throw createError({ statusCode: 404, statusMessage: "Gebiet nicht gefunden" });
  }
});

const matchingSeedArea = computed(() => (seedArea.value?.slug === slug.value ? seedArea.value : null));
const resolvedArea = computed(() => {
  const areaValue = pageData.value?.area;
  if (!areaValue?.name) return null;
  const pageSlug = areaToSlug(areaValue?.prefix ?? "", areaValue.name);
  return pageSlug === slug.value ? areaValue : null;
});
const area = computed(() => resolvedArea.value ?? matchingSeedArea.value ?? {});
const displayArea = computed(() => area.value);
const hasDisplayArea = computed(() => !!displayArea.value?.name);
const exportAreaName = computed(
  () => [displayArea.value?.prefix, displayArea.value?.name].filter(Boolean).join(" ") || String(slug.value),
);
const areaReady = computed(() => !!resolvedArea.value && !areaPending.value);
const containedBy = computed(() => (areaReady.value ? (pageData.value?.containedBy ?? []) : []));
const municipalityImageId = computed(() => (areaReady.value ? (pageData.value?.municipalityImageId ?? null) : null));
const municipalityImageCredits = computed(() =>
  areaReady.value ? (pageData.value?.municipalityImageCredits ?? null) : null,
);
const displayGeoCenter = computed(() => displayArea.value?.geo_center ?? displayArea.value?.geoCenter ?? null);
const displayLat = computed(() => {
  const center = displayGeoCenter.value;
  if (!center) return null;
  if (Array.isArray(center)) return center[1];
  if (center.coordinates) return center.coordinates[1];
  return center.lat ?? null;
});
const displayLon = computed(() => {
  const center = displayGeoCenter.value;
  if (!center) return null;
  if (Array.isArray(center)) return center[0];
  if (center.coordinates) return center.coordinates[0];
  return center.lon ?? center.lng ?? null;
});
const isAreaLoading = computed(() => !areaReady.value);
const usesOverviewLayout = computed(
  () => areaReady.value && (area.value?.level ?? 99) <= 2 && !area.value?.is_reasonable_for_municipal_rating,
);

// ── Nearby/bordering areas (CSR, intentionally decoupled) ────────────────────

const nearbyAreas = ref([]);
const nearbyAreasLoading = ref(false);
let nearbyAreasRequestId = 0;

async function loadNearbyAreasForCurrentArea() {
  if (process.server) return;

  const requestId = ++nearbyAreasRequestId;
  const requestSlug = slug.value;
  const currentArea = resolvedArea.value;

  nearbyAreas.value = [];
  nearbyAreasLoading.value = false;

  if (!areaReady.value || !currentArea?.ars || currentArea.level <= 2) {
    return;
  }

  nearbyAreasLoading.value = true;

  try {
    const nearbyResult = await $fetch("/api/area-nearby", {
      params: { ars: currentArea.ars, radius_km: 45, levels: "4,5,6", limit: 24 },
      timeout: 8000,
    }).catch(() => ({ areas: [] }));

    const enrichedNearbyAreas = await Promise.all(
      (nearbyResult?.areas ?? [])
        .filter(isReasonableArea)
        .slice(0, 24)
        .map(async (nearbyArea) => {
          if (nearbyArea.geo_area ?? nearbyArea.geoArea) return nearbyArea;
          try {
            const nearbySlug = areaToSlug(nearbyArea.prefix ?? "", nearbyArea.name ?? "");
            const withGeo = await $fetch("/api/area-by-slug", {
              params: { slug: nearbySlug, includeGeo: true },
              timeout: 8000,
            });
            return withGeo ? { ...nearbyArea, ...withGeo } : nearbyArea;
          } catch {
            return nearbyArea;
          }
        }),
    );

    if (requestId !== nearbyAreasRequestId || requestSlug !== slug.value) return;
    nearbyAreas.value = enrichedNearbyAreas;
  } catch {
    if (requestId === nearbyAreasRequestId && requestSlug === slug.value) nearbyAreas.value = [];
  } finally {
    if (requestId === nearbyAreasRequestId && requestSlug === slug.value) nearbyAreasLoading.value = false;
  }
}

watch(
  [areaReady, () => resolvedArea.value?.ars, slug],
  () => {
    loadNearbyAreasForCurrentArea();
  },
  { immediate: true },
);

// ── Collections (CSR, area-injected) ────────────────────────────────────────

const collections = ref([]);
const collectionsLoading = ref(false);
const collectionsLoadedForSlug = ref("");
const collectionsReady = computed(
  () => areaReady.value && !collectionsLoading.value && collectionsLoadedForSlug.value === slug.value,
);
const showCollectionsSkeleton = computed(() => !areaReady.value || collectionsLoading.value || !collectionsReady.value);
let collectionsRequestId = 0;

async function loadCollectionsForCurrentArea() {
  const requestId = ++collectionsRequestId;
  const requestSlug = slug.value;

  collections.value = [];
  collectionsLoadedForSlug.value = "";

  // Germany and non-rateable Bundesländer use AreaOverview — no collections rendered there.
  if (!areaReady.value || usesOverviewLayout.value) {
    collectionsLoading.value = false;
    return;
  }

  collectionsLoading.value = true;

  try {
    // Try slim manifest first: much smaller (no vegalite_specs), CDN-cached.
    // Cards degrade gracefully: KPI previews still show, map thumbnails are hidden until expanded.
    const manifest = await $fetch(`${baseUrl}/api/manifests/collections-index`, { timeout: 8000 });
    const slim = (manifest?.collections ?? [])
      .filter((c) => c.id !== "administrative-areas")
      .map((c) => normalizeCollection(c));

    if (requestId !== collectionsRequestId || requestSlug !== slug.value) return;

    if (slim.length > 0) {
      collections.value = slim;
      collectionsLoadedForSlug.value = requestSlug;
      collectionsLoading.value = false;
      return;
    }
  } catch {
    /* manifest not deployed yet — fall through */
  }

  try {
    // Fall back to full area-specific API.
    const params = area.value?.ars ? { area: area.value.ars } : {};
    const data = await $fetch(`${baseUrl}/api/collections/`, { params, timeout: 12000 });

    if (requestId !== collectionsRequestId || requestSlug !== slug.value) return;

    collections.value = (data?.collections ?? [])
      .filter((c) => c.id !== "administrative-areas")
      .map((c) => normalizeCollection(c));
    collectionsLoadedForSlug.value = requestSlug;
  } catch {
    if (requestId !== collectionsRequestId || requestSlug !== slug.value) return;

    collections.value = [];
    collectionsLoadedForSlug.value = requestSlug;
  } finally {
    if (requestId === collectionsRequestId && requestSlug === slug.value) {
      collectionsLoading.value = false;
    }
  }
}

watch(
  [areaReady, usesOverviewLayout, () => area.value?.ars, slug],
  () => {
    loadCollectionsForCurrentArea();
  },
  { immediate: true },
);

// ── Product scroll navigation ────────────────────────────────────────────────

const exploreSection = ref(null);
const activeSectorKey = ref("");
let productSectionScrollFrame = null;
let removeProductSectionListeners = null;

const sectorBarTop = computed(() => pillTop.value + 52);
const productScrollMarginTop = computed(() => sectorBarTop.value + 58);

const groupedCollections = computed(() => {
  const groups = [];
  const byKey = new Map();
  for (const collection of collections.value) {
    const key = sectorKey(collection);
    if (!byKey.has(key)) {
      const group = {
        key,
        label: $t(`measure_sectors.${key}.title`) || sectorLabel(collection),
        color: sectorColor(collection),
        collections: [],
      };
      byKey.set(key, group);
      groups.push(group);
    }
    byKey.get(key).collections.push(collection);
  }
  return groups;
});

const productSectors = computed(() => groupedCollections.value.map(({ key, label, color }) => ({ key, label, color })));

const heroBackgroundImage = computed(() => {
  if (municipalityImageId.value) {
    return `${runtimeConfig.public.clientDirectusUrl}/assets/${municipalityImageId.value}?width=1200&quality=80&fit=cover`;
  }
  return findAreaImageUrl(area.value);
});
const heroBackgroundAttribution = computed(
  () => municipalityImageCredits.value || findAreaImageAttribution(area.value),
);
const heroBackgroundStyle = computed(() =>
  heroBackgroundImage.value
    ? {
        backgroundImage: `url("${heroBackgroundImage.value}")`,
        backgroundPosition: "center",
        backgroundSize: "cover",
      }
    : undefined,
);

watch(
  productSectors,
  (sectors) => {
    if (!activeSectorKey.value && sectors.length) activeSectorKey.value = sectors[0].key;
  },
  { immediate: true },
);

watch(isAreaLoading, (loading) => {
  if (!loading) {
    stopDataRouteFeedback();
    clearSeedArea();
  }
});

function scrollToExplore() {
  const el = exploreSection.value?.$el ?? exploreSection.value;
  if (!el) return;
  const top = el.getBoundingClientRect().top + window.scrollY - productScrollMarginTop.value;
  window.scrollTo({ top, behavior: "smooth" });
}

function normalizeAssetUrl(url) {
  if (!url || typeof url !== "string") return "";
  if (url.startsWith("http://web:8070")) return url.replace("http://web:8070", baseUrl);
  return url;
}

function findAreaImageUrl(areaValue) {
  const candidates = [
    areaValue?.teaser_image_url,
    areaValue?.teaserImageUrl,
    areaValue?.teaser_image,
    areaValue?.teaserImage,
    areaValue?.cover_image_url,
    areaValue?.coverImageUrl,
    areaValue?.image_url,
    areaValue?.imageUrl,
    areaValue?.thumbnail_url,
    areaValue?.thumbnailUrl,
    areaValue?.map_urls?.public_transport_data,
    areaValue?.map_urls?.cycleway_infrastructure_data,
    areaValue?.map_urls?.solar_power_data,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    if (typeof candidate === "string") return normalizeAssetUrl(candidate);
    if (typeof candidate === "object") {
      const nested = candidate.url ?? candidate.src ?? candidate.href ?? candidate.id;
      if (typeof nested === "string") return normalizeAssetUrl(nested);
    }
  }
  return "";
}

function findAreaImageAttribution(areaValue) {
  const candidates = [
    areaValue?.teaser_image,
    areaValue?.teaserImage,
    areaValue?.cover_image,
    areaValue?.coverImage,
    areaValue?.image,
  ];

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue;
    const attribution =
      candidate.attribution_key ?? candidate.attributionKey ?? candidate.attribution ?? candidate.credits;
    if (typeof attribution === "string" && attribution.trim()) return attribution.trim();
  }
  return "";
}

function scrollToAllProducts() {
  const el = document.getElementById("alle-datenprodukte");
  if (!el) return;
  const top = el.getBoundingClientRect().top + window.scrollY - productScrollMarginTop.value;
  window.history.pushState(null, "", "#alle-datenprodukte");
  window.scrollTo({ top, behavior: "smooth" });
}

function scrollToCollection(collectionId) {
  const el = document.getElementById(collectionId) ?? document.querySelector(`[data-collection-id="${collectionId}"]`);
  if (!el) return;
  const top = el.getBoundingClientRect().top + window.scrollY - productScrollMarginTop.value;
  window.history.pushState(null, "", `#${collectionId}`);
  window.scrollTo({ top, behavior: "smooth" });
}

function scrollToSector(key) {
  const el = document.getElementById(`sector-${key}`);
  if (!el) return;
  activeSectorKey.value = key;
  const top = el.getBoundingClientRect().top + window.scrollY - productScrollMarginTop.value;
  window.history.pushState(null, "", `#sector-${key}`);
  window.scrollTo({ top, behavior: "smooth" });
}

function initProductSectionObserver() {
  removeProductSectionListeners?.();
  removeProductSectionListeners = null;
  if (typeof window === "undefined") return;

  updateActiveSectorFromScroll();
  window.addEventListener("scroll", scheduleActiveSectorUpdate, { passive: true });
  window.addEventListener("resize", scheduleActiveSectorUpdate, { passive: true });
  removeProductSectionListeners = () => {
    window.removeEventListener("scroll", scheduleActiveSectorUpdate);
    window.removeEventListener("resize", scheduleActiveSectorUpdate);
    if (productSectionScrollFrame) window.cancelAnimationFrame(productSectionScrollFrame);
    productSectionScrollFrame = null;
  };
}

function scheduleActiveSectorUpdate() {
  if (productSectionScrollFrame) return;
  productSectionScrollFrame = window.requestAnimationFrame(() => {
    productSectionScrollFrame = null;
    updateActiveSectorFromScroll();
  });
}

function updateActiveSectorFromScroll() {
  const headings = Array.from(document.querySelectorAll("[data-sector-heading-key]"));
  if (!headings.length) return;

  const activationY = window.scrollY + productScrollMarginTop.value + 8;
  let active = headings[0]?.getAttribute("data-sector-heading-key") ?? "";

  for (const heading of headings) {
    const top = heading.getBoundingClientRect().top + window.scrollY;
    if (top <= activationY) {
      active = heading.getAttribute("data-sector-heading-key") ?? active;
    } else {
      break;
    }
  }

  if (active) activeSectorKey.value = active;
}

onMounted(() => {
  watch(
    collections,
    async () => {
      await nextTick();
      initProductSectionObserver();
    },
    { immediate: true },
  );
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function levelLabel(level) {
  const map = {
    1: "Bundesrepublik",
    2: "Bundesland",
    3: "Regierungsbezirk",
    4: "Kreis / Kreisfreie Stadt",
    5: "Verbandsgemeinde",
    6: "Gemeinde",
  };
  return map[level] ?? `Ebene ${level}`;
}

function isReasonableArea(areaValue) {
  return (areaValue?.is_reasonable_for_municipal_rating ?? areaValue?.isReasonableForMunicipalRating ?? true) === true;
}

// ── SEO ──────────────────────────────────────────────────────────────────────

useHead({
  title: computed(() => (area.value?.name ? `${area.value.prefix} ${area.value.name} – Klimadaten` : "Klimadaten")),
  meta: [
    {
      name: "description",
      content: computed(() =>
        area.value?.name
          ? `Klimadaten und Maßnahmen-Bewertungen für ${area.value.prefix} ${area.value.name}.`
          : "Klimadaten für Kommunen und Regionen in Deutschland.",
      ),
    },
  ],
});
</script>

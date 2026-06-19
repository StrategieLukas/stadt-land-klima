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
            v-if="!isAreaLoading && area?.geo_center"
            :lat="area.geo_center.coordinates?.[1] ?? area.geo_center[1]"
            :lon="area.geo_center.coordinates?.[0] ?? area.geo_center[0]"
            :size="30"
          />
        </div>
        <ol class="flex min-w-0 flex-1 flex-wrap items-center gap-1 text-xs">
          <template v-if="isAreaLoading">
            <li class="text-gray-500 font-semibold">Klimadaten werden geladen...</li>
          </template>
          <template v-else>
            <template v-if="area?.level > 1">
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
                :label="`${area?.prefix} ${area?.name}`.trim()"
                is-current
                :sibling-level="area?.level === 1 ? null : area?.level"
                :ars-prefix="area?.level === 4 ? area?.ars?.slice(0, 2) : ''"
                :current-ars="area?.ars"
              />
            </li>
          </template>
        </ol>
        <a
          v-if="!isAreaLoading && collections.length"
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
    <section
      v-if="isAreaLoading"
      class="text-gray-500 flex min-h-[52vh] flex-col items-center justify-center gap-3 py-16 text-sm"
    >
      <span class="loading loading-spinner loading-md text-[#006e94]" />
      <span>Klimadaten werden geladen...</span>
    </section>

    <!-- ── Overview layout (Germany / non-rateable Bundesland) ───────────── -->
    <template v-else-if="usesOverviewLayout">
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
          class="border-gray-200 relative overflow-hidden rounded-lg border p-5 shadow-sm xl:col-span-5"
          :class="heroBackgroundImage ? 'bg-gray-900' : 'bg-white'"
          :style="heroBackgroundStyle"
        >
          <div v-if="heroBackgroundImage" class="absolute inset-0 bg-black/45 backdrop-blur-[1px]" />
          <div class="relative">
            <p
              class="mb-2 text-xs font-bold uppercase tracking-widest"
              :class="heroBackgroundImage ? 'text-white/80' : 'text-[#006e94]'"
            >
              {{ area?.prefix }}
            </p>
            <h1
              class="mb-4 text-5xl font-black leading-none xl:text-6xl"
              :class="heroBackgroundImage ? 'text-white' : 'text-gray-900'"
            >
              {{ area?.name }}
            </h1>

            <dl class="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <div v-if="area?.population">
                <dt class="mb-0.5 text-xs" :class="heroBackgroundImage ? 'text-white/70' : 'text-gray-500'">
                  Einwohner
                </dt>
                <dd
                  class="text-2xl font-black tabular-nums"
                  :class="heroBackgroundImage ? 'text-white' : 'text-gray-900'"
                >
                  {{ area.population?.toLocaleString("de-DE") }}
                </dd>
              </div>
              <div v-if="area?.level">
                <dt class="mb-0.5 text-xs" :class="heroBackgroundImage ? 'text-white/70' : 'text-gray-500'">
                  Verwaltungsebene
                </dt>
                <dd class="text-2xl font-black" :class="heroBackgroundImage ? 'text-white' : 'text-gray-900'">
                  {{ levelLabel(area.level) }}
                </dd>
              </div>
              <div v-if="area?.ars">
                <dt class="mb-0.5 text-xs" :class="heroBackgroundImage ? 'text-white/70' : 'text-gray-500'">ARS</dt>
                <dd
                  class="text-2xl font-black tabular-nums"
                  :class="heroBackgroundImage ? 'text-white' : 'text-gray-900'"
                >
                  {{ area.ars }}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        <div class="xl:col-span-7">
          <DataAreaHeroMap :area="area" :nearby-areas="nearbyAreas" />
        </div>
      </section>

      <!-- ── Data product overview + scroll sections ──────────────────────── -->
      <section
        id="klimadaten"
        ref="exploreSection"
        class="py-2"
        :style="`scroll-margin-top: ${productScrollMarginTop}px`"
      >
        <div v-if="collectionsLoading" class="text-gray-400 flex items-center gap-2 py-10 text-sm">
          <SlkFlowerSpinner :size="20" />
          Datensätze werden geladen…
        </div>

        <template v-else-if="collections.length">
          <DataProductsOverviewGrid
            :collections="collections"
            :ars="area?.ars ?? ''"
            :base-url="baseUrl"
            :population="area?.population ?? null"
            :scroll-margin-top="productScrollMarginTop"
            @select="scrollToCollection"
          />

          <nav
            class="border-gray-100 sticky z-20 -mx-2 border-y bg-white/90 px-2 py-2 backdrop-blur-sm"
            :style="`top: ${sectorBarTop}px`"
          >
            <div class="flex min-w-0 items-center gap-3">
              <span class="text-gray-500 flex-none text-xs font-bold uppercase tracking-wide">Sektoren</span>
              <div class="no-scrollbar flex items-center gap-2 overflow-x-auto">
                <button
                  v-for="sector in productSectors"
                  :key="sector.key"
                  type="button"
                  class="flex-none rounded-full border px-3 py-1 text-xs font-semibold transition-colors"
                  :class="
                    sector.key === activeSectorKey
                      ? 'border-transparent text-white'
                      : 'border-gray-200 text-gray-500 bg-white hover:text-[#006e94]'
                  "
                  :style="sector.key === activeSectorKey ? { backgroundColor: sector.color } : undefined"
                  @click="scrollToSector(sector.key)"
                >
                  {{ sector.label }}
                </button>
              </div>
            </div>
          </nav>

          <div>
            <template v-for="group in groupedCollections" :key="group.key">
              <div
                :id="`sector-${group.key}`"
                class="border-gray-100 flex items-center gap-2 border-t pb-2 pt-8"
                :style="`scroll-margin-top: ${productScrollMarginTop}px`"
              >
                <span class="h-3 w-3 rounded-full" :style="{ backgroundColor: group.color }" />
                <h2 class="text-gray-900 text-xl font-black">{{ group.label }}</h2>
                <span class="text-gray-400 text-xs">{{ group.collections.length }} Datenprodukte</span>
              </div>
              <DataProductScrollSection
                v-for="col in group.collections"
                :key="col.id"
                :collection="col"
                :ars="area?.ars ?? ''"
                :base-url="baseUrl"
                :population="area?.population ?? null"
                :scroll-margin-top="productScrollMarginTop"
              />
            </template>
          </div>
        </template>

        <div v-else class="text-gray-400 py-10 text-center text-sm">Keine Klimadatensätze verfügbar.</div>
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
import { sectorColor, sectorKey, sectorLabel } from "~/utils/dataProducts";

definePageMeta({
  key: (route) => route.fullPath,
});

// ── Route + config ───────────────────────────────────────────────────────────

const route = useRoute();
const slug = computed(() => String(route.params.slug ?? ""));

const runtimeConfig = useRuntimeConfig();
const baseUrl = runtimeConfig.public.stadtlandzahlBaseUrl;

// ── Layout helpers ───────────────────────────────────────────────────────────

const headerHeight = useHeaderHeight();
const mobileHeaderHidden = useMobileHeaderHidden();
const isDesktop = useState("layout-isDesktop");

const pillTop = computed(() => (isDesktop.value ? headerHeight.value : mobileHeaderHidden.value ? 0 : 64));

onUnmounted(() => {
  productSectionObserver?.disconnect();
});

if (slug.value === "bundesrepublik-deutschland") {
  await navigateTo("/data", { redirectCode: 301 });
}

// ── Main data (SSR) ──────────────────────────────────────────────────────────

const pageDataKey = computed(() => `data-area-page-${slug.value}`);

const { data: pageData, pending: areaPending } = await useAsyncData(
  pageDataKey,
  async () => {
    const resolvedArea = await $fetch("/api/area-by-slug", {
      params: { slug: slug.value, includeGeo: true },
    });
    if (!resolvedArea) return { notFound: true };
    const ars = resolvedArea.ars;
    const [containedByChain, nearbyResult] = await Promise.all([
      fetchContainedBy(ars, resolvedArea.level).catch(() => []),
      $fetch("/api/area-nearby", {
        params: { ars, radius_km: 45, levels: "4,5,6", limit: 24 },
      }).catch(() => ({ areas: [] })),
    ]);

    const nearbyAreas = await Promise.all(
      (nearbyResult?.areas ?? []).slice(0, 24).map(async (nearbyArea) => {
        if (nearbyArea.geo_area ?? nearbyArea.geoArea) return nearbyArea;
        try {
          const nearbySlug = areaToSlug(nearbyArea.prefix ?? "", nearbyArea.name ?? "");
          const withGeo = await $fetch("/api/area-by-slug", {
            params: { slug: nearbySlug, includeGeo: true },
          });
          return withGeo ? { ...nearbyArea, ...withGeo } : nearbyArea;
        } catch {
          return nearbyArea;
        }
      }),
    );

    return { area: resolvedArea, containedBy: containedByChain ?? [], nearbyAreas };
  },
  { watch: [slug] },
);

if (!pageData.value || pageData.value.notFound) {
  throw createError({ statusCode: 404, statusMessage: "Gebiet nicht gefunden" });
}

const area = computed(() => pageData.value?.area ?? {});
const containedBy = computed(() => pageData.value?.containedBy ?? []);
const nearbyAreas = computed(() => pageData.value?.nearbyAreas ?? []);
const loadedAreaSlug = computed(() => {
  if (!area.value?.name) return "";
  return areaToSlug(area.value?.prefix ?? "", area.value.name);
});
const isAreaLoading = computed(() => areaPending.value || loadedAreaSlug.value !== slug.value);
const usesOverviewLayout = computed(
  () => !isAreaLoading.value && (area.value?.level ?? 99) <= 2 && !area.value?.is_reasonable_for_municipal_rating,
);

// ── Collections (CSR, area-injected) ────────────────────────────────────────

const collectionsDataKey = computed(() => `stadtlandzahl-collections-page-${slug.value}`);

const { data: collectionsData, pending: collectionsLoading } = await useAsyncData(
  collectionsDataKey,
  async () => {
    // Germany and non-rateable Bundesländer use AreaOverview — no collections rendered there.
    if (isAreaLoading.value || usesOverviewLayout.value) return [];

    // Try slim manifest first: much smaller (no vegalite_specs), CDN-cached
    // Cards degrade gracefully: KPI previews still show, map thumbnails are hidden until expanded
    try {
      const manifest = await $fetch(`${baseUrl}/api/manifests/collections-index`);
      const level = area.value?.level;
      const slim = (manifest?.collections ?? [])
        .filter((c) => c.id !== "administrative-areas")
        .filter((c) => !c.availableForLevels || c.availableForLevels.includes(level));
      if (slim.length > 0) return slim;
    } catch {
      /* manifest not deployed yet — fall through */
    }

    // Fall back to full area-specific API
    const params = area.value?.ars ? { area: area.value.ars } : {};
    return $fetch(`${baseUrl}/api/collections/`, { params })
      .then((d) => (d?.collections ?? []).filter((c) => c.id !== "administrative-areas"))
      .catch(() => []);
  },
  { server: false, watch: [area] },
);
const collections = computed(() => collectionsData.value ?? []);

// ── Product scroll navigation ────────────────────────────────────────────────

const exploreSection = ref(null);
const activeSectorKey = ref("");
let productSectionObserver = null;

const sectorBarTop = computed(() => pillTop.value + 46);
const productScrollMarginTop = computed(() => sectorBarTop.value + 58);

const groupedCollections = computed(() => {
  const groups = [];
  const byKey = new Map();
  for (const collection of collections.value) {
    const key = sectorKey(collection);
    if (!byKey.has(key)) {
      const group = {
        key,
        label: sectorLabel(collection),
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

const heroBackgroundImage = computed(() => findAreaImageUrl(area.value));
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
  const first = groupedCollections.value.find((group) => group.key === key)?.collections?.[0];
  if (!first) return;
  scrollToCollection(first.id);
}

function initProductSectionObserver() {
  productSectionObserver?.disconnect();
  productSectionObserver = null;
  if (typeof IntersectionObserver === "undefined") return;

  const sections = document.querySelectorAll("[data-collection-id][data-sector-key]");
  if (!sections.length) return;

  productSectionObserver = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => Math.abs(a.boundingClientRect.top) - Math.abs(b.boundingClientRect.top))[0];
      const key = visible?.target?.getAttribute("data-sector-key");
      if (key) activeSectorKey.value = key;
    },
    {
      rootMargin: `-${productScrollMarginTop.value}px 0px -55% 0px`,
      threshold: 0,
    },
  );

  sections.forEach((section) => productSectionObserver.observe(section));
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

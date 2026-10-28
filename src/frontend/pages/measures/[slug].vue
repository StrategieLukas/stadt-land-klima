<template>
  <div
    class="mx-auto w-full max-w-5xl min-w-0 px-4 py-4 sm:px-6 sm:py-8 lg:px-8"
    :style="`--section-scroll-mt: ${headerHeight + 16}px`"
  >
    <!-- Back link with chevron + sibling navigation -->
    <div class="flex flex-wrap items-center gap-2">
      <NuxtLink :to="measureIndexLocation" class="inline-flex items-center gap-1 font-heading text-h4 text-light-blue">
        <svg class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        {{
          detailSector
            ? $t("measure.back_label", { ":sector": $translateDynamic(`measure_sectors.${detailSector}.title`) })
            : $t("measures.back_label")
        }}
      </NuxtLink>

      <div v-if="prevMeasure || nextMeasure" class="ml-2 flex items-center gap-1">
        <NuxtLink
          v-if="prevMeasure"
          :to="measureDetailLocation(prevMeasure.slug)"
          class="inline-flex items-center gap-1 rounded-sm border border-gray/30 px-2 py-0.5 text-xs text-gray transition-colors hover:bg-gray/5"
          :title="`← ${prevMeasure.measure_id}: ${prevMeasure.name}`"
        >
          <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          {{ prevMeasure.measure_id }}
        </NuxtLink>
        <span class="text-xs text-gray/40">{{ siblingIndex + 1 }} / {{ siblingMeasures.length }}</span>
        <NuxtLink
          v-if="nextMeasure"
          :to="measureDetailLocation(nextMeasure.slug)"
          class="inline-flex items-center gap-1 rounded-sm border border-gray/30 px-2 py-0.5 text-xs text-gray transition-colors hover:bg-gray/5"
          :title="`${nextMeasure.measure_id}: ${nextMeasure.name} →`"
        >
          {{ nextMeasure.measure_id }}
          <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </NuxtLink>
      </div>
    </div>

    <!-- Version switcher (only if this measure exists in multiple catalog versions) -->
    <div
      v-if="measureVersions && measureVersions.length > 1"
      class="slk-filter-theme-neutral mt-3 flex flex-wrap items-center gap-2"
    >
      <span class="text-xs text-gray-500">{{ $t("measure.version_label") }}</span>
      <NuxtLink
        v-for="mv in measureVersions"
        :key="mv.catalog_version.id"
        :to="measureDetailLocation(slug!, mv.catalog_version.name)"
        class="slk-filter-pill px-2.5 py-1 transition"
        :class="currentCatalogVersion.id === mv.catalog_version.id ? 'slk-filter-pill--active' : ''"
      >
        {{ mv.catalog_version.name }}
      </NuxtLink>
    </div>

    <!-- Mobile section pills – sticky bar matching events/news page design -->
    <nav
      v-if="measure && navItems.length"
      class="sticky z-10 -mx-4 mt-4 mb-4 border-b border-gray-100 bg-white/90 px-4 backdrop-blur-xs xl:hidden"
      :style="`top: ${pillTop}px`"
    >
      <div
        ref="mobilePillStrip"
        class="flex gap-2 overflow-x-auto py-2"
        style="scrollbar-width: none; -ms-overflow-style: none"
      >
        <a
          v-for="item in navItems"
          :key="item.id"
          :href="`#${item.id}`"
          :class="[
            'shrink-0 rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors',
            activeSection === item.id
              ? 'bg-[#006e94]/10 font-semibold text-[#006e94]'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200',
          ]"
          >{{ item.label }}</a
        >
      </div>
    </nav>

    <!-- Two-column layout: sticky sidebar (xl) + main content -->
    <div class="mt-6 xl:flex xl:items-start xl:gap-8">
      <!-- Sticky sidebar (desktop only) -->
      <nav
        v-if="measure && navItems.length"
        class="sticky hidden w-44 shrink-0 self-start text-sm xl:block"
        :style="`top: ${headerHeight + 12}px`"
      >
        <p class="mb-3 text-xs font-bold tracking-widest text-gray-400 uppercase">{{ $t("measure.sections.title") }}</p>
        <ul class="space-y-1">
          <li v-for="item in navItems" :key="item.id">
            <a
              :href="`#${item.id}`"
              :class="[
                'block truncate rounded-sm px-2 py-1 transition-colors',
                activeSection === item.id
                  ? 'bg-[#006e94]/5 font-semibold text-[#006e94]'
                  : 'text-gray-400 hover:bg-gray-50 hover:text-gray-700',
              ]"
              >{{ item.label }}</a
            >
          </li>
        </ul>
      </nav>

      <!-- Main content -->
      <div class="min-w-0 flex-1">
        <article v-if="measure" class="mb-8">
          <div class="mb-4 flex flex-wrap items-center gap-3">
            <span class="shrink-0 rounded-lg bg-gray px-2 py-1 font-mono text-base-100">{{ measure.measure_id }}</span>
            <h1 class="font-heading text-h1 font-bold text-gray">{{ measure.name }}</h1>
          </div>

          <div v-if="measureImageId" class="mb-2 overflow-hidden rounded-xl">
            <img
              :src="`${directusUrl}/assets/${encodeURIComponent(measureImageId)}?width=900&quality=80`"
              :alt="measure.name"
              class="block h-auto w-full"
            />
          </div>
          <p v-if="measureImageCredits" class="mb-6 text-center text-xs text-gray-500 italic">
            {{ measureImageCredits }}
          </p>

          <div>
            <StaticMeasureDetails :measure="measure" />
            <MeasureDescriptions
              v-if="hasDescriptions"
              id="section-descriptions"
              :measure="measure"
              :style="{ scrollMarginTop: headerHeight + 16 + 'px' }"
            />
            <MeasureRatingChart
              v-if="measureRatings"
              id="section-ratings"
              :style="{ scrollMarginTop: headerHeight + 16 + 'px' }"
              :ratings="measureRatings"
              :measure-id-str="measure.measure_id"
              :catalog-version-name="currentCatalogVersion.name"
            />
          </div>
        </article>

        <!-- Loading skeleton while measure is being fetched -->
        <div v-else class="mb-8 animate-pulse space-y-4">
          <div class="flex items-center gap-3">
            <div class="h-8 w-16 rounded-lg bg-gray-200"></div>
            <div class="h-8 w-64 rounded-sm bg-gray-200"></div>
          </div>
          <div class="h-4 w-full rounded-sm bg-gray-100"></div>
          <div class="h-4 w-5/6 rounded-sm bg-gray-100"></div>
          <div class="h-4 w-4/6 rounded-sm bg-gray-100"></div>
        </div>

        <!-- Feedback section -->
        <div class="border-t-2 border-light-blue py-6">
          <div class="flex items-start gap-3">
            <img
              src="~/assets/icons/icon_hint.svg"
              alt=""
              class="slk-theme-icon--light mt-0.5 h-6 w-6 shrink-0 opacity-50"
            />
            <img
              src="~/assets/icons/icon_hint-dark.svg"
              alt=""
              class="slk-theme-icon--dark mt-0.5 h-6 w-6 shrink-0 opacity-50"
            />
            <div>
              <h2 class="mb-4 font-heading text-h3 font-bold text-gray">{{ $t("measure.feedback.title") }}</h2>
              <p class="mb-3 text-sm text-gray-500">{{ $t("measure.feedback.description") }}</p>
              <NuxtLink
                :to="feedbackLocation"
                class="inline-flex items-center gap-2 rounded-sm bg-light-blue px-4 py-2 text-sm font-bold text-white transition hover:brightness-110"
              >
                {{ $t("feedback.give_external") }}
              </NuxtLink>
            </div>
          </div>
        </div>

        <!-- Rating statistics Sankey -->
        <div id="section-history" :style="{ scrollMarginTop: headerHeight + 16 + 'px' }">
          <ClientOnly>
            <MeasureRatingSankey v-if="measure?.id" :measure-slug="slug!" :measure-versions="measureVersions || []" />
          </ClientOnly>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { useHeaderHeight } from "~/composables/useHeaderHeight";
import { useMobileHeaderHidden } from "~/composables/useMobileHeaderHidden";
import { routeSlug } from "~/shared/routeValues";
const fetchContent = useContentFetch();

const { $t, $translateDynamic } = useNuxtApp();
const route = useRoute();
const slug = routeSlug(route.params.slug);
if (!slug) throw createError({ statusCode: 404, statusMessage: "Measure not found" });
const router = useRouter();
const config = useRuntimeConfig();
const directusUrl = config.public.clientDirectusUrl;
const detailSector = computed(() => {
  return typeof route.query.sector === "string" && route.query.sector
    ? route.query.sector
    : (measure.value?.sector ?? null);
});
const measureIndexLocation = computed(() => ({
  path: "/measures",
  query: {
    v: currentCatalogVersion.value.name,
    ...(detailSector.value ? { sector: detailSector.value } : {}),
  },
}));
function measureDetailLocation(slug: string, versionName = currentCatalogVersion.value.name) {
  return {
    path: `/measures/${slug}`,
    query: {
      v: versionName,
      ...(detailSector.value ? { sector: detailSector.value } : {}),
    },
  };
}
const headerHeight = useHeaderHeight();
const mobileHeaderHidden = useMobileHeaderHidden();
const isDesktop = useState("layout-isDesktop");
const pillTop = computed(() => (isDesktop.value ? headerHeight.value : mobileHeaderHidden.value ? 0 : 64));
const mobilePillStrip = ref<HTMLElement | null>(null);
let sectionObserver: IntersectionObserver | null = null;

// Use a ref so the reactive key below re-fetches automatically when the version changes.
const currentCatalogVersion = ref(await getCatalogVersion(route, false));

onMounted(() => {
  void setCatalogVersionUrl(route, router, currentCatalogVersion.value);
  window.addEventListener("keydown", handleArrowKey);
  setTimeout(initSectionObserver, 100);
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleArrowKey);
  sectionObserver?.disconnect();
});

// Function key includes the version ID, so Nuxt never serves stale data from a different
// version. The watch option triggers an automatic re-fetch when currentCatalogVersion changes.
const { data: measureData } = await useAsyncData(
  () => `measure-${slug}-${currentCatalogVersion.value.id}`,
  () =>
    fetchContent(`/api/public/measures/${encodeURIComponent(slug!)}`, {
      query: { v: currentCatalogVersion.value.name },
    }),
);
const measure = computed(() => measureData.value?.measure ?? null);
const measureVersions = computed(() => measureData.value?.versions ?? []);
const measureImageId = computed(() => {
  const image = measure.value?.image;
  return image ?? null;
});
const measureImageCredits = computed(() => {
  return measure.value?.image_credits || "" || "";
});

// Sections present on this measure (drives sidebar / pills nav)
const hasDescriptions = computed(() => {
  if (!measure.value) return false;
  const currentMeasure = measure.value;
  return [
    "description_benefit",
    "description_verification",
    "description_contribution",
    "description_implementation",
    "description_legal",
    "description_funding",
    "description_tutorial",
  ].some((k) => currentMeasure[k as keyof typeof currentMeasure]);
});
const feedbackLocation = computed(() => {
  const measureTitle = measure.value ? `${measure.value.measure_id}: ${measure.value.name}` : "";
  const measureLink = `/measures/${slug}?v=${currentCatalogVersion.value.name}`;

  return {
    path: "/contact",
    query: {
      title: measureTitle,
      type: "suggestion",
      content: $t("measure.feedback.prefill_content", {
        ":measure": measureTitle,
        ":link": measureLink,
      }),
    },
  };
});

const navItems = computed(() => {
  if (!measure.value) return [];
  return [
    { id: "section-about", label: $t("measure.sections.overview") },
    measure.value.description_evaluation_criteria
      ? { id: "section-criteria", label: $t("measure.evaluation_criteria_heading") }
      : null,
    { id: "section-feasibility", label: $t("measure.feasibility_heading") },
    hasDescriptions.value ? { id: "section-descriptions", label: $t("measure.sections.descriptions") } : null,
    { id: "section-ratings", label: $t("measure.sections.ratings") },
    { id: "section-history", label: $t("measure_rating.history.title") },
  ].filter((item): item is NonNullable<typeof item> => item !== null);
});

const activeSection = ref<string | null>(null);

watch(activeSection, (id) => {
  if (!id || !mobilePillStrip.value) return;
  const pill = mobilePillStrip.value.querySelector(`[href="#${id}"]`);
  if (pill) pill.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
});

function initSectionObserver() {
  if (sectionObserver) {
    sectionObserver.disconnect();
    sectionObserver = null;
  }
  const sections = document.querySelectorAll('[id^="section-"]');
  if (!sections.length) return;
  sectionObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          activeSection.value = entry.target.id;
        }
      }
    },
    { rootMargin: "-20% 0px -70% 0px", threshold: 0 },
  );
  sections.forEach((s) => sectionObserver?.observe(s));
}

watch(navItems, () => {
  if (import.meta.client) setTimeout(initSectionObserver, 100);
});

// Fetch ratings for the current measure (for the rating bar chart)
const { data: measureRatings } = await useAsyncData(
  () => `measure-ratings-${measure.value?.id ?? "none"}`,
  () => {
    if (!measure.value?.id) return Promise.resolve([]);
    return fetchContent("/api/public/measure-ratings", { query: { measureId: measure.value.id } }).then(
      (result) => result.ratings,
    );
  },
  { watch: [measure] },
);

// Fetch all measures in the same sector + version for prev/next navigation
const { data: siblingMeasuresRaw } = await useAsyncData(
  () => `measure-siblings-${slug}-${currentCatalogVersion.value.id}`,
  async () => {
    const result = await fetchContent("/api/public/measures", {
      query: { v: currentCatalogVersion.value.name, sector: measure.value?.sector ?? undefined },
    });
    return result;
  },
  { watch: [currentCatalogVersion, measure] },
);

const siblingMeasures = computed(() => siblingMeasuresRaw.value?.measures ?? []);
const siblingIndex = computed(() => siblingMeasures.value.findIndex((m) => m.slug === route.params.slug));
const prevMeasure = computed(() => (siblingIndex.value > 0 ? siblingMeasures.value[siblingIndex.value - 1] : null));
const nextMeasure = computed(() =>
  siblingIndex.value < siblingMeasures.value.length - 1 ? siblingMeasures.value[siblingIndex.value + 1] : null,
);
function handleArrowKey(e: KeyboardEvent) {
  if (e.key === "ArrowLeft" && prevMeasure.value) {
    e.preventDefault();
    void router.push(measureDetailLocation(prevMeasure.value.slug));
  } else if (e.key === "ArrowRight" && nextMeasure.value) {
    e.preventDefault();
    void router.push(measureDetailLocation(nextMeasure.value.slug));
  }
}

// When the URL version param changes (e.g. version switcher or setCatalogVersionUrl redirect),
// get the new version object. Updating the ref automatically re-triggers useAsyncData above.
watch(
  () => route.query.v,
  async (newV, oldV) => {
    if (newV === oldV) return;
    const newVersion = await getCatalogVersion(route, true);
    currentCatalogVersion.value = newVersion;
  },
);

//MetaTags
const title = computed(() => measure.value?.name);
usePageSeo({
  title,
  description: () => measure.value?.description || measure.value?.description_about,
  image: () => measure.value?.image,
});
</script>

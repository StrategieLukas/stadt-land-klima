<template>
  <div class="px-4 sm:px-6 lg:px-8 py-4 sm:py-8 max-w-5xl mx-auto w-full min-w-0" :style="`--section-scroll-mt: ${headerHeight + 16}px`">

    <!-- Back link with chevron + sibling navigation -->
    <div class="flex items-center gap-2 flex-wrap">
      <NuxtLink :to="`/measures?sector=${measure?.sector}&v=${currentCatalogVersion.name}`" class="inline-flex items-center gap-1 font-heading text-h4 text-light-blue">
        <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        {{ measure?.sector ? $t("measure.back_label", { ":sector": $t(`measure_sectors.${measure.sector}.title`) }) : '← Zurück zu Maßnahmen' }}
      </NuxtLink>

      <div v-if="prevMeasure || nextMeasure" class="flex items-center gap-1 ml-2">
        <NuxtLink
          v-if="prevMeasure"
          :to="`/measures/${prevMeasure.slug}?v=${currentCatalogVersion.name}&sector=${prevMeasure.sector}`"
          class="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-gray/30 text-xs text-gray hover:bg-gray/5 transition-colors"
          :title="`← ${prevMeasure.measure_id}: ${prevMeasure.name}`"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
          {{ prevMeasure.measure_id }}
        </NuxtLink>
        <span class="text-xs text-gray/40">{{ siblingIndex + 1 }} / {{ siblingMeasures.length }}</span>
        <NuxtLink
          v-if="nextMeasure"
          :to="`/measures/${nextMeasure.slug}?v=${currentCatalogVersion.name}&sector=${nextMeasure.sector}`"
          class="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-gray/30 text-xs text-gray hover:bg-gray/5 transition-colors"
          :title="`${nextMeasure.measure_id}: ${nextMeasure.name} →`"
        >
          {{ nextMeasure.measure_id }}
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
        </NuxtLink>
      </div>
    </div>

    <!-- Version switcher (only if this measure exists in multiple catalog versions) -->
    <div v-if="measureVersions && measureVersions.length > 1" class="mt-3 flex items-center gap-2 flex-wrap">
      <span class="text-xs text-gray-500">Version:</span>
      <NuxtLink
        v-for="mv in measureVersions"
        :key="mv.catalog_version.id"
        :to="`/measures/${route.params.slug}?v=${mv.catalog_version.name}`"
        class="inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-bold transition"
        :class="currentCatalogVersion.id === mv.catalog_version.id
          ? 'bg-gray text-white border-gray'
          : 'bg-white text-gray border-gray hover:bg-[#f2f2f2]'"
      >
        {{ mv.catalog_version.name }}
      </NuxtLink>
    </div>

    <!-- Mobile section pills – sticky bar matching events/news page design -->
    <nav
      v-if="measure && navItems.length"
      class="xl:hidden sticky z-10 bg-white/90 backdrop-blur-sm border-b border-gray-100 -mx-4 px-4 mb-4 mt-4"
      :style="`top: ${pillTop}px`"
    >
      <div ref="mobilePillStrip" class="flex gap-2 overflow-x-auto py-2" style="scrollbar-width: none; -ms-overflow-style: none;">
        <a
          v-for="item in navItems"
          :key="item.id"
          :href="`#${item.id}`"
          :class="[
            'flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap',
            activeSection === item.id
              ? 'bg-[#006e94]/10 text-[#006e94] font-semibold'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200',
          ]"
        >{{ item.label }}</a>
      </div>
    </nav>

    <!-- Two-column layout: sticky sidebar (xl) + main content -->
    <div class="xl:flex xl:gap-8 xl:items-start mt-6">

      <!-- Sticky sidebar (desktop only) -->
      <nav
        v-if="measure && navItems.length"
        class="hidden xl:block w-44 flex-shrink-0 sticky text-sm self-start"
        :style="`top: ${headerHeight + 12}px`"
      >
        <p class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Abschnitte</p>
        <ul class="space-y-1">
          <li v-for="item in navItems" :key="item.id">
            <a
              :href="`#${item.id}`"
              :class="[
                'block px-2 py-1 rounded transition-colors truncate',
                activeSection === item.id
                  ? 'text-[#006e94] font-semibold bg-[#006e94]/5'
                  : 'text-gray-400 hover:text-gray-700 hover:bg-gray-50',
              ]"
            >{{ item.label }}</a>
          </li>
        </ul>
      </nav>

      <!-- Main content -->
      <div class="flex-1 min-w-0">

        <article v-if="measure" class="mb-8">
          <div class="flex items-center gap-3 mb-4 flex-wrap">
            <span class="font-mono bg-gray text-base-100 px-2 py-1 rounded-lg flex-shrink-0">{{ measure.measure_id }}</span>
            <h1 class="font-heading text-h1 font-bold text-gray">{{ measure.name }}</h1>
          </div>

          <div v-if="measure.image" class="mb-2 rounded-xl overflow-hidden">
            <img
              :src="`${directusUrl}/assets/${measure.image}?width=900&quality=80`"
              :alt="measure.name"
              class="w-full h-auto block"
            />
          </div>
          <p v-if="measure.image_credits" class="text-xs text-gray-500 italic mb-6 text-center">{{ measure.image_credits }}</p>

          <div>
            <StaticMeasureDetails :measure="measure" />
            <MeasureDescriptions
              v-if="hasDescriptions"
              :measure="measure"
              id="section-descriptions"
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
            <div class="h-8 w-16 bg-gray-200 rounded-lg"></div>
            <div class="h-8 w-64 bg-gray-200 rounded"></div>
          </div>
          <div class="h-4 w-full bg-gray-100 rounded"></div>
          <div class="h-4 w-5/6 bg-gray-100 rounded"></div>
          <div class="h-4 w-4/6 bg-gray-100 rounded"></div>
        </div>

        <!-- Feedback section -->
        <div class="border-t-2 border-light-blue py-6">
          <div class="flex items-start gap-3">
            <img src="~/assets/icons/icon_hint.svg" alt="" class="w-6 h-6 opacity-50 flex-shrink-0 mt-0.5" />
            <div>
              <h2 class="font-heading text-h3 font-bold text-gray mb-4">Haben Sie einen Hinweis zu dieser Maßnahme?</h2>
              <p class="text-sm text-gray-500 mb-3">Fehler, Ungenauigkeiten oder Verbesserungsvorschläge – teilen Sie uns Ihr Feedback mit.</p>
              <NuxtLink
                :to="`/contact?title=${encodeURIComponent(measure?.measure_id + ': ' + measure?.name)}&type=suggestion&content=${encodeURIComponent('Maßnahme: ' + measure?.measure_id + '\nLink: /measures/' + route.params.slug + '?v=' + currentCatalogVersion.name + '\n\nMein Hinweis:\n')}`"
                class="inline-flex items-center gap-2 px-4 py-2 rounded text-sm font-bold bg-light-blue text-white hover:brightness-110 transition"
              >
                Feedback geben ↗
              </NuxtLink>
            </div>
          </div>
        </div>

        <!-- Rating statistics Sankey -->
        <div id="section-history" :style="{ scrollMarginTop: headerHeight + 16 + 'px' }">
          <ClientOnly>
            <MeasureRatingSankey
              v-if="measure?.id"
              :measure-slug="route.params.slug"
              :measure-versions="measureVersions || []"
            />
          </ClientOnly>
        </div>

      </div>
    </div>

  </div>
</template>
<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useHeaderHeight } from '~/composables/useHeaderHeight.js';
import { useMobileHeaderHidden } from '~/composables/useMobileHeaderHidden.js';
const { $directus, $readItems, $t } = useNuxtApp();
const route = useRoute();
const router = useRouter();
const config = useRuntimeConfig();
const directusUrl = config.public.clientDirectusUrl;
const headerHeight = useHeaderHeight();
const mobileHeaderHidden = useMobileHeaderHidden();
const isDesktop = useState('layout-isDesktop');
const pillTop = computed(() => isDesktop.value ? headerHeight.value : (mobileHeaderHidden.value ? 0 : 64));
const mobilePillStrip = ref(null);

// Use a ref so the reactive key below re-fetches automatically when the version changes.
const currentCatalogVersion = ref(await getCatalogVersion($directus, $readItems, route, false));

onMounted(() => {
  setCatalogVersionUrl(route, router, currentCatalogVersion.value);
  window.addEventListener('keydown', handleArrowKey);
  setTimeout(initSectionObserver, 100);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleArrowKey);
  sectionObserver?.disconnect();
});

// Function key includes the version ID, so Nuxt never serves stale data from a different
// version. The watch option triggers an automatic re-fetch when currentCatalogVersion changes.
const { data: measuresRaw } = await useAsyncData(
  () => `measure-${route.params.slug}-${currentCatalogVersion.value.id}`,
  () => $directus.request(
    $readItems("measures", {
      filter: {
        slug: { _eq: route.params.slug },
        catalog_version: { _eq: currentCatalogVersion.value.id },
      },
      limit: 1,
    }),
  ),
  { watch: [currentCatalogVersion] },
);

// Fetch all catalog versions this measure appears in (for version switcher)
const { data: measureVersions } = await useAsyncData(`measure-versions-${route.params.slug}`, () => {
  return $directus.request(
    $readItems("measures", {
      fields: [{ catalog_version: ["id", "name"] }],
      filter: { slug: { _eq: route.params.slug } },
      limit: -1,
    }),
  );
});

const measure = computed(() => measuresRaw.value?.[0] || null);

// Sections present on this measure (drives sidebar / pills nav)
const hasDescriptions = computed(() => {
  if (!measure.value) return false;
  return ['description_benefit', 'description_verification', 'description_contribution',
    'description_implementation', 'description_legal', 'description_funding', 'description_tutorial',
  ].some(k => measure.value[k]);
});

const navItems = computed(() => {
  if (!measure.value) return [];
  return [
    { id: 'section-about',        label: 'Überblick' },
    measure.value.description_evaluation_criteria
      ? { id: 'section-criteria',     label: 'Kriterien' } : null,
    { id: 'section-feasibility',  label: 'Umsetzbarkeit' },
    hasDescriptions.value
      ? { id: 'section-descriptions', label: 'Beschreibungen' } : null,
    { id: 'section-ratings',      label: 'Bewertungen' },
    { id: 'section-history',      label: 'Verlauf' },
  ].filter(Boolean);
});

const activeSection = ref(null);
let sectionObserver = null;

watch(activeSection, (id) => {
  if (!id || !mobilePillStrip.value) return;
  const pill = mobilePillStrip.value.querySelector(`[href="#${id}"]`);
  if (pill) pill.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
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
    { rootMargin: '-20% 0px -70% 0px', threshold: 0 },
  );
  sections.forEach(s => sectionObserver.observe(s));
}

watch(navItems, () => {
  if (import.meta.client) setTimeout(initSectionObserver, 100);
});

// Fetch ratings for the current measure (for the rating bar chart)
const { data: measureRatings } = await useAsyncData(
  () => `measure-ratings-${measure.value?.id ?? 'none'}`,
  () => {
    if (!measure.value?.id) return []
    return $directus.request(
      $readItems('ratings_measures', {
        fields: [
          'rating',
          'applicable',
          { localteam_id: ['municipality_name', { municipality_id: ['slug', 'status'] }] },
        ],
        filter: { measure_id: { _eq: measure.value.id } },
        limit: -1,
      })
    )
  },
  { watch: [measure] }
);

// Fetch all measures in the same sector + version for prev/next navigation
const { data: siblingMeasuresRaw } = await useAsyncData(
  () => `measure-siblings-${route.params.slug}-${currentCatalogVersion.value.id}`,
  () => $directus.request(
    $readItems('measures', {
      fields: ['id', 'slug', 'name', 'measure_id', 'sector'],
      filter: {
        catalog_version: { _eq: currentCatalogVersion.value.id },
        sector: { _eq: measure.value?.sector ?? '' },
      },
      sort: ['measure_id'],
      limit: -1,
    }),
  ),
  { watch: [currentCatalogVersion, measure] },
);

const siblingMeasures = computed(() => siblingMeasuresRaw.value ?? []);
const siblingIndex = computed(() => siblingMeasures.value.findIndex(m => m.slug === route.params.slug));
const prevMeasure = computed(() => siblingIndex.value > 0 ? siblingMeasures.value[siblingIndex.value - 1] : null);
const nextMeasure = computed(() => siblingIndex.value < siblingMeasures.value.length - 1 ? siblingMeasures.value[siblingIndex.value + 1] : null);
function handleArrowKey(e) {
  if (e.key === 'ArrowLeft' && prevMeasure.value) {
    e.preventDefault();
    router.push(`/measures/${prevMeasure.value.slug}?v=${currentCatalogVersion.value.name}&sector=${prevMeasure.value.sector}`);
  } else if (e.key === 'ArrowRight' && nextMeasure.value) {
    e.preventDefault();
    router.push(`/measures/${nextMeasure.value.slug}?v=${currentCatalogVersion.value.name}&sector=${nextMeasure.value.sector}`);
  }
}

// When the URL version param changes (e.g. version switcher or setCatalogVersionUrl redirect),
// get the new version object. Updating the ref automatically re-triggers useAsyncData above.
watch(
  () => route.query.v,
  async (newV, oldV) => {
    if (newV === oldV) return;
    const newVersion = await getCatalogVersion($directus, $readItems, route, true);
    currentCatalogVersion.value = newVersion;
  }
);

//MetaTags
const title = computed(() => measure.value?.name);
useHead({
  title,
});
</script>

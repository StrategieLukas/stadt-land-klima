<template>
  <div class="px-4 sm:px-6 lg:px-8 py-4 sm:py-8 max-w-4xl mx-auto w-full min-w-0 overflow-hidden">
    <!-- Back link with chevron + sibling navigation -->
    <div class="flex items-center gap-2 flex-wrap">
      <NuxtLink :to="measureIndexLocation" class="inline-flex items-center gap-1 font-heading text-h4 text-light-blue">
        <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        {{ detailSector ? $t("measure.back_label", { ":sector": $t(`measure_sectors.${detailSector}.title`) }) : $t("measures.back_label") }}
      </NuxtLink>

      <div v-if="prevMeasure || nextMeasure" class="flex items-center gap-1 ml-2">
        <NuxtLink
          v-if="prevMeasure"
          :to="measureDetailLocation(prevMeasure.slug, currentCatalogVersion.name)"
          class="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-gray/30 text-xs text-gray hover:bg-gray/5 transition-colors"
          :title="`← ${prevMeasure.measure_id}: ${prevMeasure.name}`"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
          {{ prevMeasure.measure_id }}
        </NuxtLink>
        <span class="text-xs text-gray/40">{{ siblingIndex + 1 }} / {{ siblingMeasures.length }}</span>
        <NuxtLink
          v-if="nextMeasure"
          :to="measureDetailLocation(nextMeasure.slug, currentCatalogVersion.name)"
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
      <span class="text-xs text-gray-500">{{ $t("measure.version_label") }}</span>
      <NuxtLink
        v-for="mv in measureVersions"
        :key="mv.catalog_version.id"
        :to="measureDetailLocation(route.params.slug, mv.catalog_version.name)"
        class="inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-bold transition"
        :class="currentCatalogVersion.id === mv.catalog_version.id
          ? 'bg-gray text-white border-gray'
          : 'bg-white text-gray border-gray hover:bg-[#f2f2f2]'"
      >
        {{ mv.catalog_version.name }}
      </NuxtLink>
    </div>

    <article v-if="measure" class="mb-8 mt-6 overflow-hidden rounded-lg bg-white shadow-sm">
      <header class="relative isolate overflow-hidden p-4 sm:p-6" :class="measureBackdropUrl ? 'min-h-72' : ''">
        <div
          v-if="measureBackdropUrl"
          class="pointer-events-none absolute inset-0 -z-10 bg-cover bg-center"
          :style="{ backgroundImage: `url(${measureBackdropUrl})` }"
          aria-hidden="true"
        />
        <div
          v-if="measureBackdropUrl"
          class="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-r from-white/95 via-white/88 to-white/55"
          aria-hidden="true"
        />
        <p
          v-if="measureBackdropUrl && measureImageCredits"
          class="absolute bottom-3 right-3 max-w-[min(22rem,calc(100%-1.5rem))] rounded bg-white/85 px-2 py-1 text-right text-[11px] italic text-gray-500 shadow-sm"
        >
          {{ measureImageCredits }}
        </p>

        <div class="max-w-3xl">
          <div class="flex items-center gap-3 mb-4 flex-wrap">
            <span class="font-mono bg-gray text-base-100 px-2 py-1 rounded-lg flex-shrink-0">{{ measure.measure_id }}</span>
            <h1 class="font-heading text-h1 font-bold text-gray">{{ measure.name }}</h1>
          </div>

          <section v-if="measure.description_about" class="pt-2">
            <h2 class="mb-3 text-h3 font-bold text-black">
              {{ $t("measure.description_about_heading") }}
            </h2>
            <div class="mb-2 flex flex-row measure_ratings-start gap-4">
              <figure class="mt-0 flex shrink-0 flex-col">
                <img src="~/assets/icons/icon_info.svg" alt="" class="h-auto w-10 opacity-50" />
              </figure>
              <div class="has-long-links prose" v-html="sanitizeHtml(measure.description_about)" />
            </div>
          </section>
        </div>
      </header>

      <div class="divide-y-2 divide-light-blue bg-white p-4 sm:p-6">
        <StaticMeasureDetails :measure="measure" :hide-about="true" />
        <MeasureDescriptions :measure="measure" />
      </div>
    </article>

    <!-- Loading skeleton while measure is being fetched -->
    <div v-else class="mb-8 mt-6 animate-pulse space-y-4">
      <div class="flex items-center gap-3">
        <div class="h-8 w-16 bg-gray-200 rounded-lg"></div>
        <div class="h-8 w-64 bg-gray-200 rounded"></div>
      </div>
      <div class="h-4 w-full bg-gray-100 rounded"></div>
      <div class="h-4 w-5/6 bg-gray-100 rounded"></div>
      <div class="h-4 w-4/6 bg-gray-100 rounded"></div>
    </div>

    <!-- Feedback section -->
    <div class="border-t-4 border-gray-200 pt-6 pb-8">
      <div class="flex items-start gap-3">
        <img src="~/assets/icons/icon_hint.svg" alt="" class="w-6 h-6 opacity-50 flex-shrink-0 mt-0.5" />
        <div>
          <h3 class="font-heading font-bold text-gray mb-1">{{ $t("measure.feedback.title") }}</h3>
          <p class="text-sm text-gray-500 mb-3">{{ $t("measure.feedback.description") }}</p>
          <NuxtLink
            :to="feedbackLocation"
            class="inline-flex items-center gap-2 px-4 py-2 rounded text-sm font-bold bg-light-blue text-white hover:brightness-110 transition"
          >
            {{ $t("feedback.give_external") }}
          </NuxtLink>
        </div>
      </div>
    </div>

    <!-- Rating statistics Sankey -->
    <ClientOnly>
      <MeasureRatingSankey
        v-if="measure?.id"
        :measure-slug="route.params.slug"
        :measure-versions="measureVersions || []"
      />
    </ClientOnly>

  </div>
</template>
<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import sanitizeHtml from "sanitize-html";
const { $directus, $readItems, $t } = useNuxtApp();
const runtimeConfig = useRuntimeConfig();
const route = useRoute();
const router = useRouter();
const detailSector = computed(() => {
  return typeof route.query.sector === 'string' && route.query.sector ? route.query.sector : null;
});

// Use a ref so the reactive key below re-fetches automatically when the version changes.
const currentCatalogVersion = ref(await getCatalogVersion($directus, $readItems, route, false));

onMounted(() => {
  setCatalogVersionUrl(route, router, currentCatalogVersion.value);
  window.addEventListener('keydown', handleArrowKey);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleArrowKey);
});

// Function key includes the version ID, so Nuxt never serves stale data from a different
// version. The watch option triggers an automatic re-fetch when currentCatalogVersion changes.
const { data: measuresRaw } = await useAsyncData(
  () => `measure-${route.params.slug}-${currentCatalogVersion.value.id}`,
  () => $directus.request(
    $readItems("measures", {
      fields: [
        "*",
        { image: ["id", "image_credits"] },
      ],
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
const measureImageId = computed(() => {
  const image = measure.value?.image;
  return typeof image === 'string' ? image : image?.id || null;
});
const measureImageCredits = computed(() => {
  const image = measure.value?.image;
  return typeof image === 'object' && image ? image.image_credits || '' : '';
});
const measureBackdropUrl = computed(() => {
  if (!measureImageId.value) return '';
  const baseUrl = runtimeConfig.public.clientDirectusUrl || '';
  return `${baseUrl}/assets/${measureImageId.value}?width=1600&height=700&fit=cover&quality=70`;
});
const measureIndexLocation = computed(() => {
  return {
    path: '/measures',
    query: {
      v: currentCatalogVersion.value.name,
      ...(detailSector.value ? { sector: detailSector.value } : {}),
    },
  };
});
const feedbackLocation = computed(() => {
  const measureTitle = measure.value
    ? `${measure.value.measure_id}: ${measure.value.name}`
    : '';
  const measureLink = `/measures/${route.params.slug}?v=${currentCatalogVersion.value.name}`;

  return {
    path: '/contact',
    query: {
      title: measureTitle,
      type: 'suggestion',
      content: $t('measure.feedback.prefill_content', {
        ':measure': measureTitle,
        ':link': measureLink,
      }),
    },
  };
});

function measureDetailLocation(slug, versionName = currentCatalogVersion.value.name) {
  return {
    path: `/measures/${slug}`,
    query: {
      v: versionName,
      ...(detailSector.value ? { sector: detailSector.value } : {}),
    },
  };
}

// Fetch all measures in the same sector + version for prev/next navigation
const { data: siblingMeasuresRaw } = await useAsyncData(
  () => `measure-siblings-${route.params.slug}-${currentCatalogVersion.value.id}-${detailSector.value || 'all'}`,
  () => $directus.request(
    $readItems('measures', {
      fields: ['id', 'slug', 'name', 'measure_id', 'sector'],
      filter: {
        catalog_version: { _eq: currentCatalogVersion.value.id },
        ...(detailSector.value ? { sector: { _eq: detailSector.value } } : {}),
      },
      sort: ['measure_id'],
      limit: -1,
    }),
  ),
  { watch: [currentCatalogVersion, detailSector] },
);

const siblingMeasures = computed(() => siblingMeasuresRaw.value ?? []);
const siblingIndex = computed(() => siblingMeasures.value.findIndex(m => m.slug === route.params.slug));
const prevMeasure = computed(() => siblingIndex.value > 0 ? siblingMeasures.value[siblingIndex.value - 1] : null);
const nextMeasure = computed(() => siblingIndex.value < siblingMeasures.value.length - 1 ? siblingMeasures.value[siblingIndex.value + 1] : null);
function handleArrowKey(e) {
  if (e.key === 'ArrowLeft' && prevMeasure.value) {
    e.preventDefault();
    router.push(measureDetailLocation(prevMeasure.value.slug));
  } else if (e.key === 'ArrowRight' && nextMeasure.value) {
    e.preventDefault();
    router.push(measureDetailLocation(nextMeasure.value.slug));
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

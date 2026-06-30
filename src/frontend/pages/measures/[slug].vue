<template>
  <div class="mx-auto w-full min-w-0 max-w-4xl overflow-hidden px-4 py-4 sm:px-6 sm:py-8 lg:px-8">
    <!-- Back link with chevron + sibling navigation -->
    <div class="flex flex-wrap items-center gap-2">
      <NuxtLink :to="measureIndexLocation" class="inline-flex items-center gap-1 font-heading text-h4 text-light-blue">
        <svg class="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        {{
          detailSector
            ? $t("measure.back_label", { ":sector": $t(`measure_sectors.${detailSector}.title`) })
            : "Zurück zu Maßnahmen"
        }}
      </NuxtLink>

      <div v-if="prevMeasure || nextMeasure" class="ml-2 flex items-center gap-1">
        <NuxtLink
          v-if="prevMeasure"
          :to="measureDetailLocation(prevMeasure.slug, currentCatalogVersion.name)"
          class="inline-flex items-center gap-1 rounded border border-solid-gray-30 px-2 py-0.5 text-xs text-gray transition-colors hover:bg-solid-gray-05"
          :title="`← ${prevMeasure.measure_id}: ${prevMeasure.name}`"
        >
          <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          {{ prevMeasure.measure_id }}
        </NuxtLink>
        <span class="text-xs text-solid-gray-40">{{ siblingIndex + 1 }} / {{ siblingMeasures.length }}</span>
        <NuxtLink
          v-if="nextMeasure"
          :to="measureDetailLocation(nextMeasure.slug, currentCatalogVersion.name)"
          class="inline-flex items-center gap-1 rounded border border-solid-gray-30 px-2 py-0.5 text-xs text-gray transition-colors hover:bg-solid-gray-05"
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
      <span class="text-gray-500 text-xs">Version:</span>
      <NuxtLink
        v-for="mv in measureVersions"
        :key="mv.catalog_version.id"
        :to="measureDetailLocation(route.params.slug, mv.catalog_version.name)"
        class="slk-filter-pill px-2.5 py-1 transition"
        :class="currentCatalogVersion.id === mv.catalog_version.id ? 'slk-filter-pill--active' : ''"
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
          class="via-white pointer-events-none absolute inset-0 -z-10 bg-gradient-to-r from-white to-white"
          aria-hidden="true"
        />
        <p
          v-if="measureBackdropUrl && measureImageCredits"
          class="text-gray-500 absolute bottom-3 right-3 max-w-[min(22rem,calc(100%-1.5rem))] rounded bg-white px-2 py-1 text-right text-[11px] italic shadow-sm"
        >
          {{ measureImageCredits }}
        </p>

        <div class="max-w-3xl">
          <div class="mb-4 flex flex-wrap items-center gap-3">
            <span class="flex-shrink-0 rounded-lg bg-gray px-2 py-1 font-mono text-base-100">{{
              measure.measure_id
            }}</span>
            <h1 class="font-heading text-h1 font-bold text-gray">{{ measure.name }}</h1>
          </div>

          <section v-if="measure.description_about" class="pt-2">
            <h2 class="mb-3 text-h3 font-bold text-black">
              {{ $t("measure.description_about_heading") }}
            </h2>
            <div class="measure_ratings-start mb-2 flex flex-row gap-4">
              <figure class="mt-0 flex shrink-0 flex-col">
                <img
                  src="~/assets/icons/icon_info.svg"
                  alt=""
                  class="slk-sector-detail-icon slk-theme-icon--light h-auto w-10 opacity-50"
                />
                <img
                  src="~/assets/icons/icon_info-dark.svg"
                  alt=""
                  class="slk-sector-detail-icon slk-theme-icon--dark h-auto w-10 opacity-50"
                />
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
        <div class="bg-gray-200 h-8 w-16 rounded-lg"></div>
        <div class="bg-gray-200 h-8 w-64 rounded"></div>
      </div>
      <div class="bg-gray-100 h-4 w-full rounded"></div>
      <div class="bg-gray-100 h-4 w-5/6 rounded"></div>
      <div class="bg-gray-100 h-4 w-4/6 rounded"></div>
    </div>

    <!-- Feedback section -->
    <div class="border-gray-200 border-t-4 pb-8 pt-6">
      <div class="flex items-start gap-3">
        <img
          src="~/assets/icons/icon_hint.svg"
          alt=""
          class="slk-sector-detail-icon slk-theme-icon--light mt-0.5 h-6 w-6 flex-shrink-0 opacity-50"
        />
        <img
          src="~/assets/icons/icon_hint-dark.svg"
          alt=""
          class="slk-sector-detail-icon slk-theme-icon--dark mt-0.5 h-6 w-6 flex-shrink-0 opacity-50"
        />
        <div>
          <h3 class="mb-1 font-heading font-bold text-gray">Haben Sie einen Hinweis zu dieser Maßnahme?</h3>
          <p class="text-gray-500 mb-3 text-sm">
            Fehler, Ungenauigkeiten oder Verbesserungsvorschläge – teilen Sie uns Ihr Feedback mit.
          </p>
          <NuxtLink
            :to="`/contact?title=${encodeURIComponent(measure?.measure_id + ': ' + measure?.name)}&type=suggestion&content=${encodeURIComponent('Maßnahme: ' + measure?.measure_id + '\nLink: /measures/' + route.params.slug + '?v=' + currentCatalogVersion.name + '\n\nMein Hinweis:\n')}`"
            class="inline-flex items-center gap-2 rounded bg-light-blue px-4 py-2 text-sm font-bold text-white transition hover:brightness-110"
          >
            Feedback geben ↗
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
import { ref, computed, watch, onMounted, onBeforeUnmount } from "vue";
import sanitizeHtml from "sanitize-html";
const { $directus, $readItems, $t } = useNuxtApp();
const runtimeConfig = useRuntimeConfig();
const route = useRoute();
const router = useRouter();
const detailSector = computed(() => {
  return typeof route.query.sector === "string" && route.query.sector ? route.query.sector : null;
});

// Use a ref so the reactive key below re-fetches automatically when the version changes.
const currentCatalogVersion = ref(await getCatalogVersion($directus, $readItems, route, false));

onMounted(() => {
  setCatalogVersionUrl(route, router, currentCatalogVersion.value);
  window.addEventListener("keydown", handleArrowKey);
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", handleArrowKey);
});

// Function key includes the version ID, so Nuxt never serves stale data from a different
// version. The watch option triggers an automatic re-fetch when currentCatalogVersion changes.
const { data: measuresRaw } = await useAsyncData(
  () => `measure-${route.params.slug}-${currentCatalogVersion.value.id}`,
  () =>
    $directus.request(
      $readItems("measures", {
        fields: ["*", { image: ["id", "image_credits"] }],
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
  return typeof image === "string" ? image : image?.id || null;
});
const measureImageCredits = computed(() => {
  const image = measure.value?.image;
  return typeof image === "object" && image ? image.image_credits || "" : "";
});
const measureBackdropUrl = computed(() => {
  if (!measureImageId.value) return "";
  const baseUrl = runtimeConfig.public.clientDirectusUrl || "";
  return `${baseUrl}/assets/${measureImageId.value}?width=1600&height=700&fit=cover&quality=70`;
});
const measureIndexLocation = computed(() => {
  return {
    path: "/measures",
    query: {
      v: currentCatalogVersion.value.name,
      ...(detailSector.value ? { sector: detailSector.value } : {}),
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
  () => `measure-siblings-${route.params.slug}-${currentCatalogVersion.value.id}-${detailSector.value || "all"}`,
  () =>
    $directus.request(
      $readItems("measures", {
        fields: ["id", "slug", "name", "measure_id", "sector"],
        filter: {
          catalog_version: { _eq: currentCatalogVersion.value.id },
          ...(detailSector.value ? { sector: { _eq: detailSector.value } } : {}),
        },
        sort: ["measure_id"],
        limit: -1,
      }),
    ),
  { watch: [currentCatalogVersion, detailSector] },
);

const siblingMeasures = computed(() => siblingMeasuresRaw.value ?? []);
const siblingIndex = computed(() => siblingMeasures.value.findIndex((m) => m.slug === route.params.slug));
const prevMeasure = computed(() => (siblingIndex.value > 0 ? siblingMeasures.value[siblingIndex.value - 1] : null));
const nextMeasure = computed(() =>
  siblingIndex.value < siblingMeasures.value.length - 1 ? siblingMeasures.value[siblingIndex.value + 1] : null,
);
function handleArrowKey(e) {
  if (e.key === "ArrowLeft" && prevMeasure.value) {
    e.preventDefault();
    router.push(measureDetailLocation(prevMeasure.value.slug));
  } else if (e.key === "ArrowRight" && nextMeasure.value) {
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
  },
);

//MetaTags
const title = computed(() => measure.value?.name);
useHead({
  title,
});
</script>

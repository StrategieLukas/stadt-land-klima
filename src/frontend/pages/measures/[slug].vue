<template>
  <div class="px-4 sm:px-6 lg:px-8 py-4 sm:py-8 max-w-4xl mx-auto w-full min-w-0 overflow-hidden">

    <!-- Back link with chevron -->
    <NuxtLink :to="`/measures?sector=${measure?.sector}&v=${currentCatalogVersion.name}`" class="inline-flex items-center gap-1 font-heading text-h4 text-light-blue">
      <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
      {{ $t("measure.back_label", { ":sector": $t(`measure_sectors.${measure.sector}.title`) }) }}
    </NuxtLink>

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

    <article class="mb-8 mt-6">
      <div class="flex items-center gap-3 mb-4 flex-wrap">
        <span class="font-mono bg-gray text-base-100 px-2 py-1 rounded-lg flex-shrink-0">{{ measure.measure_id }}</span>
        <h1 class="font-heading text-h1 font-bold text-gray">{{ measure.name }}</h1>
      </div>

      <div class="divide-y-2 divide-light-blue">
        <StaticMeasureDetails :measure="measure" />
        <MeasureDescriptions :measure="measure" />
      </div>
    </article>

    <!-- Feedback section -->
    <div class="border-t-4 border-gray-200 pt-6 pb-8">
      <div class="flex items-start gap-3">
        <img src="~/assets/icons/icon_hint.svg" alt="" class="w-6 h-6 opacity-50 flex-shrink-0 mt-0.5" />
        <div>
          <h3 class="font-heading font-bold text-gray mb-1">Haben Sie einen Hinweis zu dieser Maßnahme?</h3>
          <p class="text-sm text-gray-500 mb-3">Fehler, Ungenauigkeiten oder Verbesserungsvorschläge – teilen Sie uns Ihr Feedback mit.</p>
          <NuxtLink
            :to="`/feedback?title=${encodeURIComponent(measure?.measure_id + ': ' + measure?.name)}&content=${encodeURIComponent('Maßnahme: ' + measure?.measure_id + '\nLink: /measures/' + route.params.slug + '?v=' + currentCatalogVersion.name + '\n\nMein Hinweis:\n')}`"
            class="inline-flex items-center gap-2 px-4 py-2 rounded text-sm font-bold bg-light-blue text-white hover:brightness-110 transition"
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
import { ref, computed, watch } from 'vue';
const { $directus, $readItems, $t } = useNuxtApp();
const route = useRoute();
const router = useRouter();

let selectedCatalogVersion = await getCatalogVersion($directus, $readItems, route, true);
const currentCatalogVersion = ref(selectedCatalogVersion);

onMounted(() => {
  setCatalogVersionUrl(route, router, selectedCatalogVersion);
});

const { data: measuresRaw, execute: refetchMeasure } = await useAsyncData(`measure-${route.params.slug}`, () => {
  return $directus.request(
    $readItems("measures", {
      filter: {
        slug: { _eq: route.params.slug },
        catalog_version: { _eq: selectedCatalogVersion.id }
      },
      limit: 1,
    }),
  );
});

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

// Re-fetch when catalog version changes
watch(
  () => route.query.v,
  async (newV, oldV) => {
    if (newV === oldV) return;
    selectedCatalogVersion = await getCatalogVersion($directus, $readItems, route, true);
    currentCatalogVersion.value = selectedCatalogVersion;
    await refetchMeasure();
  }
);

//MetaTags
const title = computed(() => measure.value?.name);
useHead({
  title,
});
</script>

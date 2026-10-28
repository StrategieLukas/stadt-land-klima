<template>
  <main class="mx-auto w-full max-w-4xl min-w-0 px-4 py-4 sm:px-6 sm:py-8 lg:px-8">
    <div class="mx-0 my-4 flex justify-center rounded-lg border border-blue-600 bg-blue-100 p-3 drop-shadow-md sm:p-4">
      <AdministrativeAreaSearchBar base-path="/stats" />
    </div>

    <!-- Main Info Container -->
    <div class="mt-6 max-w-full min-w-0 overflow-hidden rounded-lg bg-white shadow-lg">
      <!-- Breadcrumbs -->
      <div
        v-if="area?.contained_by?.length"
        class="breadcrumbs overflow-x-auto bg-gray-50 px-3 py-3 text-sm text-gray-600 sm:px-4 lg:px-6"
      >
        <ul class="flex min-w-0 flex-row flex-nowrap items-center">
          <li v-for="containedArea in area.contained_by" :key="containedArea.ars" class="shrink-0">
            <NuxtLink
              :to="`/regions/${containedArea.ars}`"
              class="text-xs whitespace-nowrap hover:underline sm:text-sm"
            >
              {{ containedArea.prefix }} {{ containedArea.name }}
            </NuxtLink>
          </li>
        </ul>
      </div>

      <!-- Header Section -->
      <div
        class="flex w-full flex-col justify-between gap-4 overflow-hidden bg-linear-to-r from-green-50 to-teal-50 px-3 py-4 sm:px-4 sm:py-6 lg:flex-row lg:gap-0 lg:px-6 lg:py-8"
      >
        <div class="max-w-full min-w-0 flex-1">
          <p class="text-sm font-semibold tracking-wide text-gray-600 uppercase">
            {{ area?.prefix || $t("generic.loading") }}
          </p>
          <h1 class="mb-2 text-2xl font-bold wrap-break-word text-gray-900 sm:text-3xl">
            {{ area?.name || $t("generic.loading") }}
          </h1>
          <p class="text-base text-gray-600 lg:text-lg">{{ area?.state || "" }}</p>
        </div>
        <div class="flex shrink-0 flex-col space-y-3 lg:text-right">
          <div class="lg:text-right">
            <p class="text-xs font-semibold text-gray-500">{{ t("region.ars_label") }}</p>
            <p class="font-mono text-sm text-gray-700">{{ area?.ars || "-" }}</p>
          </div>
          <div class="lg:text-right">
            <p class="text-xs font-semibold text-gray-500">{{ t("region.municipalities_count") }}</p>
            <p class="text-sm font-bold text-gray-700">{{ municipalities.length }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Map Section -->
    <div
      v-if="area && (area.geo_center || area.geo_area)"
      class="mt-6 max-w-full overflow-hidden bg-base-100 shadow-md"
    >
      <AdministrativeAreaMap
        :geo-center="regionPoint"
        :geo-area="parseGeoData(area.geo_area)"
        :administrative-area-name="area.name"
      />
    </div>

    <!-- Ranking Section -->
    <div class="mt-6 overflow-hidden rounded-lg bg-white shadow-md">
      <div class="flex items-center justify-between border-b border-gray-200 px-4 py-4">
        <h2 class="text-lg font-semibold text-gray-900">
          {{ t("region.ranking_title") }}
        </h2>
        <div v-if="selectedCatalogVersion" class="font-mono text-xs text-gray-500">
          {{ selectedCatalogVersion.name }}
        </div>
      </div>

      <!-- Loading -->
      <div v-if="loadingMunicipalities" class="flex items-center justify-center gap-2 py-12">
        <SlkFlowerSpinner :size="32" />
        <span class="text-gray-600">{{ $t("generic.loading") }}</span>
      </div>

      <!-- Ranked List -->
      <div v-else-if="rankedMunicipalities.length > 0" class="divide-y divide-gray-100">
        <div
          v-for="(muni, index) in rankedMunicipalities"
          :key="muni.ars"
          class="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-gray-50"
        >
          <!-- Rank -->
          <div class="w-8 shrink-0 text-center">
            <span class="text-sm font-bold text-gray-400">#{{ index + 1 }}</span>
          </div>

          <!-- Name & prefix -->
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold text-gray-900">{{ muni.name }}</p>
            <p class="text-xs text-gray-500">{{ muni.prefix }}</p>
          </div>

          <!-- Score badge -->
          <div class="flex shrink-0 items-center gap-2">
            <div v-if="muni.score !== null" class="text-right">
              <span class="text-sm font-bold text-green-700">{{ muni.score.toFixed(1) }}</span>
              <span class="ml-0.5 text-xs text-gray-400">{{ t("stats.points_abbrev") }}</span>
            </div>
            <NuxtLink
              v-if="muni.slug"
              :to="`/municipalities/${muni.slug}`"
              class="inline-flex items-center rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium whitespace-nowrap text-green-700 transition-colors hover:bg-green-200"
            >
              {{ t("region.view_rating") }}
              <svg class="ml-1 h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </NuxtLink>
            <NuxtLink
              v-else
              :to="`/data/${muni.ars}`"
              class="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium whitespace-nowrap text-blue-700 transition-colors hover:bg-blue-200"
            >
              {{ t("stats.view_stats") }}
              <svg class="ml-1 h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </NuxtLink>
          </div>
        </div>
      </div>

      <!-- Unrated municipalities (no score) -->
      <div v-if="unratedMunicipalities.length > 0" class="border-t border-gray-200">
        <button
          class="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-gray-500 hover:bg-gray-50"
          @click="showUnrated = !showUnrated"
        >
          <span>{{ unratedMunicipalities.length }} {{ t("region.unrated_municipalities") }}</span>
          <svg
            class="h-4 w-4 transition-transform"
            :class="showUnrated ? 'rotate-180' : ''"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <div v-if="showUnrated" class="divide-y divide-gray-100">
          <div
            v-for="muni in unratedMunicipalities"
            :key="muni.ars"
            class="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-gray-50"
          >
            <div class="w-8 shrink-0">
              <span class="text-xs text-gray-300">-</span>
            </div>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm text-gray-600">{{ muni.name }}</p>
              <p class="text-xs text-gray-400">{{ muni.prefix }}</p>
            </div>
            <NuxtLink
              :to="`/data/${muni.ars}`"
              class="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium whitespace-nowrap text-gray-600 transition-colors hover:bg-gray-200"
            >
              {{ t("stats.view_stats") }}
              <svg class="ml-1 h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </NuxtLink>
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div v-else-if="!loadingMunicipalities && municipalities.length === 0" class="py-12 text-center text-gray-500">
        <svg class="mx-auto h-12 w-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.29-1.016-5.707-2.572"
          />
        </svg>
        <p class="mt-2 text-sm">{{ t("region.no_municipalities") }}</p>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { clientFailure } from "~/shared/securityLog";

import { useRoute } from "vue-router";
import { parseGeoCenter, parseGeoData } from "~/shared/contracts/geometry";
import { ref, computed, onMounted } from "vue";
import { getCatalogVersion } from "~/composables/getCatalogVersion";

import { singleRouteValue } from "~/shared/routeValues";
import type { Area } from "~/shared/contracts/search";
const route = useRoute();
const ars = singleRouteValue(route.params.ars);
if (!ars || !/^\d{2,12}$/.test(ars)) throw createError({ statusCode: 404, statusMessage: "Region not found" });
const { $t, $translateDynamic, $stadtlandzahlAPI } = useNuxtApp();

const selectedCatalogVersion = ref(await getCatalogVersion(route));

const area = ref<Area | null>(null);
const municipalities = ref<Area[]>([]);
const regionPoint = computed(() => {
  const point = parseGeoCenter(area.value?.geo_center);
  return point ? { type: "Point" as const, coordinates: [point.lon, point.lat] } : null;
});
const loadingMunicipalities = ref(false);
const showUnrated = ref(false);
const municipalityNameCollator = new Intl.Collator("de-DE", {
  numeric: true,
  sensitivity: "base",
});

function compareByScoreThenName(a: { score: number | null; name: string }, b: { score: number | null; name: string }) {
  const scoreDifference = (b.score ?? 0) - (a.score ?? 0);
  if (scoreDifference !== 0) return scoreDifference;
  return municipalityNameCollator.compare(a.name ?? "", b.name ?? "");
}

const t = (key: string, fallback = key) => {
  const translation = $translateDynamic(key);
  return translation === key ? fallback : translation;
};

// Municipalities sorted by score for the current catalog version
const rankedMunicipalities = computed(() => {
  const catalogName = selectedCatalogVersion.value?.name;
  return municipalities.value
    .map((m) => {
      const entry = catalogName
        ? m.stadtlandklimaDataAll?.find((d) => d.measureCatalogName === catalogName && Number(d.percentageRated) >= 98)
        : null;
      return {
        ars: m.ars,
        name: m.name,
        prefix: m.prefix,
        population: m.population,
        slug: entry?.slug ?? null,
        score: entry?.scoreTotal == null ? null : Number(entry.scoreTotal),
      };
    })
    .filter((m) => m.score !== null)
    .sort(compareByScoreThenName);
});

const unratedMunicipalities = computed(() => {
  const ratedArs = new Set(rankedMunicipalities.value.map((m) => m.ars));
  return municipalities.value
    .filter((m) => !ratedArs.has(m.ars))
    .map((m) => ({ ars: m.ars, name: m.name, prefix: m.prefix }));
});

const pageTitle = computed(() => {
  if (area.value?.name) {
    return area.value.prefix ? `${area.value.prefix} ${area.value.name}` : area.value.name;
  }
  return t("region.title_fallback");
});

usePageSeo({ title: pageTitle });

onMounted(async () => {
  loadingMunicipalities.value = true;
  try {
    // Fetch area data first so we know the level before building the ARS prefix.
    const areaData = await $stadtlandzahlAPI.fetchStatsByARS(ars!);

    if (areaData) {
      // If someone navigates here directly with a level 4+ ARS, redirect to /data/
      if ((areaData.level ?? 0) >= 4) {
        await navigateTo(`/data/${ars}`, { replace: true });
        return;
      }
      area.value = areaData;
    }

    municipalities.value = await $stadtlandzahlAPI.fetchMunicipalitiesInRegion(ars!, areaData?.level ?? 2);
  } catch (e) {
    clientFailure("app.pages.regions._ars_.failed", e);
  } finally {
    loadingMunicipalities.value = false;
  }
});
</script>

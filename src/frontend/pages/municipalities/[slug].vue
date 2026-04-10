<template>
  <!-- Case 1: Directus data with full rating -->
  <div v-if="directusData && directusData.municipalityScore">
    <waving-banner v-if="directusData.municipalityScore.municipality.status === 'draft'">
      {{ $t("municipalities.preview_text") }}
    </waving-banner>
    <NuxtLink :to="`/municipalities?v=${selectedCatalogVersion.name}`" class="font-heading text-h4 text-light-blue">
      ← {{ $t("municipality.back_label") }}
    </NuxtLink>
    <article class="mb-8 mt-10">
      <detail-municipality
        :municipalityScore="directusData.municipalityScore"
        :ratings-by-sector="directusData.ratingsBySector"
      ></detail-municipality>
    </article>
    <NearbyMunicipalitiesCarousel
      :ars="directusData.municipalityScore.municipality.ars"
      :catalog-version-id="selectedCatalogVersion.id"
      :catalog-version-name="selectedCatalogVersion.name"
      class="my-8"
    />
    <NuxtLink :to="`/municipalities?v=${selectedCatalogVersion.name}`" class="font-heading text-h4 text-light-blue">
      ← {{ $t("municipality.back_label") }}
    </NuxtLink>
  </div>

  <!-- Loading state: fetching from Stadt-Land-Zahl -->
  <div v-else-if="slzPending" class="animate-pulse mt-10">
    <div class="h-5 w-40 bg-gray-200 rounded mb-8"></div>
    <div class="relative mb-3 flex items-stretch gap-4 bg-opacity-10 py-5 pl-10 pr-4 bg-rating-0">
      <div class="h-8 w-8 bg-gray-300 rounded mt-6 flex-shrink-0"></div>
      <div class="grow space-y-2 pt-2">
        <div class="h-8 w-64 bg-gray-300 rounded"></div>
        <div class="h-4 w-32 bg-gray-200 rounded"></div>
      </div>
    </div>
    <div class="h-12 w-full bg-gray-200 rounded mb-6"></div>
    <div class="space-y-4 mt-6">
      <div class="h-36 w-full bg-gray-100 rounded shadow-list"></div>
      <div class="h-16 w-full bg-gray-100 rounded shadow-list"></div>
      <div class="h-16 w-full bg-gray-100 rounded shadow-list"></div>
    </div>
  </div>

  <!-- Case 2: No Directus data, but found in Stadt-Land-Zahl (ARS-based generic page) -->
  <div v-else-if="slzArea">
    <NuxtLink :to="`/municipalities?v=${selectedCatalogVersion.name}`" class="font-heading text-h4 text-light-blue">
      ← {{ $t("municipality.back_label") }}
    </NuxtLink>
    <article class="mb-8 mt-10">
      <!-- Header band (mirrors ItemRanking, no score) -->
      <div class="relative mb-3 flex items-stretch gap-4 py-5 pl-10 pr-4" style="background-color: #e5e7eb;">
        <div class="relative h-full pt-6">
          <img src="~/assets/icons/icon_location_green_marker.svg" class="my-auto h-auto w-8" />
          <div class="absolute top-0 w-full text-center font-heading text-3xl font-bold text-black">?</div>
        </div>
        <div class="grow">
          <h3 class="font-heading text-h2 font-bold text-black">{{ slzArea.name }}</h3>
          <p class="text-sm text-gray-500">{{ slzArea.prefix }}</p>
          <!-- Gray placeholder bar instead of score progress -->
          <div class="mt-2 h-3 w-full rounded bg-gray-300 opacity-60"></div>
        </div>
      </div>

      <!-- Mobile layout -->
      <div class="block lg:hidden mt-6 space-y-4">
        <!-- Info box -->
        <div class="rounded-sm shadow-list">
          <div class="flex items-center gap-2 px-6 py-4">
            <img src="~/assets/icons/icon_info.svg" class="h-6 w-6 opacity-60" />
            <h3 class="font-heading text-h3 text-green">{{ $t("municipality.municipality_info") }}</h3>
          </div>
          <div class="px-6 pb-6 space-y-3">
            <div v-if="slzArea.state" class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <img src="~/assets/icons/icon_location.svg" class="h-5 w-5 opacity-60" />
                <span class="text-sm text-gray-700">{{ $t("state") }}</span>
              </div>
              <span class="text-sm font-bold text-gray-900">{{ slzArea.state }}</span>
            </div>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <img src="~/assets/icons/icon_team.svg" class="h-5 w-5 opacity-60" />
                <span class="text-sm text-gray-700">{{ $t("municipality.population") }}</span>
              </div>
              <span class="text-sm font-bold text-gray-900">
                {{ slzArea.population ? slzArea.population.toLocaleString() : $t("generic.not_entered") }}
              </span>
            </div>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <img src="~/assets/icons/icon_politics.svg" class="h-5 w-5 opacity-60" />
                <span class="text-sm text-gray-700">{{ $t("municipality.mayor") }}</span>
              </div>
              <span class="text-sm font-bold text-gray-400 italic">{{ $t("generic.not_entered") }}</span>
            </div>
          </div>
        </div>

        <!-- Stats link -->
        <NuxtLink
          :to="`/stats/${slzArea.ars}`"
          class="shadow-list flex items-center gap-4 rounded-sm bg-blue-100 p-5 px-6 text-sm font-medium text-blue-600 hover:bg-blue-200"
        >
          <img src="~/assets/icons/icon_evaluation_criteria.svg" class="h-auto w-12 opacity-50 md:w-14" />
          <h2 class="font-heading text-h2">{{ $t("stats.title") }} →</h2>
        </NuxtLink>

        <!-- Registration CTA -->
        <div class="flex flex-col items-center justify-center rounded-sm shadow-list p-10 text-center bg-rating-3-light">
          <img src="~/assets/icons/icon_location_green_marker.svg" class="h-14 w-auto mb-4 opacity-80" />
          <h2 class="font-heading text-h2 font-bold text-green mb-2">Lokalteam gründen</h2>
          <p class="text-gray-600 max-w-sm mb-6">
            <strong>{{ slzArea.name }}</strong> wurde noch nicht bewertet.
            Gründe ein Lokalteam und bringe aktiven Klimaschutz in deine Kommune.
          </p>
          <NuxtLink
            :to="`/register_localteam?ars=${slzArea.ars}&name=${encodeURIComponent(slzArea.name)}`"
            class="px-8 py-2.5 bg-green text-white font-semibold rounded-md hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-green focus:ring-offset-2 transition-colors"
          >
            Jetzt Lokalteam gründen →
          </NuxtLink>
        </div>
      </div>

      <!-- Desktop layout -->
      <div class="hidden lg:grid lg:grid-cols-3 lg:gap-8 mt-6">
        <!-- Left column (2/3): registration CTA -->
        <div class="lg:col-span-2">
          <div class="flex flex-col items-center justify-center rounded-sm shadow-list p-10 text-center bg-rating-3-light">
            <img src="~/assets/icons/icon_location_green_marker.svg" class="h-14 w-auto mb-4 opacity-80" />
            <h2 class="font-heading text-h2 font-bold text-green mb-2">Lokalteam gründen</h2>
            <p class="text-gray-600 max-w-sm mb-6">
              <strong>{{ slzArea.name }}</strong> wurde noch nicht bewertet.
              Gründe ein Lokalteam und bringe aktiven Klimaschutz in deine Kommune.
            </p>
            <NuxtLink
              :to="`/register_localteam?ars=${slzArea.ars}&name=${encodeURIComponent(slzArea.name)}`"
              class="px-8 py-2.5 bg-green text-white font-semibold rounded-md hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-green focus:ring-offset-2 transition-colors"
            >
              Jetzt Lokalteam gründen →
            </NuxtLink>
          </div>
        </div>

        <!-- Right column (1/3): sticky sidebar -->
        <div class="lg:col-span-1 pb-4">
          <div class="sticky top-24 space-y-6">
            <!-- Info box -->
            <div class="rounded-sm shadow-list">
              <div class="flex items-center gap-2 px-6 py-4">
                <img src="~/assets/icons/icon_info.svg" class="h-6 w-6 opacity-60" />
                <h3 class="font-heading text-h3 text-green">{{ $t("municipality.municipality_info") }}</h3>
              </div>
              <div class="px-6 pb-6 space-y-3">
                <div v-if="slzArea.state" class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <img src="~/assets/icons/icon_location.svg" class="h-5 w-5 opacity-60" />
                    <span class="text-sm text-gray-700">{{ $t("state") }}</span>
                  </div>
                  <span class="text-sm font-bold text-gray-900">{{ slzArea.state }}</span>
                </div>
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <img src="~/assets/icons/icon_team.svg" class="h-5 w-5 opacity-60" />
                    <span class="text-sm text-gray-700">{{ $t("municipality.population") }}</span>
                  </div>
                  <span class="text-sm font-bold text-gray-900">
                    {{ slzArea.population ? slzArea.population.toLocaleString() : $t("generic.not_entered") }}
                  </span>
                </div>
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <img src="~/assets/icons/icon_politics.svg" class="h-5 w-5 opacity-60" />
                    <span class="text-sm text-gray-700">{{ $t("municipality.mayor") }}</span>
                  </div>
                  <span class="text-sm font-bold text-gray-400 italic">{{ $t("generic.not_entered") }}</span>
                </div>
              </div>
            </div>

            <!-- Stats link -->
            <NuxtLink
              :to="`/stats/${slzArea.ars}`"
              class="shadow-list flex items-center gap-3 rounded-sm bg-blue-100 p-5 px-6 text-sm font-medium text-blue-600 hover:bg-blue-200"
            >
              <img src="~/assets/icons/icon_evaluation_criteria.svg" class="h-6 w-6 opacity-60" />
              <h3 class="font-heading text-h3">{{ $t("stats.title") }} →</h3>
            </NuxtLink>

          </div>
        </div>
      </div>
    </article>
    <NearbyMunicipalitiesCarousel
      :ars="slzArea.ars"
      :catalog-version-id="selectedCatalogVersion.id"
      :catalog-version-name="selectedCatalogVersion.name"
      class="my-8"
    />
    <NuxtLink :to="`/municipalities?v=${selectedCatalogVersion.name}`" class="font-heading text-h4 text-light-blue">
      ← {{ $t("municipality.back_label") }}
    </NuxtLink>
  </div>

  <!-- Case 3: Not found anywhere -->
  <div v-else>
    <NuxtLink :to="`/municipalities?v=${selectedCatalogVersion.name}`" class="font-heading text-h4 text-light-blue">
      ← {{ $t("municipality.back_label") }}
    </NuxtLink>
    <waving-banner>
      {{ $t("municipality_missing") }}
    </waving-banner>
  </div>
</template>


<script setup>
const { $directus, $readItems, $stadtlandzahlAPI } = useNuxtApp();
const router = useRouter();

import { getCatalogVersion } from '~/composables/getCatalogVersion.js';
import { fetchMunicipalityData } from '~/shared/directus-calls/complex-data-fetches.js';
import { getStateMunicipalElectionYear } from '~/shared/utils.js';
const route = useRoute();
const selectedCatalogVersion = await getCatalogVersion($directus, $readItems, route);

// Change the URL to match the catalog version, if it didn't to begin with
if (process.client && route.query.v != selectedCatalogVersion.name) {
  onMounted(() => {
    router.replace({ query: { ...route.query, v: selectedCatalogVersion.name } });
  });
}

const directusData = await fetchMunicipalityData($directus, $readItems, route.params.slug, selectedCatalogVersion.id);

// If no Directus data, fetch from Stadt-Land-Zahl with a loading state
const { data: slzArea, pending: slzPending } = useAsyncData(
  `slz-area-${route.params.slug}`,
  async () => {
    if (directusData?.municipalityScore || !$stadtlandzahlAPI) return null;
    try {
      const data = await $stadtlandzahlAPI.fetchStatsByARS(route.params.slug);
      if (data?.name) {
        return {
          name: data.name,
          prefix: data.prefix ?? '',
          state: data.state ?? null,
          ars: data.ars ?? route.params.slug,
          population: data.data_products?.population_data?.population ?? null,
        };
      }
      return null;
    } catch (_) {
      return null;
    }
  }
);

// MetaTags
const pageTitle = directusData?.municipalityScore?.municipality?.name
  ?? slzArea.value?.name
  ?? route.params.slug;
const title = ref(pageTitle);
useHead({ title });
</script>

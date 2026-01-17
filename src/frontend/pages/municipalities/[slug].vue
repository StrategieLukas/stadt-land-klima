<template>
  <div v-if="directusData && directusData.municipalityScores">
    <waving-banner v-if="directusData.municipalityScores[0].municipality.status === 'draft'">
      {{ $t("municipalities.preview_text") }}
    </waving-banner>
    
    <!-- Navigation and Edit Button Row -->
    <div class="flex items-center justify-between mb-4">
      <NuxtLink :to="`/municipalities?v=${selectedCatalogVersion.name}`" class="font-heading text-h4 text-light-blue">
        ← {{ $t("municipality.back_label") }}
      </NuxtLink>
      
      <!-- Edit Button for LocalteamMember/Admin -->
      <ClientOnly>
        <button
          v-if="canEditThisMunicipality"
          @click="toggleEditMode"
          class="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors"
          :class="isEditMode 
            ? 'bg-blue-600 text-white hover:bg-blue-700' 
            : 'bg-blue-100 text-blue-700 hover:bg-blue-200'"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          {{ isEditMode ? $t('municipality.edit_mode.exit') : $t('municipality.edit_mode.enter') }}
        </button>
      </ClientOnly>
    </div>

    <!-- Catalog Type Tabs (shown when multiple types available) -->
    <div v-if="availableCatalogTypes.length > 1" class="mb-6">
      <div role="tablist" class="tabs tabs-boxed w-fit">
        <a
          v-for="catalogType in availableCatalogTypes"
          :key="catalogType.value"
          role="tab"
          class="tab"
          :class="{ 'tab-active': selectedCatalogType === catalogType.value }"
          @click="selectCatalogType(catalogType.value)"
        >
          <span class="flex items-center gap-2">
            <span 
              class="w-3 h-3 rounded-full"
              :class="catalogType.value === 'climate_mitigation' ? 'bg-green-600' : 'bg-blue-600'"
            ></span>
            {{ catalogType.label }}
          </span>
        </a>
      </div>
    </div>
    
    <!-- Edit Mode View -->
    <ClientOnly>
      <MunicipalityEditMode
        v-if="isEditMode && canEditThisMunicipality"
        :municipality-score="directusData.municipalityScores[0]"
        :catalog-version="selectedCatalogVersion"
        :localteam-id="localteamId"
        :initial-ratings="directusData.ratingsMeasures"
        @close="isEditMode = false"
        @rating-updated="onRatingUpdated"
      />
    </ClientOnly>
    
    <!-- Normal View -->
    <article v-if="!isEditMode" class="mb-8 mt-6">
      <detail-municipality
        :municipalityScore="directusData.municipalityScores[0]"
        :sorted-ratings="sortMeasuresBySectorDict"
      ></detail-municipality>
    </article>
    
    <NuxtLink 
      v-if="!isEditMode"
      :to="`/municipalities?v=${selectedCatalogVersion.name}`" 
      class="font-heading text-h4 text-light-blue"
    >
      ← {{ $t("municipality.back_label") }}
    </NuxtLink>
  </div>
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
import { ref, computed, onMounted } from 'vue';
import { usePermissions } from '~/composables/usePermissions';
import MunicipalityEditMode from '~/components/MunicipalityEditMode.vue';

const { $directus, $readItems, $t } = useNuxtApp();
const router = useRouter();
const { canRateLocalTeam, isAuthenticated, userLocalTeams } = usePermissions();

import { getCatalogVersion } from '~/composables/getCatalogVersion.js';
const route = useRoute();
const selectedCatalogVersion = await getCatalogVersion($directus, $readItems, route);

// Edit mode state
const isEditMode = ref(false);
const selectedCatalogType = ref('climate_mitigation');

// Change the URL to match the catalog version, if it didn't to begin with
if (process.client && route.query.v != selectedCatalogVersion.name) {
  onMounted(() => {
    router.replace({ query: { ...route.query, v: selectedCatalogVersion.name } });
  });
}


const { data: directusData } = await useAsyncData(`municipality_${route.params.slug}_${selectedCatalogVersion.id}`, async () => {
  const [municipalityScores, measures] = await Promise.all([
    $directus.request(
      $readItems("municipality_scores", {
        fields: ["*", { municipality: ["*"]}, { catalog_version: ["*"]}],
        filter: { catalog_version: { _eq: selectedCatalogVersion.id }, municipality: {slug: { _eq: route.params.slug } }},
        limit: 1,
      }),
    ),
    $directus.request($readItems("measures", {})),
  ]);

  // Early return if municipalities is empty or null
  if (!municipalityScores || municipalityScores.length === 0) {
    return { municipalityScores: null, measures: measures, ratingsMeasures: [] };
  }

  const ratingsMeasures = await $directus.request(
    $readItems("ratings_measures", {
      filter: {
          localteam_id: { _eq: municipalityScores[0].municipality.localteam_id },
          measure_id: { catalog_version: { _eq: selectedCatalogVersion.id } }
        },
    }),
  );

  return {
    municipalityScores,
    measures,
    ratingsMeasures,
  };
});


//MetaTags
const title = ref(directusData.value?.municipalityScores?.[0]?.municipality?.name ?? '404');
useHead({
  title,
});

const sortMeasuresBySectorDict = computed(() => {
  if(directusData === null || directusData.value === null) {
    return {};
  }
  return sortMeasuresBySector(directusData.value.ratingsMeasures, directusData.value.measures);
});

function sortMeasuresBySector(ratingsMeasuresArr, measuresArr) {
  if (!Array.isArray(ratingsMeasuresArr) || !Array.isArray(measuresArr)) {
    return {};
  }
  const measureMap = new Map(measuresArr.map((measure) => [measure.id, measure]));
  const dictMeasuresRatingSorted = {};

  for (const item of ratingsMeasuresArr) {
    const measure = measureMap.get(item.measure_id);
    if (measure) {
      if(item.applicable && item.rating === null) {
        console.error(`Item ${item.rating} hat kein rating, obwohl applicable=true. Unbewertete Massnahmen sollten nicht ans Frontend geschickt werden.`)
        // Do not add the broken rating to the dict in this case
      } else {
        const { sector } = measure;
        item.measure = measure;
        if(!item.applicable) {
          item.rating = null
        }
        dictMeasuresRatingSorted[sector] = dictMeasuresRatingSorted[sector] || [];
        dictMeasuresRatingSorted[sector].push(item);
      }
    }
  }


  // Sort each sector's array: by rating (desc), then measure_id (asc)
  for (const sector in dictMeasuresRatingSorted) {
    dictMeasuresRatingSorted[sector].sort((a, b) => {
      const ratingA = a.rating;
      const ratingB = b.rating;

      // Handle nulls: treat null as lowest
      if (ratingA == null && ratingB != null) return 1;
      if (ratingA != null && ratingB == null) return -1;
      if (ratingA != null && ratingB != null) {
        if (ratingA !== ratingB) {
          return ratingB - ratingA; // Descending
        }
      }

      // Tiebreaker: sort by measure_id ascending
      if (a.measure_id < b.measure_id) return -1;
      if (a.measure_id > b.measure_id) return 1;
      return 0;
    });
  }

  return dictMeasuresRatingSorted;
}

// Computed: Check if current user can edit this municipality
const localteamId = computed(() => {
  return directusData.value?.municipalityScores?.[0]?.municipality?.localteam_id;
});

const canEditThisMunicipality = computed(() => {
  if (!isAuthenticated.value) return false;
  if (!localteamId.value) return false;
  return canRateLocalTeam(localteamId.value);
});

// Available catalog types (from catalog version or hardcoded for now)
const availableCatalogTypes = computed(() => {
  const catalogType = selectedCatalogVersion.catalog_type || 'climate_mitigation';
  // For now, just show the current catalog type
  // In the future, this could show all available types
  return [
    { value: 'climate_mitigation', label: 'Klimaschutz' },
    { value: 'climate_adaption', label: 'Klimaanpassung' }
  ].filter(t => t.value === catalogType || catalogType === 'both');
});

// Methods
function toggleEditMode() {
  isEditMode.value = !isEditMode.value;
}

function selectCatalogType(type) {
  selectedCatalogType.value = type;
  // Could trigger a data reload for different catalog type
}

function onRatingUpdated(updatedRating) {
  // Update local data when a rating is saved
  if (directusData.value?.ratingsMeasures) {
    const idx = directusData.value.ratingsMeasures.findIndex(r => r.id === updatedRating.id);
    if (idx !== -1) {
      directusData.value.ratingsMeasures[idx] = { 
        ...directusData.value.ratingsMeasures[idx], 
        ...updatedRating 
      };
    }
  }
}
</script>

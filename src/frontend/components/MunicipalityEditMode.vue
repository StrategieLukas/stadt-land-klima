<template>
  <div class="municipality-edit-mode">
    <!-- Edit Mode Header -->
    <div class="edit-header bg-blue-50 border-b border-blue-200 p-4 mb-6 rounded-lg">
      <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div class="flex items-center gap-4">
          <div class="flex items-center gap-2">
            <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <h2 class="text-lg font-bold text-blue-800">{{ $t('municipality.edit_mode.title') }}</h2>
          </div>
          <span class="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
            {{ catalogVersion?.name || 'Katalog' }}
          </span>
        </div>
        
        <!-- Overall Progress -->
        <div class="flex items-center gap-6">
          <RatingProgressCircle
            :rated="overallProgress.rated"
            :total="overallProgress.total"
            variant="default"
            :label="$t('municipality.edit_mode.rated')"
          />
          <button
            @click="$emit('close')"
            class="px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
            {{ $t('common.close') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Catalog Type Tabs (if multiple catalog types exist) -->
    <div v-if="catalogTypes.length > 1" class="mb-6">
      <div role="tablist" class="tabs tabs-boxed w-fit">
        <a
          v-for="type in catalogTypes"
          :key="type.value"
          role="tab"
          class="tab"
          :class="{ 'tab-active': selectedCatalogType === type.value }"
          @click="selectedCatalogType = type.value"
        >
          {{ type.label }}
        </a>
      </div>
    </div>

    <!-- Unrated Measures Alert -->
    <div v-if="unratedMeasures.length > 0" class="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
      <div class="flex items-start gap-3">
        <svg class="w-6 h-6 text-yellow-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <div>
          <h3 class="font-medium text-yellow-800">
            {{ $t('municipality.edit_mode.unrated_count', { count: unratedMeasures.length }) }}
          </h3>
          <p class="text-sm text-yellow-700 mt-1">
            {{ $t('municipality.edit_mode.unrated_hint') }}
          </p>
        </div>
      </div>
    </div>

    <!-- Sector-based Measure List -->
    <div class="space-y-4">
      <div
        v-for="(sectorData, sectorKey) in measuresBySector"
        :key="sectorKey"
        class="sector-collapsible"
      >
        <div
          class="collapse collapse-plus rounded-lg shadow-sm border"
          :class="getSectorBorderClass(sectorKey)"
        >
          <input
            type="checkbox"
            :name="`sector-${sectorKey}`"
            :checked="expandedSectors.includes(sectorKey)"
            @change="toggleSector(sectorKey)"
          />
          <div class="collapse-title flex items-center gap-4 pr-12">
            <img
              :src="getSectorIcon(sectorKey)"
              :alt="sectorKey"
              class="h-10 w-10 opacity-70"
            />
            <div class="flex-1">
              <h3 class="font-heading text-h3" :class="getSectorTextClass(sectorKey)">
                {{ $t(`sectors.${sectorKey}`) }}
              </h3>
              <div class="flex items-center gap-4 mt-1">
                <span class="text-sm text-gray-600">
                  {{ getSectorProgress(sectorKey).rated }}/{{ getSectorProgress(sectorKey).total }} {{ $t('municipality.edit_mode.measures_rated') }}
                </span>
                <div class="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    class="h-full transition-all duration-300"
                    :class="getSectorProgressClass(sectorKey)"
                    :style="{ width: `${getSectorProgressPercent(sectorKey)}%` }"
                  ></div>
                </div>
              </div>
            </div>
          </div>
          
          <div class="collapse-content">
            <div class="pt-4 space-y-3">
              <div
                v-for="rating in sectorData.measures"
                :key="rating.id"
                class="measure-item p-4 rounded-lg border cursor-pointer transition-all hover:shadow-md"
                :class="getMeasureItemClass(rating)"
                @click="selectMeasure(rating)"
              >
                <div class="flex items-start justify-between gap-4">
                  <div class="flex-1">
                    <div class="flex items-center gap-2 mb-1">
                      <RatingBadge
                        v-if="rating.rating !== null && rating.rating !== undefined"
                        :rating="getRatingLevel(rating.rating)"
                        size="small"
                      />
                      <span
                        v-else
                        class="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-medium"
                      >
                        {{ $t('municipality.edit_mode.not_rated') }}
                      </span>
                      <span
                        v-if="!rating.applicable"
                        class="px-2 py-0.5 bg-gray-200 text-gray-500 rounded text-xs"
                      >
                        {{ $t('municipality.edit_mode.not_applicable') }}
                      </span>
                    </div>
                    <h4 class="font-medium text-gray-900">
                      {{ rating.measure?.name || rating.measure_id }}
                    </h4>
                    <p v-if="rating.measure?.description" class="text-sm text-gray-600 mt-1 line-clamp-2">
                      {{ rating.measure.description }}
                    </p>
                  </div>
                  <div class="flex items-center gap-2">
                    <!-- Status indicators -->
                    <span
                      v-if="rating.needs_review"
                      class="p-1.5 bg-yellow-100 rounded-full"
                      :title="$t('municipality.edit_mode.needs_review')"
                    >
                      <svg class="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01" />
                      </svg>
                    </span>
                    <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
                
                <!-- Quick info if has sources -->
                <div v-if="rating.source || rating.criteria_values?.length" class="mt-3 pt-3 border-t border-gray-100">
                  <div class="flex items-center gap-4 text-xs text-gray-500">
                    <span v-if="rating.criteria_values?.length" class="flex items-center gap-1">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                      {{ rating.criteria_values.length }} {{ $t('municipality.edit_mode.criteria_filled') }}
                    </span>
                    <span v-if="rating.source" class="flex items-center gap-1">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                      {{ $t('municipality.edit_mode.has_sources') }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Measure Rating Panel (Slide-over) -->
    <Teleport to="body">
      <Transition name="slide">
        <div
          v-if="selectedMeasureRating"
          class="fixed inset-0 z-50 flex justify-end"
        >
          <!-- Backdrop -->
          <div
            class="absolute inset-0 bg-black/40"
            @click="closeMeasurePanel"
          ></div>
          
          <!-- Panel -->
          <div class="relative w-full max-w-2xl bg-white shadow-2xl overflow-y-auto">
            <div class="sticky top-0 bg-white border-b z-10 p-4 flex items-center justify-between">
              <h3 class="text-lg font-bold text-gray-900 truncate pr-4">
                {{ selectedMeasureRating.measure?.name || 'Maßnahme' }}
              </h3>
              <button
                @click="closeMeasurePanel"
                class="p-2 hover:bg-gray-100 rounded-lg"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div class="p-6">
              <!-- Use structured editor for new catalogs, legacy for old -->
              <MeasureRatingEditor
                v-if="usesStructuredRatings"
                :measure-id="selectedMeasureRating.measure_id"
                :localteam-id="localteamId"
                :rating-id="selectedMeasureRating.id"
                @saved="onRatingSaved"
                @close="closeMeasurePanel"
              />
              
              <!-- Legacy editor for old catalogs -->
              <LegacyMeasureRatingForm
                v-else
                :rating="selectedMeasureRating"
                :localteam-id="localteamId"
                @saved="onRatingSaved"
                @close="closeMeasurePanel"
              />
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useNuxtApp } from '#app';
import RatingProgressCircle from '~/components/RatingProgressCircle.vue';
import RatingBadge from '~/components/RatingBadge.vue';
import MeasureRatingEditor from '~/components/MeasureRatingEditor.vue';
import LegacyMeasureRatingForm from '~/components/LegacyMeasureRatingForm.vue';

const { $directus, $readItems, $t } = useNuxtApp();

const props = defineProps({
  municipalityScore: {
    type: Object,
    required: true
  },
  catalogVersion: {
    type: Object,
    required: true
  },
  localteamId: {
    type: String,
    required: true
  },
  initialRatings: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['close', 'rating-updated']);

// State
const ratings = ref([]);
const measures = ref([]);
const selectedMeasureRating = ref(null);
const expandedSectors = ref(['management']); // Start with one expanded
const selectedCatalogType = ref('climate_mitigation');
const isLoading = ref(false);

// Computed
const usesStructuredRatings = computed(() => {
  return props.catalogVersion?.uses_structured_ratings === true;
});

const catalogTypes = computed(() => {
  // Could be expanded to support multiple types
  return [
    { value: 'climate_mitigation', label: 'Klimaschutz' },
    { value: 'climate_adaption', label: 'Klimaanpassung' }
  ].filter(t => {
    // Only show if we have measures of this type (or show all for now)
    return true;
  });
});

const measuresBySector = computed(() => {
  const grouped = {};
  const allMeasures = new Map(measures.value.map(m => [m.id, m]));
  
  for (const rating of ratings.value) {
    const measure = allMeasures.get(rating.measure_id);
    if (!measure) continue;
    
    const sector = measure.sector || 'other';
    if (!grouped[sector]) {
      grouped[sector] = { measures: [], sector };
    }
    
    grouped[sector].measures.push({
      ...rating,
      measure
    });
  }
  
  // Sort measures within each sector
  for (const sector in grouped) {
    grouped[sector].measures.sort((a, b) => {
      // Unrated first
      const aRated = a.rating !== null && a.rating !== undefined && a.applicable;
      const bRated = b.rating !== null && b.rating !== undefined && b.applicable;
      if (!aRated && bRated) return -1;
      if (aRated && !bRated) return 1;
      // Then by name
      return (a.measure?.name || '').localeCompare(b.measure?.name || '');
    });
  }
  
  return grouped;
});

const overallProgress = computed(() => {
  const total = ratings.value.filter(r => r.applicable !== false).length;
  const rated = ratings.value.filter(r => 
    r.applicable !== false && 
    r.rating !== null && 
    r.rating !== undefined
  ).length;
  return { rated, total };
});

const unratedMeasures = computed(() => {
  return ratings.value.filter(r => 
    r.applicable !== false && 
    (r.rating === null || r.rating === undefined)
  );
});

// Methods
function getSectorProgress(sectorKey) {
  const sectorData = measuresBySector.value[sectorKey];
  if (!sectorData) return { rated: 0, total: 0 };
  
  const measures = sectorData.measures.filter(m => m.applicable !== false);
  const rated = measures.filter(m => m.rating !== null && m.rating !== undefined).length;
  return { rated, total: measures.length };
}

function getSectorProgressPercent(sectorKey) {
  const { rated, total } = getSectorProgress(sectorKey);
  if (total === 0) return 100;
  return (rated / total) * 100;
}

function toggleSector(sectorKey) {
  const idx = expandedSectors.value.indexOf(sectorKey);
  if (idx === -1) {
    expandedSectors.value.push(sectorKey);
  } else {
    expandedSectors.value.splice(idx, 1);
  }
}

function selectMeasure(rating) {
  selectedMeasureRating.value = rating;
}

function closeMeasurePanel() {
  selectedMeasureRating.value = null;
}

function onRatingSaved(updatedRating) {
  // Update local state
  const idx = ratings.value.findIndex(r => r.id === updatedRating.id);
  if (idx !== -1) {
    ratings.value[idx] = { ...ratings.value[idx], ...updatedRating };
  }
  emit('rating-updated', updatedRating);
}

function getRatingLevel(numericRating) {
  if (numericRating === null || numericRating === undefined) return null;
  const value = parseFloat(numericRating);
  if (value >= 0.875) return 'dark_green';
  if (value >= 0.625) return 'light_green';
  if (value >= 0.375) return 'yellow';
  if (value >= 0.125) return 'orange';
  return 'red';
}

function getSectorIcon(sectorKey) {
  const icons = {
    management: '/icons/icon_management.svg',
    energy: '/icons/icon_energy.svg',
    transport: '/icons/icon_transport.svg',
    buildings: '/icons/icon_buildings.svg',
    agriculture: '/icons/icon_agriculture.svg',
    industry: '/icons/icon_industry.svg'
  };
  return icons[sectorKey] || '/icons/icon_info.svg';
}

function getSectorBorderClass(sectorKey) {
  return 'border-gray-200 hover:border-gray-300';
}

function getSectorTextClass(sectorKey) {
  return 'text-green';
}

function getSectorProgressClass(sectorKey) {
  const pct = getSectorProgressPercent(sectorKey);
  if (pct >= 90) return 'bg-green-500';
  if (pct >= 70) return 'bg-lime-500';
  if (pct >= 50) return 'bg-yellow-500';
  if (pct >= 30) return 'bg-orange-500';
  return 'bg-red-500';
}

function getMeasureItemClass(rating) {
  if (!rating.applicable) {
    return 'bg-gray-50 border-gray-200';
  }
  if (rating.rating === null || rating.rating === undefined) {
    return 'bg-yellow-50 border-yellow-200';
  }
  return 'bg-white border-gray-200';
}

// Load data
async function loadData() {
  isLoading.value = true;
  try {
    // Load measures for this catalog version
    const [loadedMeasures, loadedRatings] = await Promise.all([
      $directus.request($readItems('measures', {
        filter: {
          catalog_version: { _eq: props.catalogVersion.id },
          status: { _eq: 'published' }
        },
        fields: ['id', 'name', 'description', 'sector', 'weight', 'choices_rating'],
        limit: -1
      })),
      $directus.request($readItems('ratings_measures', {
        filter: {
          localteam_id: { _eq: props.localteamId },
          measure_id: { catalog_version: { _eq: props.catalogVersion.id } }
        },
        fields: ['*', 'criteria_values.*'],
        limit: -1
      }))
    ]);
    
    measures.value = loadedMeasures || [];
    ratings.value = loadedRatings || [];
    
    // If ratings don't exist for all measures, we need to show them anyway
    const ratedMeasureIds = new Set(ratings.value.map(r => r.measure_id));
    for (const measure of measures.value) {
      if (!ratedMeasureIds.has(measure.id)) {
        // Create a placeholder rating entry
        ratings.value.push({
          id: `temp-${measure.id}`,
          measure_id: measure.id,
          rating: null,
          applicable: true,
          approved: false,
          status: 'draft'
        });
      }
    }
  } catch (err) {
    console.error('Failed to load edit mode data:', err);
  } finally {
    isLoading.value = false;
  }
}

// Initialize
onMounted(() => {
  if (props.initialRatings.length > 0) {
    ratings.value = [...props.initialRatings];
  }
  loadData();
});

// Watch for catalog version changes
watch(() => props.catalogVersion?.id, () => {
  loadData();
});
</script>

<style scoped>
.slide-enter-active,
.slide-leave-active {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.slide-enter-from,
.slide-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

.slide-enter-from .absolute,
.slide-leave-to .absolute {
  opacity: 0;
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>

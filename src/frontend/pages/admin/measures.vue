<template>
  <div class="min-h-screen bg-gray-50 flex">
    <!-- Sidebar -->
    <MeasuresSidebar
      :catalogs="catalogs"
      :selected-catalog-id="selectedCatalogId"
      :selected-sector="selectedSector"
      :selected-measure-id="selectedMeasureId"
      :measures-by-sector="measuresBySector"
      @select-catalog="handleSelectCatalog"
      @select-sector="handleSelectSector"
      @select-measure="handleSelectMeasure"
    />

    <!-- Main Content -->
    <div class="flex-1 overflow-auto">
      <!-- Header -->
      <header class="bg-white shadow sticky top-0 z-10">
        <div class="px-6 py-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-4">
              <NuxtLink to="/admin/catalogs" class="text-gray-500 hover:text-gray-700">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </NuxtLink>
              <div>
                <h1 class="text-xl font-bold text-gray-900">
                  {{ selectedCatalog?.name || 'Maßnahmen' }}
                </h1>
                <p v-if="selectedCatalog" class="text-sm text-gray-500">
                  {{ selectedCatalog.catalog_type === 'climate_mitigation' ? 'Klimaschutz' : 'Klimaanpassung' }}
                  <span v-if="selectedCatalog.version_number" class="ml-2">
                    v{{ selectedCatalog.version_number }}
                  </span>
                </p>
              </div>
            </div>
            
            <!-- Actions -->
            <div class="flex items-center gap-3">
              <button
                v-if="canEditMeasures && selectedCatalog"
                @click="showCreateMeasureModal = true"
                class="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
                Neue Maßnahme
              </button>
            </div>
          </div>

          <!-- Tab Bar -->
          <div class="flex items-center gap-1 mt-4 border-b border-gray-200 -mb-px">
            <button
              @click="activeTab = 'overview'"
              class="px-4 py-2 text-sm font-medium rounded-t-lg transition-colors"
              :class="activeTab === 'overview' 
                ? 'bg-white border border-b-white border-gray-200 text-green-600 -mb-px' 
                : 'text-gray-500 hover:text-gray-700'"
            >
              Übersicht
            </button>
            <button
              v-if="selectedSector"
              @click="activeTab = 'sector'"
              class="px-4 py-2 text-sm font-medium rounded-t-lg transition-colors"
              :class="activeTab === 'sector' 
                ? 'bg-white border border-b-white border-gray-200 text-green-600 -mb-px' 
                : 'text-gray-500 hover:text-gray-700'"
            >
              {{ $t(`sectors.${selectedSector}`) }}
            </button>
            <button
              v-if="selectedMeasure"
              @click="activeTab = 'measure'"
              class="px-4 py-2 text-sm font-medium rounded-t-lg transition-colors"
              :class="activeTab === 'measure' 
                ? 'bg-white border border-b-white border-gray-200 text-green-600 -mb-px' 
                : 'text-gray-500 hover:text-gray-700'"
            >
              {{ selectedMeasure.measure_id }}
            </button>
          </div>
        </div>
      </header>

      <!-- Content -->
      <main class="p-6">
        <!-- Loading Catalogs -->
        <div v-if="catalogsLoading || !initialLoadComplete" class="flex flex-col items-center justify-center py-12">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mb-4"></div>
          <p class="text-gray-500">Kataloge werden geladen...</p>
        </div>

        <!-- Error Loading Catalogs -->
        <div v-else-if="catalogsError" class="text-center py-12">
          <svg class="w-16 h-16 mx-auto text-red-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h3 class="text-lg font-medium text-gray-900 mb-2">Fehler beim Laden</h3>
          <p class="text-gray-500 mb-4">{{ catalogsError }}</p>
          <button @click="fetchCatalogs" class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
            Erneut versuchen
          </button>
        </div>

        <!-- No Catalogs Exist -->
        <div v-else-if="catalogs.length === 0" class="text-center py-12">
          <svg class="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <h3 class="text-lg font-medium text-gray-900 mb-2">Keine Kataloge vorhanden</h3>
          <p class="text-gray-500 mb-4">Erstellen Sie zuerst einen Maßnahmenkatalog.</p>
          <NuxtLink to="/admin/catalogs" class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 inline-flex items-center gap-2">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            Katalog erstellen
          </NuxtLink>
        </div>

        <!-- Loading Measures -->
        <div v-else-if="isLoading" class="flex justify-center py-12">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
        </div>

        <!-- No Catalog Selected -->
        <div v-else-if="!selectedCatalog" class="text-center py-12">
          <svg class="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 class="text-lg font-medium text-gray-900 mb-2">Kein Katalog ausgewählt</h3>
          <p class="text-gray-500">Wählen Sie einen Katalog in der Seitenleiste aus.</p>
        </div>

        <!-- Overview Tab -->
        <div v-else-if="activeTab === 'overview'" class="space-y-6">
          <!-- Catalog Info Card -->
          <div class="bg-white rounded-lg shadow-sm border p-6">
            <div class="flex items-start justify-between mb-4">
              <div>
                <h2 class="text-lg font-bold text-gray-900">{{ selectedCatalog.name }}</h2>
                <p v-if="selectedCatalog.description" class="text-gray-600 mt-1">
                  {{ selectedCatalog.description }}
                </p>
              </div>
              <div class="flex items-center gap-2">
                <span 
                  v-if="selectedCatalog.isCurrentFrontend"
                  class="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full"
                >
                  Frontend aktiv
                </span>
                <span 
                  v-if="selectedCatalog.isCurrentBackend"
                  class="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full"
                >
                  Backend aktiv
                </span>
                <span 
                  class="px-2 py-1 text-xs rounded-full"
                  :class="selectedCatalog.uses_structured_ratings 
                    ? 'bg-purple-100 text-purple-700' 
                    : 'bg-gray-100 text-gray-700'"
                >
                  {{ selectedCatalog.uses_structured_ratings ? 'Strukturiert' : 'Legacy' }}
                </span>
              </div>
            </div>
            
            <!-- Stats Grid -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t">
              <div>
                <div class="text-2xl font-bold text-gray-900">{{ measures.length }}</div>
                <div class="text-sm text-gray-500">Maßnahmen</div>
              </div>
              <div>
                <div class="text-2xl font-bold text-gray-900">{{ Object.keys(measuresBySector).length }}</div>
                <div class="text-sm text-gray-500">Sektoren</div>
              </div>
              <div>
                <div class="text-2xl font-bold text-gray-900">
                  {{ measures.filter(m => m.status === 'published').length }}
                </div>
                <div class="text-sm text-gray-500">Veröffentlicht</div>
              </div>
              <div>
                <div class="text-2xl font-bold text-gray-900">
                  {{ measures.filter(m => m.status === 'draft').length }}
                </div>
                <div class="text-sm text-gray-500">Entwürfe</div>
              </div>
            </div>
          </div>

          <!-- Sectors Grid -->
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div
              v-for="(sectorMeasures, sector) in measuresBySector"
              :key="sector"
              class="bg-white rounded-lg shadow-sm border p-4 hover:shadow-md transition-shadow cursor-pointer"
              @click="handleSelectSector(sector)"
            >
              <div class="flex items-center gap-3 mb-3">
                <img 
                  :src="sectorImages[sector]" 
                  :alt="sector"
                  class="w-10 h-10 opacity-70"
                />
                <h3 class="font-bold text-gray-900">{{ $t(`sectors.${sector}`) }}</h3>
              </div>
              <div class="flex items-center justify-between text-sm">
                <span class="text-gray-600">{{ sectorMeasures.length }} Maßnahmen</span>
                <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        <!-- Sector Tab -->
        <div v-else-if="activeTab === 'sector' && selectedSector" class="space-y-4">
          <div class="flex items-center gap-4 mb-6">
            <img 
              :src="sectorImages[selectedSector]" 
              :alt="selectedSector"
              class="w-16 h-16 opacity-70"
            />
            <div>
              <h2 class="text-xl font-bold text-gray-900">{{ $t(`sectors.${selectedSector}`) }}</h2>
              <p class="text-gray-600">
                {{ measuresBySector[selectedSector]?.length || 0 }} Maßnahmen in diesem Sektor
              </p>
            </div>
          </div>

          <!-- Measures List -->
          <div class="space-y-3">
            <MeasureListItem
              v-for="measure in measuresBySector[selectedSector]"
              :key="measure.id"
              :measure="measure"
              :can-edit="canEditMeasures"
              @click="handleSelectMeasure(measure)"
              @edit="handleEditMeasure(measure)"
            />
          </div>
        </div>

        <!-- Measure Tab -->
        <div v-else-if="activeTab === 'measure' && selectedMeasure">
          <MeasureDetailView
            :measure="selectedMeasure"
            :catalog="selectedCatalog"
            :can-edit="canEditMeasures"
            @updated="handleMeasureUpdated"
          />
        </div>
      </main>
    </div>

    <!-- Create Measure Modal -->
    <CreateMeasureModal
      v-if="showCreateMeasureModal"
      :catalog="selectedCatalog"
      :sectors="allSectors"
      @close="showCreateMeasureModal = false"
      @created="handleMeasureCreated"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useNuxtApp, useRuntimeConfig } from '#app';
import { createDirectus, rest, authentication, readItems } from '@directus/sdk';
import { useAuthStore } from '~/stores/auth';
import { usePermissions } from '~/composables/usePermissions';
import { useCatalogAdmin } from '~/composables/useCatalogAdmin';
import sectorImages from '~/shared/sectorImages.js';
import MeasuresSidebar from '~/components/admin/MeasuresSidebar.vue';
import MeasureListItem from '~/components/admin/MeasureListItem.vue';
import MeasureDetailView from '~/components/admin/MeasureDetailView.vue';
import CreateMeasureModal from '~/components/admin/CreateMeasureModal.vue';

const { $t } = useNuxtApp();
const route = useRoute();
const router = useRouter();
const config = useRuntimeConfig();
const authStore = useAuthStore();

const { canEditMeasures, canManageCatalogVersions } = usePermissions();
const { catalogs, fetchCatalogs, isLoading: catalogsLoading, error: catalogsError } = useCatalogAdmin();

/**
 * Create authenticated Directus client
 */
function createAuthenticatedClient() {
  const baseUrl = process.client 
    ? config.public.clientDirectusUrl 
    : config.public.serverDirectusUrl;
  
  const client = createDirectus(baseUrl || 'http://localhost:8055')
    .with(rest())
    .with(authentication('json'));
  
  // Add auth token for authenticated requests
  const token = authStore.accessToken?.value;
  if (token) {
    client.setToken(token);
  }
  
  return client;
}

// State
const measures = ref([]);
const isLoading = ref(false);
const activeTab = ref('overview');
const selectedCatalogId = ref(null);
const selectedSector = ref(null);
const selectedMeasureId = ref(null);
const showCreateMeasureModal = ref(false);
const initialLoadComplete = ref(false);

// All sectors
const allSectors = ['management', 'energy', 'transport', 'buildings', 'agriculture', 'industry'];

// Computed
const selectedCatalog = computed(() => {
  return catalogs.value.find(c => c.id === selectedCatalogId.value);
});

const selectedMeasure = computed(() => {
  return measures.value.find(m => m.id === selectedMeasureId.value);
});

const measuresBySector = computed(() => {
  const grouped = {};
  for (const measure of measures.value) {
    const sector = measure.sector || 'other';
    if (!grouped[sector]) {
      grouped[sector] = [];
    }
    grouped[sector].push(measure);
  }
  
  // Sort measures within each sector
  for (const sector in grouped) {
    grouped[sector].sort((a, b) => (a.measure_id || '').localeCompare(b.measure_id || ''));
  }
  
  return grouped;
});

// Load measures for selected catalog
async function loadMeasures() {
  if (!selectedCatalogId.value) {
    measures.value = [];
    return;
  }
  
  isLoading.value = true;
  
  try {
    const directus = createAuthenticatedClient();
    
    const result = await directus.request(
      readItems('measures', {
        filter: { catalog_version: { _eq: selectedCatalogId.value } },
        fields: [
          'id', 'measure_id', 'name', 'description', 'sector', 
          'status', 'weight', 'impact', 'feasibility', 'slug',
          'choices_rating', 'must_be_rated_again'
        ],
        sort: ['sector', 'measure_id'],
        limit: -1
      })
    );
    
    measures.value = result || [];
  } catch (err) {
    console.error('Error loading measures:', err);
    measures.value = [];
  } finally {
    isLoading.value = false;
  }
}

// Handlers
function handleSelectCatalog(catalogId) {
  selectedCatalogId.value = catalogId;
  selectedSector.value = null;
  selectedMeasureId.value = null;
  activeTab.value = 'overview';
  
  // Update URL
  router.replace({ query: { ...route.query, catalog: catalogId } });
}

function handleSelectSector(sector) {
  selectedSector.value = sector;
  selectedMeasureId.value = null;
  activeTab.value = 'sector';
}

function handleSelectMeasure(measure) {
  selectedMeasureId.value = measure.id;
  selectedSector.value = measure.sector;
  activeTab.value = 'measure';
}

function handleEditMeasure(measure) {
  selectedMeasureId.value = measure.id;
  activeTab.value = 'measure';
}

function handleMeasureCreated(measure) {
  showCreateMeasureModal.value = false;
  loadMeasures();
  handleSelectMeasure(measure);
}

function handleMeasureUpdated() {
  loadMeasures();
}

// Watch for catalog changes
watch(selectedCatalogId, () => {
  loadMeasures();
});

// Initialize
onMounted(async () => {
  try {
    await fetchCatalogs();
    
    // Check for catalog ID in URL
    if (route.query.catalog) {
      selectedCatalogId.value = route.query.catalog;
    } else if (catalogs.value.length > 0) {
      // Select first catalog
      selectedCatalogId.value = catalogs.value[0].id;
    }
  } catch (err) {
    console.error('Failed to load catalogs:', err);
  } finally {
    initialLoadComplete.value = true;
  }
});

// Page meta
useHead({
  title: 'Maßnahmen verwalten - Admin'
});
</script>

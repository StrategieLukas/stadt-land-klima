<template>
  <main class="px-4 py-8 max-w-7xl mx-auto w-full">
    <h1 class="text-center text-h1 font-bold mb-4">{{ $t("stats.title") }}</h1>
    <p class="text-center mt-4">Wähle eine Verwaltungsgliederung aus der Liste, um Statistiken zu sehen.</p>
    
    <div class="flex bg-blue-100 rounded-lg border-blue-600 drop-shadow-md border mt-4 p-4 justify-center">
      <AdministrativeAreaSearchBar
        base-path="/stats"
      />
    </div>

    <h2 class="mt-12 text-2xl font-bold text-center mb-6">Allgemeine Statistiken</h2>

    <!-- Catalog Version Dropdown -->
    <div class="flex justify-center mb-6">
      <div class="form-control w-full max-w-xs">
        <label class="label">
          <span class="font-semibold">Version des Maßnahmenkatalogs</span>
        </label>
        <select 
          v-model="selectedCatalogVersionId" 
          class="select select-bordered w-full max-w-xs"
          @change="onCatalogVersionChange"
        >
          <option 
            v-for="version in catalogVersions" 
            :key="version.id" 
            :value="version.id"
          >
            {{ version.name }}
          </option>
        </select>
      </div>
    </div>

    <!-- General Statistics Section -->
    <section v-if="generalStats">
      <div class="stats stats-vertical lg:stats-horizontal shadow w-full bg-white">
        <div class="stat place-items-center">
          <div class="stat-title">Kommunen gesamt</div>
          <div class="stat-value text-primary">{{ generalStats.totalMunicipalities }}</div>
          <div class="stat-desc">Im System erfasst</div>
        </div>
        
        <div class="stat place-items-center">
          <div class="stat-title">Bewertete Kommunen</div>
          <div class="stat-value text-secondary">{{ generalStats.ratedMunicipalities }}</div>
          <div class="stat-desc">Mit mindestens einer Bewertung</div>
        </div>
        
        <div class="stat place-items-center">
          <div class="stat-title">Vollständig bewertet</div>
          <div class="stat-value text-accent">{{ generalStats.completedMunicipalities }}</div>
          <div class="stat-desc">100% der Maßnahmen bewertet</div>
        </div>
      </div>
    </section>

    <!-- Measure Ratings by Sector Section -->
    <section v-if="sectorStats && sectorStats.length > 0" class="mt-12">
      <h2 class="text-2xl font-bold text-center mb-6">Maßnahmenbewertungen nach Sektoren</h2>
      <div class="space-y-12">
        <div v-for="sector in sectorStats" :key="sector.sectorKey" class="bg-white rounded-lg shadow-lg p-6">
          <h3 class="text-xl font-semibold mb-6">{{ sector.sectorName }}</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">
            <div 
              v-for="measure in Object.values(sector.measures)" 
              :key="measure.id"
              class="bg-gray-50 rounded-lg p-4 min-w-0"
            >
              <div class="flex items-center justify-between mb-3">
                <h4 class="text-sm font-medium text-center flex-1">{{ measure.name }}</h4>
                <NuxtLink 
                  :to="`/measures/sectors/${sector.sectorKey}?v=${selectedCatalogVersion.name}#measure-${measure.measure_id}`"
                  class="ml-2 p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded transition-colors"
                  :title="`Details zu ${measure.name} ansehen`"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </NuxtLink>
              </div>
              <div style="height: 180px;">
                <canvas :ref="el => { if (el) chartRefs[`${sector.sectorKey}_${measure.id}`] = el }"></canvas>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Modal for Municipality List -->
    <div v-if="showModal" class="modal modal-open">
      <div class="modal-box max-w-4xl">
        <h3 class="font-bold text-lg mb-4">
          {{ modalData.measureName }} - {{ getRatingLabel(modalData.rating) }}
        </h3>
        <div class="max-h-96 overflow-y-auto">
          <div class="flex flex-wrap gap-3">
            <div 
              v-for="mun in modalData.municipalities" 
              :key="mun.id" 
              class="min-w-0" 
              style="min-width: 200px;"
            >
              <NuxtLink 
                :to="`/municipalities/${mun.slug}?v=${selectedCatalogVersion.name}#measure-${modalData.measureId}`" 
                class="block p-3 hover:bg-gray-100 rounded border text-blue-600 hover:text-blue-800 transition-colors"
              >
                {{ mun.name }}
              </NuxtLink>
            </div>
          </div>
        </div>
        <div class="modal-action">
          <button class="btn" @click="closeModal">Schließen</button>
        </div>
      </div>
      <div class="modal-backdrop" @click="closeModal"></div>
    </div>
  </main>
</template>

<script setup>
import { ref, onMounted, computed, watch, nextTick } from 'vue';
import { Chart, BarController, BarElement, CategoryScale, LinearScale, Title, Tooltip, Legend } from 'chart.js';

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Title, Tooltip, Legend);

const { $t, $directus, $readItems } = useNuxtApp();
import { getCatalogVersion } from '~/composables/getCatalogVersion.js';
import { getAllCatalogVersions } from '~/composables/getAllCatalogVersions.js';

const route = useRoute();
const router = useRouter();
const selectedCatalogVersion = ref(await getCatalogVersion($directus, $readItems, route));
const selectedCatalogVersionId = ref(selectedCatalogVersion.value.id);

// Fetch all catalog versions for dropdown
const catalogVersions = ref(await getAllCatalogVersions($directus, $readItems));

const title = ref($t("stats.title"));
useHead({
  title,
});

const generalStats = ref(null);
const sectorStats = ref([]);
const chartRefs = ref({});
const chartInstances = {};
const showModal = ref(false);
const modalData = ref({ measureName: '', measureId: '', rating: null, municipalities: [] });

// Sector name mapping
const sectorNames = {
  energy: "Energie",
  transport: "Verkehr",
  agriculture: "Landwirtschaft, Natur & Ernährung",
  industry: "Industrie, Wirtschaft & Konsum",
  buildings: "Gebäude & Wärme",
  management: "Klimaschutzmanagement & Verwaltung",
};

// Rating colors matching the treemap
const ratingColors = {
  '-1': '#9CA3AF', // gray for unapplicable
  '0': '#D9000D',
  '0.25': '#F27C00',
  '0.5': '#FFD400',
  '0.75': '#AFCA0B',
  '1': '#1DA64A',
};

function getRatingLabel(rating) {
  const labels = {
    '-1': 'Nicht anwendbar',
    '0': 'Kaum/nicht',
    '0.25': 'Ansatzweise',
    '0.5': 'Halbwegs',
    '0.75': 'Größtenteils',
    '1': 'Vollständig',
  };
  
  // For beta catalog, '0.5' should not appear, but handle it gracefully
  if (rating === '0.5' && selectedCatalogVersion.value.name === 'beta') {
    return 'Unbekannt'; // Fallback, though this shouldn't happen
  }
  
  return labels[rating] || rating;
}

// Function to fetch data for a specific catalog version
async function fetchStatsForCatalog(catalogVersionId) {
  const [municipalities, municipalityScores, measures, ratings] = await Promise.all([
    $directus.request($readItems("municipalities", {
      fields: ["id", "name", "slug", "localteam_id"],
      limit: -1,
    })),
    $directus.request($readItems("municipality_scores", {
      fields: ["*", { municipality: ["id", "name", "slug", "localteam_id"] }],
      filter: { catalog_version: { _eq: catalogVersionId } },
      limit: -1,
    })),
    $directus.request($readItems("measures", {
      filter: { 
        catalog_version: { _eq: catalogVersionId }
      },
      limit: -1,
    })),
    $directus.request($readItems("ratings_measures", {
      fields: ["measure_id", "rating", "applicable", "localteam_id"],
      filter: { 
        measure_id: { 
          catalog_version: { _eq: catalogVersionId }
        }
      },
      limit: -1,
    })),
  ]);

  console.log("Fetched stats data:", { municipalities, municipalityScores, measures, ratings });

  return { municipalities, municipalityScores, measures, ratings };
}

// Initial data fetch
const statsData = ref(await fetchStatsForCatalog(selectedCatalogVersion.value.id));

// Function to process stats for current data
function processStats() {
  if (!statsData.value) return;
  
  const totalMunicipalities = statsData.value.municipalities.length;
  const ratedMunicipalities = statsData.value.municipalityScores.filter(s => s.percentage_rated > 0).length;
  const completedMunicipalities = statsData.value.municipalityScores.filter(s => s.percentage_rated >= 100).length;

  generalStats.value = {
    totalMunicipalities,
    ratedMunicipalities,
    completedMunicipalities,
  };

  // Create a map of localteam_id to municipality data - only for municipalities with >= 98% rating for bar plots
  const localteamToMunicipality = {};
  const municipalitiesForStats = statsData.value.municipalityScores.filter(s => s.percentage_rated >= 98);
  
  municipalitiesForStats.forEach(munScore => {
    const mun = munScore.municipality;
    if (mun && mun.localteam_id) {
      localteamToMunicipality[mun.localteam_id] = {
        id: mun.id,
        name: mun.name,
        slug: mun.slug,
      };
    }
  });

  // Calculate sector statistics
  const sectorData = {};
  
  statsData.value.measures.forEach(measure => {
    if (!sectorData[measure.sector]) {
      sectorData[measure.sector] = {
        sectorKey: measure.sector,
        sectorName: sectorNames[measure.sector] || measure.sector,
        measures: {},
        measureCount: 0,
      };
    }
    
    sectorData[measure.sector].measures[measure.id] = {
      id: measure.id,
      measure_id: measure.measure_id,
      name: measure.name,
      ratings: {
        '-1': [], // unapplicable
        '0': [],
        '0.25': [],
        '0.5': [],
        '0.75': [],
        '1': [],
      }
    };
    sectorData[measure.sector].measureCount++;
  });

  // Group ratings by measure and rating value - only include municipalities with >= 98% rating
  statsData.value.ratings.forEach(rating => {
    const measure = statsData.value.measures.find(m => m.id === rating.measure_id);
    if (!measure) return;
    
    const sector = sectorData[measure.sector];
    if (!sector || !sector.measures[measure.id]) return;
    
    let ratingKey;
    if (!rating.applicable) {
      ratingKey = '-1';
    } else if (rating.rating !== null) {
      ratingKey = String(rating.rating);
    } else {
      return; // Skip unrated
    }
    
    const municipality = localteamToMunicipality[rating.localteam_id];
    
    if (municipality && municipality.id && municipality.name && municipality.slug) {
      sector.measures[measure.id].ratings[ratingKey].push(municipality);
    }
  });

  sectorStats.value = Object.values(sectorData);
}

// Process initial stats
processStats();

// Handle catalog version change
async function onCatalogVersionChange() {
  const newVersion = catalogVersions.value.find(v => v.id === selectedCatalogVersionId.value);
  if (!newVersion) return;
  
  selectedCatalogVersion.value = newVersion;
  
  // Update URL
  router.replace({ query: { ...route.query, v: newVersion.name } });
  
  // Fetch new data
  statsData.value = await fetchStatsForCatalog(newVersion.id);
  
  // Reprocess stats
  processStats();
  
  // Destroy existing charts
  Object.values(chartInstances).forEach(chart => chart.destroy());
  
  // Recreate charts
  nextTick(() => {
    renderCharts();
  });
}

// Function to render charts
function renderCharts() {
  sectorStats.value.forEach(sector => {
    const measures = Object.values(sector.measures);
    
    // Calculate the maximum value across all measures in this sector for consistent scaling
    let maxValue = 0;
    measures.forEach(measure => {
      // Determine rating keys based on catalog version
      let ratingKeys;
      if (selectedCatalogVersion.value.name === 'beta') {
        ratingKeys = ['-1', '0', '0.25', '0.75', '1'];
      } else {
        ratingKeys = ['-1', '0', '0.25', '0.5', '0.75', '1'];
      }
      
      const measureMax = Math.max(...ratingKeys.map(key => measure.ratings[key].length));
      maxValue = Math.max(maxValue, measureMax);
    });
    
    // Add some padding to the max value (10% or minimum 1)
    const scalePadding = Math.max(1, Math.ceil(maxValue * 0.1));
    const scaleMax = maxValue + scalePadding;
    
    measures.forEach(measure => {
      const canvasKey = `${sector.sectorKey}_${measure.id}`;
      const canvas = chartRefs.value[canvasKey];
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      
      // Prepare data for this specific measure
      let ratingLabels, ratingKeys;
      
      // For beta catalog, exclude 0.5 (Halbwegs) rating
      if (selectedCatalogVersion.value.name === 'beta') {
        ratingLabels = ['Nicht anwendbar', 'Kaum/nicht', 'Ansatzweise', 'Größtenteils', 'Vollständig'];
        ratingKeys = ['-1', '0', '0.25', '0.75', '1'];
      } else {
        ratingLabels = ['Nicht anwendbar', 'Kaum/nicht', 'Ansatzweise', 'Halbwegs', 'Größtenteils', 'Vollständig'];
        ratingKeys = ['-1', '0', '0.25', '0.5', '0.75', '1'];
      }
      
      const data = ratingKeys.map(key => measure.ratings[key].length);
      const backgroundColors = ratingKeys.map(key => ratingColors[key]);
      
      chartInstances[canvasKey] = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: ratingLabels,
          datasets: [{
            data: data,
            backgroundColor: backgroundColors,
            borderWidth: 1,
            borderColor: '#ffffff'
          }]
        },
        options: {
          indexAxis: 'y', // This makes it a horizontal bar chart
          responsive: true,
          maintainAspectRatio: false,
          onClick: (event, elements) => {
            if (elements.length > 0) {
              const element = elements[0];
              const index = element.index;
              const ratingKey = ratingKeys[index];
              const municipalities = measure.ratings[ratingKey];
              
              if (municipalities.length > 0) {
                modalData.value = {
                  measureName: measure.name,
                  Id: measure.id,
                  measureId: measure.measure_id,
                  rating: ratingKey,
                  municipalities: municipalities
                };
                showModal.value = true;
              }
            }
          },
          plugins: {
            legend: {
              display: false
            },
            tooltip: {
              callbacks: {
                label: function(context) {
                  return `${context.label}: ${context.parsed.x} Kommunen`;
                }
              }
            }
          },
          scales: {
            x: {
              beginAtZero: true,
              max: scaleMax,
              ticks: {
                stepSize: 1
              },
              title: {
                display: true,
                text: 'Anzahl Kommunen'
              }
            },
            y: {
              ticks: {
                autoSkip: false,
                font: {
                  size: 10
                }
              }
            }
          }
        }
      });
    });
  });
}

// Create charts
onMounted(() => {
  nextTick(() => {
    renderCharts();
  });
});

function closeModal() {
  showModal.value = false;
  modalData.value = { measureName: '', measureId: '', rating: null, municipalities: [] };
}

// Cleanup charts on unmount
onBeforeUnmount(() => {
  Object.values(chartInstances).forEach(chart => chart.destroy());
});
</script>

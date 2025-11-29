<template>
  <main class="px-4 py-8 max-w-7xl mx-auto w-full">
    <h1 class="text-center text-h1 font-bold mb-4">{{ $t("stats.title") }}</h1>
    <p class="text-center mt-4">Wähle eine Verwaltungsgliederung aus der Liste, um Statistiken zu sehen.</p>
    <div class="flex bg-blue-100 rounded-lg border-blue-600 drop-shadow-md border mt-4 p-4 justify-center">
      <AdministrativeAreaSearchBar
        base-path="/stats"
      />
    </div>

    <!-- General Statistics Section -->
    <section v-if="generalStats" class="mt-12">
      <h2 class="text-2xl font-bold text-center mb-6">Allgemeine Statistiken</h2>
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
      <div class="space-y-8">
        <div v-for="sector in sectorStats" :key="sector.sectorKey" class="bg-white rounded-lg shadow-lg p-6">
          <h3 class="text-xl font-semibold mb-4">{{ sector.sectorName }}</h3>
          <div :style="{ height: Math.max(200, sector.measureCount * 40) + 'px' }">
            <canvas :ref="el => { if (el) chartRefs[sector.sectorKey] = el }"></canvas>
          </div>
        </div>
      </div>
    </section>

    <!-- Modal for Municipality List -->
    <div v-if="showModal" class="modal modal-open">
      <div class="modal-box max-w-2xl">
        <h3 class="font-bold text-lg mb-4">
          {{ modalData.measureName }} - {{ getRatingLabel(modalData.rating) }}
        </h3>
        <div class="max-h-96 overflow-y-auto">
          <ul class="space-y-2">
            <li v-for="mun in modalData.municipalities" :key="mun.id" class="p-2 hover:bg-gray-100 rounded">
              <NuxtLink :to="`/municipalities/${mun.slug}`" class="text-blue-600 hover:text-blue-800">
                {{ mun.name }}
              </NuxtLink>
            </li>
          </ul>
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
import { ref, onMounted, computed } from 'vue';
import { Chart, BarController, BarElement, CategoryScale, LinearScale, Title, Tooltip, Legend } from 'chart.js';

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Title, Tooltip, Legend);

const { $t, $directus, $readItems } = useNuxtApp();
import { getCatalogVersion } from '~/composables/getCatalogVersion.js';

const route = useRoute();
const selectedCatalogVersion = await getCatalogVersion($directus, $readItems, route);

const title = ref($t("stats.title"));
useHead({
  title,
});

const generalStats = ref(null);
const sectorStats = ref([]);
const chartRefs = ref({});
const chartInstances = {};
const showModal = ref(false);
const modalData = ref({ measureName: '', rating: null, municipalities: [] });

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
  return labels[rating] || rating;
}

// Fetch all data
const { data: statsData } = await useAsyncData(`stats_overview_${selectedCatalogVersion.id}`, async () => {
  const [municipalities, municipalityScores, measures, ratings] = await Promise.all([
    $directus.request($readItems("municipalities", {
      fields: ["id", "name", "slug", "localteam_id"],
      limit: -1,
    })),
    $directus.request($readItems("municipality_scores", {
      fields: ["*", { municipality: ["id", "name", "slug", "localteam_id"] }],
      filter: { catalog_version: { _eq: selectedCatalogVersion.id } },
      limit: -1,
    })),
    $directus.request($readItems("measures", {
      filter: { 
        catalog_version: { _eq: selectedCatalogVersion.id }
      },
      limit: -1,
    })),
    $directus.request($readItems("ratings_measures", {
      fields: ["measure_id", "rating", "applicable", "localteam_id"],
      filter: { 
        measure_id: { 
          catalog_version: { _eq: selectedCatalogVersion.id }
        }
      },
      limit: -1,
    })),
  ]);

  console.log("Fetched stats data:", { municipalities, municipalityScores, measures, ratings });

  return { municipalities, municipalityScores, measures, ratings };
});

// Calculate general statistics
if (statsData.value) {
  const totalMunicipalities = statsData.value.municipalities.length;
  const ratedMunicipalities = statsData.value.municipalityScores.filter(s => s.percentage_rated > 0).length;
  const completedMunicipalities = statsData.value.municipalityScores.filter(s => s.percentage_rated >= 100).length;

  generalStats.value = {
    totalMunicipalities,
    ratedMunicipalities,
    completedMunicipalities,
  };

  // Create a map of localteam_id to municipality data
  const localteamToMunicipality = {};
  statsData.value.municipalities.forEach(mun => {
    if (mun.localteam_id) {
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

  // Group ratings by measure and rating value
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

// Create charts
onMounted(() => {
  nextTick(() => {
    sectorStats.value.forEach(sector => {
      const canvas = chartRefs.value[sector.sectorKey];
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      
      // Prepare data for each measure
      const measures = Object.values(sector.measures);
      const datasets = [
        {
          label: 'Nicht anwendbar',
          data: measures.map(m => m.ratings['-1'].length),
          backgroundColor: ratingColors['-1'],
          measureData: measures.map(m => ({ measureName: m.name, rating: '-1', municipalities: m.ratings['-1'] })),
        },
        {
          label: 'Kaum/nicht',
          data: measures.map(m => m.ratings['0'].length),
          backgroundColor: ratingColors['0'],
          measureData: measures.map(m => ({ measureName: m.name, rating: '0', municipalities: m.ratings['0'] })),
        },
        {
          label: 'Ansatzweise',
          data: measures.map(m => m.ratings['0.25'].length),
          backgroundColor: ratingColors['0.25'],
          measureData: measures.map(m => ({ measureName: m.name, rating: '0.25', municipalities: m.ratings['0.25'] })),
        },
        {
          label: 'Halbwegs',
          data: measures.map(m => m.ratings['0.5'].length),
          backgroundColor: ratingColors['0.5'],
          measureData: measures.map(m => ({ measureName: m.name, rating: '0.5', municipalities: m.ratings['0.5'] })),
        },
        {
          label: 'Größtenteils',
          data: measures.map(m => m.ratings['0.75'].length),
          backgroundColor: ratingColors['0.75'],
          measureData: measures.map(m => ({ measureName: m.name, rating: '0.75', municipalities: m.ratings['0.75'] })),
        },
        {
          label: 'Vollständig',
          data: measures.map(m => m.ratings['1'].length),
          backgroundColor: ratingColors['1'],
          measureData: measures.map(m => ({ measureName: m.name, rating: '1', municipalities: m.ratings['1'] })),
        },
      ];

      chartInstances[sector.sectorKey] = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: measures.map(m => m.name),
          datasets: datasets,
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          onClick: (event, elements) => {
            if (elements.length > 0) {
              const element = elements[0];
              const datasetIndex = element.datasetIndex;
              const index = element.index;
              const dataset = datasets[datasetIndex];
              const measureInfo = dataset.measureData[index];
              
              if (measureInfo.municipalities.length > 0) {
                modalData.value = measureInfo;
                showModal.value = true;
              }
            }
          },
          indexAxis: 'y',
          plugins: {
            title: {
              display: false,
            },
            legend: {
              display: true,
              position: 'right',
            },
            tooltip: {
              callbacks: {
                label: function(context) {
                  return `${context.dataset.label}: ${context.parsed.x} Kommunen`;
                }
              }
            }
          },
          scales: {
            x: {
              stacked: true,
              beginAtZero: true,
              title: {
                display: true,
                text: 'Anzahl Kommunen'
              }
            },
            y: {
              stacked: true,
              ticks: {
                autoSkip: false,
              }
            }
          }
        }
      });
    });
  });
});

function closeModal() {
  showModal.value = false;
  modalData.value = { measureName: '', rating: null, municipalities: [] };
}

// Cleanup charts on unmount
onBeforeUnmount(() => {
  Object.values(chartInstances).forEach(chart => chart.destroy());
});
</script>

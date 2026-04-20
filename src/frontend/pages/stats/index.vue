<template>
  <main class="px-4 py-6 max-w-7xl mx-auto w-full">
    <!-- Search at page top -->
    <div class="mb-5">
      <AdministrativeAreaSearchBar base-path="/stats" />
    </div>

    <!-- Tabs -->
    <div class="flex border-b border-gray-200 mb-4 gap-1">
      <button
        class="px-4 py-2 text-sm font-semibold border-b-2 transition-colors"
        :class="activeTab === 'measures' ? 'border-gray-700 text-gray-800' : 'border-transparent text-gray-500 hover:text-gray-700'"
        @click="activeTab = 'measures'"
      >Maßnahmenstatistik</button>
      <button
        class="px-4 py-2 text-sm font-semibold border-b-2 transition-colors"
        :class="activeTab === 'clustering' ? 'border-gray-700 text-gray-800' : 'border-transparent text-gray-500 hover:text-gray-700'"
        @click="switchToClusteringTab"
      >Kommunen-Clustering</button>
      <button
        class="px-4 py-2 text-sm font-semibold border-b-2 transition-colors"
        :class="activeTab === 'dominance' ? 'border-gray-700 text-gray-800' : 'border-transparent text-gray-500 hover:text-gray-700'"
        @click="switchToDominanceTab"
      >Paarvergleich</button>
    </div>

    <!-- Filter Bar -->
    <section class="shadow-md flex flex-col gap-0 mb-6 p-3" style="background-color: #f2f2f2;">
      <!-- Row 0: catalog + type -->
      <div class="grid grid-cols-[1.5rem_1fr] gap-x-3 items-center py-1.5">
        <svg class="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <div class="flex flex-wrap gap-2 items-center">
          <button
            v-for="v in catalogVersions" :key="v.id"
            class="inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-bold transition-colors whitespace-nowrap"
            :class="selectedCatalogVersionId === v.id ? 'bg-gray-200 text-gray-800 border-gray-700' : 'bg-white text-gray-600 border-gray-400 hover:bg-gray-50'"
            @click="onCatalogVersionChange(v.id)"
          >{{ v.name }}</button>
          <div class="self-stretch w-px bg-gray-300 mx-1 hidden sm:block" />
          <button
            v-for="opt in typeOptions" :key="opt.value ?? 'alltype'"
            class="inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-bold transition-colors whitespace-nowrap"
            :class="filterType === opt.value ? 'bg-gray-200 text-gray-800 border-gray-700' : 'bg-white text-gray-600 border-gray-400 hover:bg-gray-50'"
            @click="filterType = opt.value"
          >{{ opt.label }}</button>
        </div>
      </div>

      <div class="border-t border-gray-300/60 my-0.5" />

      <!-- Row 1: state dropdown + count -->
      <div class="grid grid-cols-[1.5rem_1fr] gap-x-3 items-start py-1.5">
        <svg class="w-4 h-4 text-gray-500 flex-shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 01.707 1.707L14 12.414V19a1 1 0 01-1.447.894l-4-2A1 1 0 018 17v-4.586L3.293 5.707A1 1 0 013 5V4z" />
        </svg>
        <div class="flex flex-wrap gap-2 items-center">
          <FilterBadgeDropdown
            label="Alle Bundesländer"
            :options="availableStates.map(s => ({ label: s, value: s }))"
            v-model="filterState"
            width="min-w-[13rem]"
            active-color="#4B5563"
          />
          <span v-if="filteredMunScores.length" class="ml-auto text-xs text-gray-500 whitespace-nowrap">
            {{ filteredMunScores.length }} vollständig bewertete Kommunen
          </span>
        </div>
      </div>
    </section>

    <!-- KPI Row -->
    <section class="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3 mb-6">
      <div class="bg-white rounded-xl shadow p-4 flex flex-col items-center">
        <span class="text-3xl font-bold text-gray-600">{{ kpi.totalCompleted }}</span>
        <span class="text-xs text-gray-500 text-center mt-1">Vollständig bewertet</span>
      </div>
      <div class="bg-white rounded-xl shadow p-4 flex flex-col items-center">
        <span class="text-3xl font-bold text-gray-600">{{ kpi.totalHalfRatedProgress }}</span>
        <span class="text-xs text-gray-500 text-center mt-1">Bewertung in Bearbeitung</span>
      </div>
      <div class="bg-white rounded-xl shadow p-4 flex flex-col items-center">
        <span class="text-3xl font-bold text-gray-600">{{ kpi.totalMunicipalities }}</span>
        <span class="text-xs text-gray-500 text-center mt-1">Kommunen gesamt</span>
      </div>
      <div class="bg-white rounded-xl shadow p-4 flex flex-col items-center">
        <span class="text-3xl font-bold text-gray-600">{{ kpi.totalMeasures }}</span>
        <span class="text-xs text-gray-500 text-center mt-1">Maßnahmen im Katalog</span>
      </div>
      <div class="bg-white rounded-xl shadow p-4 flex flex-col items-center">
        <span class="text-3xl font-bold text-gray-600">{{ kpi.totalFilledRatings.toLocaleString('de-DE') }}</span>
        <span class="text-xs text-gray-500 text-center mt-1">Ausgefüllte Bewertungen</span>
      </div>
    </section>

    <!-- TAB: Maßnahmenstatistik -->
    <div v-show="activeTab === 'measures'">

      <!-- Main interactive panel: sunburst (left) + distribution chart (right) -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 items-stretch">

        <!-- Sunburst -->
        <div class="bg-white rounded-xl shadow-lg p-5 flex flex-col">
          <h2 class="text-base font-bold mb-0.5">Sektoren &amp; Maßnahmen</h2>
          <p class="text-xs text-gray-500 mb-3">Klick auf Sektor oder Maßnahme für Details →</p>
          <!-- Sunburst container -->
          <div style="height: 420px;">
            <div ref="sunburstContainer" class="w-full h-full"></div>
          </div>
          <!-- Clear selection button -->
          <div class="mt-3 flex justify-center items-center gap-2">
            <template v-if="sunburstSelection.label">
              <button
                class="text-xs text-gray-400 hover:text-gray-600 px-1"
                title="Zurück (←)"
                @click="navigateSunburstSelection(-1)"
              >◀</button>
              <button
                class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border-2 border-blue-600 text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
                @click="clearSunburstSelection"
              >
                <span>{{ sunburstSelection.type === 'sector' ? 'Sektor' : 'Maßnahme' }}: {{ sunburstSelection.label }}</span>
                <span class="font-bold text-sm leading-none">×</span>
              </button>
              <button
                class="text-xs text-gray-400 hover:text-gray-600 px-1"
                title="Vorwärts (→)"
                @click="navigateSunburstSelection(1)"
              >▶</button>
            </template>
            <span v-else class="text-xs text-gray-400">Klick auf Ring für Details</span>
          </div>
        </div>

        <!-- Distribution chart card -->
        <div class="bg-white rounded-xl shadow-lg p-5 flex flex-col">
          <h2 class="text-base font-bold mb-0.5">
            <span v-if="!sunburstSelection.type">Score-Verteilung: alle Kommunen</span>
            <span v-else-if="sunburstSelection.type === 'sector'">Sektor: {{ sunburstSelection.label }}</span>
            <span v-else>Maßnahme: {{ sunburstSelection.label }}</span>
          </h2>
          <p class="text-xs text-gray-500 mb-3">
            <span v-if="!sunburstSelection.type">Gesamtscore vollständig bewerteter Kommunen</span>
            <span v-else-if="sunburstSelection.type === 'sector'">Score-Verteilung {{ shortSectorNames[sunburstSelection.sectorKey] ?? sunburstSelection.sectorKey }}</span>
            <span v-else>Bewertungsverteilung</span>
          </p>
          <div ref="distPanelContainer" class="w-full flex-1" style="min-height: 360px;"></div>
          <!-- Selection marker, matching sunburst badge style -->
          <div class="mt-3 flex justify-center items-center gap-2">
            <template v-if="panelMunFilter.active">
              <button
                class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border-2 border-blue-600 text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
                @click="clearPanelMunFilter"
              >
                <span>{{ panelMunFilter.label }}</span>
                <span class="font-bold text-sm leading-none">×</span>
              </button>
            </template>
            <span v-else-if="sunburstSelection.type" class="text-xs text-gray-400">Klick auf Balken für Details</span>
          </div>
        </div>

      </div><!-- /top row -->

      <!-- Municipality list card -->
      <div class="bg-white rounded-xl shadow-lg p-5 mb-8">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-base font-semibold text-gray-800">
            <span v-if="!panelMunFilter.active">
              Top 10<span v-if="sunburstSelection.label">: {{ sunburstSelection.label }}</span><span v-else> Kommunen</span>
            </span>
            <span v-else>Kommunen mit „{{ panelMunFilter.label }}"</span>
          </h3>
          <button
            v-if="panelMunFilter.active"
            class="text-xs text-blue-600 hover:underline"
            @click="clearPanelMunFilter"
          >× Filter aufheben</button>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8">
          <div
            v-for="(ms, i) in panelMunicipalities"
            :key="ms.id ?? ms.slug ?? i"
            class="flex items-center gap-3 py-1.5 border-b border-gray-100 last:border-0"
          >
            <span v-if="!panelMunFilter.active" class="text-xs font-bold text-gray-400 w-5 text-right flex-shrink-0">{{ i + 1 }}</span>
            <NuxtLink
              :to="ms.slug ? `/municipalities/${ms.slug}` : '#'"
              class="flex-1 text-sm text-blue-600 hover:text-blue-800 hover:underline truncate"
            >{{ ms.name }}</NuxtLink>
            <span
              v-if="ms.score_total != null"
              class="text-xs font-bold px-2 py-0.5 rounded-full text-white flex-shrink-0"
              :style="{ background: ratingToColor(parseFloat(ms.score_total) / 100) }"
            >{{ parseFloat(ms.score_total).toFixed(1) }}</span>
          </div>
          <p v-if="!panelMunicipalities.length" class="text-xs text-gray-400 py-2 col-span-full">Keine Daten</p>
        </div>
      </div>

    </div><!-- end tab: measures -->

    <!-- TAB: Kommunen-Clustering -->
    <div v-show="activeTab === 'clustering'">
      <div class="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 mb-8 items-start">

        <!-- Scatter plot -->
        <div class="bg-white rounded-xl shadow-lg p-6">
          <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-2">
            <div>
              <h2 class="text-xl font-bold">Kommunen-Clustering</h2>
              <p class="text-sm text-gray-500 mt-1">Klick auf einen Punkt für das Cluster-Profil →</p>
            </div>
            <div class="flex items-center gap-3 flex-shrink-0">
              <label class="text-sm font-semibold whitespace-nowrap">k =</label>
              <input v-model.number="kClusters" type="range" min="2" max="10" class="range range-sm w-28" />
              <span class="font-bold w-4 text-sm">{{ kClusters }}</span>
              <button class="btn btn-sm btn-outline ml-2" @click="computeClusteringAndRender">Analyse starten</button>
            </div>
          </div>
          <!-- Methodology note -->
          <div class="text-xs text-gray-400 mb-3 leading-relaxed">
            Jede Kommune wird durch ihre Einzelmaßnahmen-Bewertungen beschrieben (0 = kaum/nicht, 1 = vollständig; N/A und fehlende Bewertungen = 0). PCA reduziert diese hochdimensionalen Vektoren auf zwei Hauptkomponenten (PC1/PC2), die den größten Teil der Varianz erklären. k-Means gruppiert dann ähnliche Kommunen. <strong>Was lässt sich ablesen?</strong> Kommunen, die im Diagramm nah beieinander liegen, haben ein ähnliches Stärken-/Schwächen-Profil über alle Maßnahmen. Das Cluster-Profil rechts zeigt die Ø-Sektorscores des angeklickten Clusters.
          </div>
          <div ref="clusterContainer" class="w-full" style="min-height: 100px;"></div>
          <p v-if="clusteringError" class="text-error text-sm mt-2">{{ clusteringError }}</p>
        </div>

        <!-- Cluster profile panel -->
        <div class="bg-white rounded-xl shadow-lg p-5">
          <h3 class="text-base font-bold mb-3">
            <span v-if="!clusterProfile.clusterLabel">Cluster-Profil</span>
            <span v-else>{{ clusterProfile.clusterLabel }}</span>
          </h3>
          <p v-if="!clusterProfile.clusterLabel" class="text-sm text-gray-400">Klicke auf einen Punkt im Diagramm, um das Cluster-Profil zu sehen.</p>
          <template v-else>
            <p class="text-xs text-gray-500 mb-3">{{ clusterProfile.count }} Kommunen · Ø Gesamtscore: <strong>{{ clusterProfile.avgTotal }}</strong></p>
            <div class="flex flex-col gap-2 mb-4">
              <div v-for="sector in sectorOrder" :key="sector" class="flex items-center gap-2">
                <span class="text-xs w-24 text-right flex-shrink-0 truncate" :style="{ color: sectorColors[sector] }">{{ shortSectorNames[sector] }}</span>
                <div class="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                  <div
                    class="h-3 rounded-full transition-all"
                    :style="{ width: `${Math.min(100, clusterProfile.sectorMeans[sector] ?? 0)}%`, background: sectorColors[sector] }"
                  ></div>
                </div>
                <span class="text-xs font-mono w-10 flex-shrink-0">{{ (clusterProfile.sectorMeans[sector] ?? 0).toFixed(1) }}</span>
              </div>
            </div>
            <div class="border-t pt-3">
              <p class="text-xs font-semibold text-gray-600 mb-2">Kommunen in diesem Cluster:</p>
              <div class="columns-2 gap-x-3">
                <NuxtLink
                  v-for="m in clusterProfile.municipalities"
                  :key="m.slug"
                  :to="`/municipalities/${m.slug}`"
                  class="block text-xs text-blue-600 hover:underline py-0.5 truncate"
                >{{ m.name }}</NuxtLink>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div><!-- end tab: clustering -->

    <!-- TAB: Paarweiser Vergleich -->
    <div v-show="activeTab === 'dominance'">

      <!-- Method description -->
      <div class="bg-white rounded-xl shadow-lg p-5 mb-6">
        <h2 class="text-base font-bold mb-2">Paarweiser Vergleich (Dominanz-Analyse)</h2>
        <p class="text-sm text-gray-600 leading-relaxed mb-2">
          Für jede Maßnahme wird paarweise verglichen, welche Kommune besser abgeschnitten hat.
          Aus allen Einzelvergleichen wird eine <strong>Gewinnrate</strong> pro Kommune ermittelt
          – der Anteil der Matchups, den sie für sich entschieden hat. Das Ergebnis ist robuster als
          ein einfacher Gesamtscore, weil es die Stärke über viele unabhängige Kategorien widerspiegelt.
        </p>
        <p class="text-sm text-gray-600 leading-relaxed mb-2">
          Die <strong>Dominanzmatrix</strong> zeigt für jedes Paar (Zeile vs. Spalte), wie oft die
          Zeilen-Kommune die Spalten-Kommune übertroffen hat. Diagonal angeordnete blaue Blöcke deuten
          auf Cluster ähnlich starker Kommunen hin – sogenannte Leistungs-„Tiers". Die Matrix ist
          nach Gewinnrate sortiert (oben = stärkste Kommunen).
        </p>
        <p class="text-xs text-gray-400 mb-3">Nur Kommunen im aktuellen Filter. Nicht-anwendbare Maßnahmen werden aus dem Vergleich ausgeschlossen.</p>
        <button class="btn btn-sm btn-outline" @click="computeDominanceAndRender">Analyse starten</button>
      </div>

      <!-- Win rate ranking chart -->
      <div class="bg-white rounded-xl shadow-lg p-5 mb-6">
        <h3 class="text-sm font-bold mb-1">Gewinnrate-Ranking</h3>
        <p class="text-xs text-gray-500 mb-3">Anteil der paarweisen Maßnahmen-Vergleiche, die eine Kommune gewonnen hat</p>
        <div ref="dominanceRankContainer" class="w-full" style="min-height: 60px;"></div>
        <p v-if="dominanceError" class="text-error text-sm mt-2">{{ dominanceError }}</p>
      </div>

      <!-- Dominance heatmap -->
      <div class="bg-white rounded-xl shadow-lg p-5 mb-8">
        <h3 class="text-sm font-bold mb-1">Dominanzmatrix (Top 40)</h3>
        <p class="text-xs text-gray-500 mb-3">Wie oft gewinnt Zeilen-Kommune gegen Spalten-Kommune. Blau = gewinnt, Rot = verliert, Grau = gleichauf</p>
        <div ref="dominanceHeatmapContainer" class="w-full overflow-x-auto" style="min-height: 60px;"></div>
      </div>

      <!-- Force-directed dominance network -->
      <div class="bg-white rounded-xl shadow-lg p-5 mb-8">
        <h3 class="text-sm font-bold mb-1">Dominanz-Netzwerk</h3>
        <p class="text-xs text-gray-500 mb-2">Alle Kommunen als Knoten. Eine Kante zwischen zwei Knoten bedeutet, dass eine Kommune die andere in &gt; 60% der gemeinsam bewerteten Maßnahmen übertrifft. Knotengröße und -farbe nach Gewinnrate.</p>
        <p class="text-xs text-gray-400 mb-3"><strong>Nähe</strong> = Kommunen sind durch eine Dominanzkante direkt verbunden und werden zusammengezogen (Federkraft). <strong>Distanz</strong> = keine direkte Kante → Abstoßung dominiert. Cluster aus eng beieinander liegenden Knoten sind Leistungs-„Tiers", in denen sich Kommunen gegenseitig ähnlich stark übertreffen oder auf Augenhöhe sind.</p>
        <div ref="dominanceForceContainer" class="w-full" style="min-height: 700px;"></div>
      </div>

    </div><!-- end tab: dominance -->
  </main>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import {
  Chart,
  BarController, BarElement,
  CategoryScale, LinearScale,
  Title, Tooltip, Legend,
} from 'chart.js';

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Title, Tooltip, Legend);

const { $t, $directus, $readItems } = useNuxtApp();
import { getCatalogVersion } from '~/composables/getCatalogVersion.js';
import { getAllCatalogVersions } from '~/composables/getAllCatalogVersions.js';
import sectorImages from '~/shared/sectorImages.js';

const route = useRoute();
const router = useRouter();
const selectedCatalogVersion = ref(await getCatalogVersion($directus, $readItems, route));
const selectedCatalogVersionId = ref(selectedCatalogVersion.value.id);
const catalogVersions = ref(await getAllCatalogVersions($directus, $readItems));

useHead({ title: ref($t('stats.title')) });

// ── Filter state ─────────────────────────────────────────────────────────────
const filterState = ref(null);
const filterType = ref(null);
const typeOptions = [
  { label: 'Alle Kommunen', value: null },
  { label: 'Großstädte', value: 'big_city' },
  { label: 'Kleinstädte', value: 'small_city' },
];

// ── Chart/UI state ────────────────────────────────────────────────────────────
// sectorStats is a computed so it reacts to filterState / filterType changes.
// It uses filteredMunScores (already honours all active filters) to populate
// the per-measure rating buckets shown in the distribution panel.
const sectorStats = computed(() => {
  if (!statsData.value) return [];
  const { measures, ratings } = statsData.value;

  // Build localteam → municipality map from FILTERED completed scores only
  const localteamToMunicipality = {};
  filteredMunScores.value.forEach(ms => {
    const mun = ms.municipality;
    if (mun?.localteam_id) localteamToMunicipality[mun.localteam_id] = { id: mun.id, name: mun.name, slug: mun.slug };
  });

  const sectorData = {};
  measures.forEach(measure => {
    if (!sectorData[measure.sector]) {
      sectorData[measure.sector] = {
        sectorKey: measure.sector,
        sectorName: sectorNames[measure.sector] || measure.sector,
        measures: {},
      };
    }
    sectorData[measure.sector].measures[measure.id] = {
      id: measure.id,
      measure_id: measure.measure_id,
      name: measure.name,
      slug: measure.slug,
      ratings: { '-1': [], '0': [], '0.25': [], '0.5': [], '0.75': [], '1': [] },
    };
  });

  ratings.forEach(r => {
    const measure = measures.find(m => m.id === r.measure_id);
    if (!measure) return;
    const sector = sectorData[measure.sector];
    if (!sector?.measures[measure.id]) return;
    const rk = !r.applicable ? '-1' : r.rating !== null ? String(r.rating) : null;
    if (rk === null) return;
    const mun = localteamToMunicipality[r.localteam_id];
    if (mun) sector.measures[measure.id].ratings[rk].push(mun);
  });

  return Object.values(sectorData);
});

const sunburstContainer = ref(null);
const distPanelContainer = ref(null);
let vegaViewSunburst = null;
let vegaViewDist = null;
const clusterContainer = ref(null);
let vegaViewCluster = null;

const dominanceRankContainer = ref(null);
const dominanceHeatmapContainer = ref(null);
const dominanceError = ref('');
let vegaViewDominance = null;
let vegaViewDominanceHeatmap = null;
const dominanceForceContainer = ref(null);
let vegaViewDominanceForce = null;

const kClusters = ref(4);
const clusteringError = ref('');
const activeSectorFilter = ref('all');
const activeTab = ref('measures');

// Sunburst selection state
const sunburstSelection = ref({ type: null, sectorKey: null, measureId: null, label: '' });
// Municipality panel filter (set when user clicks a bar in the distribution)
const panelMunFilter = ref({ active: false, label: '', type: null, measureId: null, ratingKey: null, sectorKey: null, binRange: null });
// Cluster profile panel
const clusterProfile = ref({ clusterLabel: null, count: 0, avgTotal: '–', sectorMeans: {}, municipalities: [] });
// Raw cluster data for profile lookup (populated after computeClusteringAndRender)
const clusterData = ref([]);

// ── Constants ────────────────────────────────────────────────────────────────
const sectorOrder = ['energy', 'transport', 'agriculture', 'industry', 'buildings', 'management'];

const sectorNames = {
  energy: 'Energie',
  transport: 'Verkehr',
  agriculture: 'Landwirtschaft, Natur & Ernährung',
  industry: 'Industrie, Wirtschaft & Konsum',
  buildings: 'Gebäude & Wärme',
  management: 'Klimaschutzmanagement & Verwaltung',
};

const shortSectorNames = {
  energy: 'Energie',
  transport: 'Verkehr',
  agriculture: 'Landwirtschaft',
  industry: 'Industrie',
  buildings: 'Gebäude',
  management: 'Management',
};

const sectorColors = {
  energy: '#F39200',
  transport: '#16BAE7',
  agriculture: '#1EA64A',
  industry: '#6B4C9A',
  buildings: '#E30613',
  management: '#AFCA0B',
};

const ratingColors = {
  '-1': '#9CA3AF',
  '0':  '#D9000D',
  '0.25': '#F27C00',
  '0.5':  '#FFD400',
  '0.75': '#AFCA0B',
  '1':    '#1DA64A',
};

const ratingLabelsMap = {
  '-1': 'Nicht anwendbar',
  '0':  'Kaum/nicht',
  '0.25': 'Ansatzweise',
  '0.5':  'Halbwegs',
  '0.75': 'Größtenteils',
  '1':    'Vollständig',
};

function getRatingKeys() {
  return selectedCatalogVersion.value.name === 'beta'
    ? ['-1', '0', '0.25', '0.75', '1']
    : ['-1', '0', '0.25', '0.5', '0.75', '1'];
}

function getRatingLabel(rating) {
  return ratingLabelsMap[rating] ?? rating;
}

const vegaColorScale = {
  domain: [-0.1, 0, 0.25, 0.5, 0.75, 1.0],
  range: ['#9CA3AF', '#D9000D', '#F27C00', '#FFD400', '#AFCA0B', '#1DA64A'],
};

function ratingToColor(r) {
  if (r == null || isNaN(r)) return '#9CA3AF';
  const stops = [
    [0, [217, 0, 13]],
    [0.25, [242, 124, 0]],
    [0.5, [255, 212, 0]],
    [0.75, [175, 202, 11]],
    [1, [29, 166, 74]],
  ];
  const clamped = Math.max(0, Math.min(1, r));
  for (let i = 0; i < stops.length - 1; i++) {
    const [t0, c0] = stops[i];
    const [t1, c1] = stops[i + 1];
    if (clamped <= t1) {
      const t = (clamped - t0) / (t1 - t0);
      return `rgb(${Math.round(c0[0] + t * (c1[0] - c0[0]))},${Math.round(c0[1] + t * (c1[1] - c0[1]))},${Math.round(c0[2] + t * (c1[2] - c0[2]))})`;
    }
  }
  return '#1DA64A';
}

function meanSectorScore(sectorKey) {
  const scores = filteredMunScores.value
    .map(ms => parseFloat(ms[`score_${sectorKey}`]))
    .filter(v => !isNaN(v));
  if (!scores.length) return null;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

// ── Computed ─────────────────────────────────────────────────────────────────
const visibleMunicipalityScores = computed(() => {
  if (!statsData.value) return [];
  return statsData.value.municipalityScores.filter(ms => {
    if (!ms.municipality || ms.municipality.status !== 'published') return false;
    if (filterState.value && ms.municipality.state !== filterState.value) return false;
    if (filterType.value && ms.municipality.municipality_type !== filterType.value) return false;
    return true;
  });
});

const filteredMunScores = computed(() =>
  visibleMunicipalityScores.value.filter(ms => parseFloat(ms.percentage_rated) >= 98),
);

const availableStates = computed(() => {
  if (!statsData.value) return [];
  const states = new Set();
  statsData.value.municipalityScores.forEach(ms => {
    if (ms.municipality?.state) states.add(ms.municipality.state);
  });
  return [...states].sort();
});

const kpi = computed(() => {
  if (!statsData.value) {
    return { totalCompleted: 0, totalHalfRatedProgress: 0, totalMunicipalities: 0, totalMeasures: 0, totalFilledRatings: 0 };
  }
  const { municipalities, measures, ratings } = statsData.value;
  const completed = filteredMunScores.value;
  const halfRatedProgress = visibleMunicipalityScores.value.filter(ms => {
    const percentage = parseFloat(ms.percentage_rated);
    return !isNaN(percentage) && percentage >= 1 && percentage < 98;
  });
  // Count ratings that are filled (rating != null OR applicable == false) for completed municipalities
  const ltSet = new Set();
  completed.forEach(ms => { if (ms.municipality?.localteam_id) ltSet.add(ms.municipality.localteam_id); });
  const filledRatings = ratings.filter(r => ltSet.has(r.localteam_id) && (r.rating != null || r.applicable === false)).length;
  return {
    totalCompleted: completed.length,
    totalHalfRatedProgress: halfRatedProgress.length,
    totalMunicipalities: municipalities.length,
    totalMeasures: measures.length,
    totalFilledRatings: filledRatings,
  };
});

const top10 = computed(() => {
  const sel = sunburstSelection.value;
  if (sel.type === 'sector' && sel.sectorKey) {
    const scoreField = `score_${sel.sectorKey}`;
    return [...filteredMunScores.value]
      .map(ms => {
        const v = parseFloat(ms[scoreField]);
        return { id: ms.municipality?.id, name: ms.municipality?.name, slug: ms.municipality?.slug, score_total: isNaN(v) ? null : v };
      })
      .filter(ms => ms.score_total != null)
      .sort((a, b) => b.score_total - a.score_total)
      .slice(0, 10);
  }
  if (sel.type === 'measure' && sel.measureId) {
    const ratingByLtId = new Map();
    statsData.value?.ratings?.forEach(r => {
      if (r.measure_id === sel.measureId && r.applicable !== false && r.rating != null)
        ratingByLtId.set(r.localteam_id, parseFloat(r.rating));
    });
    return [...filteredMunScores.value]
      .filter(ms => ms.municipality?.localteam_id && ratingByLtId.has(ms.municipality.localteam_id))
      .map(ms => {
        const v = ratingByLtId.get(ms.municipality.localteam_id);
        return { id: ms.municipality?.id, name: ms.municipality?.name, slug: ms.municipality?.slug, score_total: v * 100 };
      })
      .sort((a, b) => b.score_total - a.score_total)
      .slice(0, 10);
  }
  return [...filteredMunScores.value]
    .filter(ms => ms.score_total != null)
    .map(ms => ({ id: ms.municipality?.id, name: ms.municipality?.name, slug: ms.municipality?.slug, score_total: parseFloat(ms.score_total) }))
    .filter(ms => !isNaN(ms.score_total))
    .sort((a, b) => b.score_total - a.score_total)
    .slice(0, 10);
});

// Municipality list shown in the detail panel — re-derives reactively from filteredMunScores
const panelMunicipalities = computed(() => {
  if (!panelMunFilter.value.active) return top10.value;
  const { type, measureId, ratingKey, sectorKey, binRange } = panelMunFilter.value;
  if (type === 'measure-rating' && measureId != null && ratingKey != null) {
    const filteredMunIds = new Set(filteredMunScores.value.filter(ms => ms.municipality?.id).map(ms => ms.municipality.id));
    for (const sector of sectorStats.value) {
      const m = sector.measures?.[measureId];
      if (m) return (m.ratings[ratingKey] ?? []).filter(mun => filteredMunIds.has(mun.id));
    }
    return [];
  }
  if (type === 'sector-bin' && sectorKey && binRange) {
    const [bin0, bin1] = binRange;
    return filteredMunScores.value
      .filter(ms => { const s = parseFloat(ms[`score_${sectorKey}`]); return !isNaN(s) && s >= bin0 && s < bin1 + 0.0001; })
      .map(ms => ({ id: ms.municipality?.id, name: ms.municipality?.name, slug: ms.municipality?.slug, score_total: parseFloat(ms[`score_${sectorKey}`]) }));
  }
  return top10.value;
});

const meanMeasureRatings = computed(() => {
  if (!statsData.value) return new Map();
  const { ratings, measures } = statsData.value;
  const completed = filteredMunScores.value;
  if (!completed.length) return new Map();
  const ltSet = new Set();
  completed.forEach(ms => { if (ms.municipality?.localteam_id) ltSet.add(ms.municipality.localteam_id); });
  const sums = new Map();
  const counts = new Map();
  ratings.forEach(r => {
    if (!ltSet.has(r.localteam_id)) return;
    if (!r.applicable) return;
    if (r.rating == null) return;
    const val = parseFloat(r.rating);
    if (isNaN(val)) return;
    const mid = r.measure_id;
    sums.set(mid, (sums.get(mid) ?? 0) + val);
    counts.set(mid, (counts.get(mid) ?? 0) + 1);
  });
  const result = new Map();
  measures.forEach(m => {
    const s = sums.get(m.id);
    const c = counts.get(m.id);
    result.set(m.id, c ? s / c : null);
  });
  return result;
});

const filteredSectorStats = computed(() => {
  const ordered = sectorOrder
    .map(k => sectorStats.value.find(s => s.sectorKey === k))
    .filter(Boolean);
  if (activeSectorFilter.value === 'all') return ordered;
  return ordered.filter(s => s.sectorKey === activeSectorFilter.value);
});

// ── Data fetching ────────────────────────────────────────────────────────────
async function fetchStatsForCatalog(catalogVersionId) {
  const [municipalities, municipalityScores, measures, ratings] = await Promise.all([
    $directus.request($readItems('municipalities', { fields: ['id', 'name', 'slug', 'localteam_id', 'population'], limit: -1 })),
    $directus.request($readItems('municipality_scores', {
      fields: ['*', { municipality: ['id', 'name', 'slug', 'localteam_id', 'status', 'state', 'municipality_type', 'population'] }],
      filter: { catalog_version: { _eq: catalogVersionId } },
      limit: -1,
    })),
    $directus.request($readItems('measures', {
      filter: { catalog_version: { _eq: catalogVersionId } },
      limit: -1,
    })),
    $directus.request($readItems('ratings_measures', {
      fields: ['measure_id', 'rating', 'applicable', 'localteam_id'],
      filter: { measure_id: { catalog_version: { _eq: catalogVersionId } } },
      limit: -1,
    })),
  ]);
  return { municipalities, municipalityScores, measures, ratings };
}

const statsData = ref(await fetchStatsForCatalog(selectedCatalogVersion.value.id));

// ── Sunburst (Vega-Lite two-layer arc) ───────────────────────────────────────
async function renderSunburst() {
  if (!sunburstContainer.value) return;
  try {
    const { default: vegaEmbed } = await import('vega-embed');
    if (vegaViewSunburst) { vegaViewSunburst.finalize(); vegaViewSunburst = null; }
    sunburstContainer.value.innerHTML = '';
    if (!statsData.value?.measures?.length) return;
    const { measures } = statsData.value;
    const mmr = meanMeasureRatings.value;
    const innerRows = [];
    const outerRows = [];
    sectorOrder.forEach((sKey, si) => {
      const sector = sectorStats.value.find(s => s.sectorKey === sKey);
      if (!sector) return;
      const sectorMeasures = measures.filter(m => m.sector === sKey);
      if (!sectorMeasures.length) return;
      const measureMeans = sectorMeasures.map(m => mmr.get(m.id)).filter(v => v != null);
      const sectorMeanRating = measureMeans.length
        ? measureMeans.reduce((a, b) => a + b, 0) / measureMeans.length
        : null;
      // inner ring theta = sum of weights for this sector (proportional to total weight)
      const sectorWeight = sectorMeasures.reduce((s, m) => s + parseFloat(m.weight ?? 1), 0);
      innerRows.push({
        name: shortSectorNames[sKey] ?? sKey,
        theta: sectorWeight,
        meanRating: sectorMeanRating ?? -0.05,
        order: si,
        sectorKey: sKey,
      });
      sectorMeasures.forEach((m, mi) => {
        const mr = mmr.get(m.id);
        outerRows.push({
          name: m.name,
          sectorName: sectorNames[sKey] ?? sKey,
          theta: parseFloat(m.weight ?? 1),
          meanRatingDisplay: mr ?? -0.05,
          meanRating: mr,
          order: si * 1000 + mi,
          measureId: m.id,
          sectorKey: sKey,
        });
      });
    });
    const sel = sunburstSelection.value;
    const spec = {
      $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
      width: 'container',
      height: 360,
      view: { stroke: null },
      layer: [
        // Inner ring (sectors) — white separators
        {
          data: { values: innerRows },
          mark: { type: 'arc', innerRadius: 55, outerRadius: 118, stroke: 'white', strokeWidth: 1.5 },
          encoding: {
            theta: { field: 'theta', type: 'quantitative', stack: true },
            color: { field: 'meanRating', type: 'quantitative', scale: vegaColorScale, legend: null },
            order: { field: 'order', type: 'ordinal' },
            tooltip: [
              { field: 'name', title: 'Sektor' },
              { field: 'meanRating', format: '.3f', title: 'Ø Bewertung' },
            ],
          },
        },
        // Outer ring (measures) — white separators
        {
          data: { values: outerRows },
          mark: { type: 'arc', innerRadius: 123, outerRadius: 195, stroke: 'white', strokeWidth: 0.5 },
          encoding: {
            theta: { field: 'theta', type: 'quantitative', stack: true },
            color: { field: 'meanRatingDisplay', type: 'quantitative', scale: vegaColorScale, legend: null },
            order: { field: 'order', type: 'ordinal' },
            tooltip: [
              { field: 'name', title: 'Maßnahme' },
              { field: 'sectorName', title: 'Sektor' },
              { field: 'meanRating', format: '.3f', title: 'Ø Bewertung' },
            ],
          },
        },
        // Highlight overlay: transparent fill, blue border on selected arc only
        ...(sel.type === 'sector' ? [{
          data: { values: innerRows },
          mark: { type: 'arc', innerRadius: 55, outerRadius: 118, fillOpacity: 0 },
          encoding: {
            theta: { field: 'theta', type: 'quantitative', stack: true },
            order: { field: 'order', type: 'ordinal' },
            stroke: { condition: { test: `datum.sectorKey === '${sel.sectorKey}'`, value: '#1d4ed8' }, value: null },
            strokeWidth: { value: 2.5 },
          },
        }] : []),
        ...(sel.type === 'measure' ? [{
          data: { values: outerRows },
          mark: { type: 'arc', innerRadius: 123, outerRadius: 195, fillOpacity: 0 },
          encoding: {
            theta: { field: 'theta', type: 'quantitative', stack: true },
            order: { field: 'order', type: 'ordinal' },
            stroke: { condition: { test: `datum.measureId === ${JSON.stringify(sel.measureId)}`, value: '#1d4ed8' }, value: null },
            strokeWidth: { value: 2.5 },
          },
        }] : []),
      ],
      resolve: { scale: { theta: 'independent', color: 'independent' } },
    };
    const result = await vegaEmbed(sunburstContainer.value, spec, { renderer: 'svg', actions: false });
    vegaViewSunburst = result.view;

    // Click handler: update selection, re-render sunburst with highlight + dist panel
    result.view.addEventListener('click', (_event, item) => {
      if (!item?.datum) return;
      const d = item.datum;
      if (d.measureId) {
        sunburstSelection.value = { type: 'measure', sectorKey: d.sectorKey, measureId: d.measureId, label: d.name };
      } else if (d.sectorKey) {
        sunburstSelection.value = { type: 'sector', sectorKey: d.sectorKey, measureId: null, label: d.name };
      }
      clearPanelMunFilter();
      nextTick(() => { renderSunburst(); renderDistPanel(); });
    });
  } catch (e) {
    console.error('Sunburst render error', e);
  }
}

function clearSunburstSelection() {
  sunburstSelection.value = { type: null, sectorKey: null, measureId: null, label: '' };
  clearPanelMunFilter();
  nextTick(() => { renderSunburst(); renderDistPanel(); });
}

function clearPanelMunFilter() {
  panelMunFilter.value = { active: false, label: '', type: null, measureId: null, ratingKey: null, sectorKey: null, binRange: null };
}

// ── Detail panel: distribution chart ─────────────────────────────────────────
async function renderDistPanel() {
  if (!distPanelContainer.value) return;
  const { default: vegaEmbed } = await import('vega-embed');
  if (vegaViewDist) { vegaViewDist.finalize(); vegaViewDist = null; }
  distPanelContainer.value.innerHTML = '';

  const sel = sunburstSelection.value;

  if (!sel.type) {
    // Global: score histogram of all filtered municipalities
    const scores = filteredMunScores.value
      .filter(ms => ms.score_total != null)
      .map(ms => ({ score: parseFloat((parseFloat(ms.score_total) * 100).toFixed(2)) }))
      .filter(d => !isNaN(d.score));
    if (!scores.length) return;
    const spec = {
      $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
      width: 'container', height: 360,
      data: { values: scores },
      mark: { type: 'bar', color: '#F39200', cursor: 'default' },
      encoding: {
        x: { field: 'score', bin: { maxbins: 14 }, type: 'quantitative', title: 'Gesamtscore (× 100)' },
        y: { aggregate: 'count', type: 'quantitative', title: 'Kommunen', axis: { tickMinStep: 1 } },
        tooltip: [{ field: 'score', bin: { maxbins: 14 }, title: 'Score' }, { aggregate: 'count', type: 'quantitative', title: 'Kommunen' }],
      },
    };
    const res = await vegaEmbed(distPanelContainer.value, spec, { renderer: 'svg', actions: false });
    vegaViewDist = res.view;
    return;
  }

  if (sel.type === 'sector') {
    // Sector score distribution (binned histogram), clickable bins
    const sKey = sel.sectorKey;
    const scores = filteredMunScores.value
      .map(ms => ({
        score: parseFloat(parseFloat(ms[`score_${sKey}`]).toFixed(4)),
        name: ms.municipality?.name,
        slug: ms.municipality?.slug,
        score_total: ms.score_total,
      }))
      .filter(d => !isNaN(d.score));
    if (!scores.length) return;
    const selectedBin0 = panelMunFilter.value.type === 'sector-bin' && panelMunFilter.value.sectorKey === sKey
      ? panelMunFilter.value.binRange?.[0] : null;
    const spec = {
      $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
      width: 'container', height: 360,
      data: { values: scores },
      mark: { type: 'bar', color: sectorColors[sKey] ?? '#F39200', cursor: 'pointer', strokeWidth: 2.5 },
      encoding: {
        x: { field: 'score', bin: { maxbins: 12 }, type: 'quantitative', title: `Score ${shortSectorNames[sKey]}` },
        y: { aggregate: 'count', type: 'quantitative', title: 'Kommunen', axis: { tickMinStep: 1 } },
        tooltip: [{ field: 'score', bin: { maxbins: 12 }, title: 'Score-Bereich', format: '.3f' }, { aggregate: 'count', type: 'quantitative', title: 'Kommunen' }],
        stroke: selectedBin0 != null
          ? { condition: { test: `datum['bin_maxbins_12_score'] === ${selectedBin0}`, value: '#1d4ed8' }, value: null }
          : { value: null },
      },
    };
    const res = await vegaEmbed(distPanelContainer.value, spec, { renderer: 'svg', actions: false });
    vegaViewDist = res.view;
    // Click on a bin: filter municipality list to that bin
    res.view.addEventListener('click', (_e, item) => {
      if (!item?.datum) return;
      const bin0 = item.datum['bin_maxbins_12_score'];
      const bin1 = item.datum['bin_maxbins_12_score_end'];
      if (bin0 == null) return;
      panelMunFilter.value = {
        active: true,
        label: `${shortSectorNames[sKey]} ${bin0.toFixed(2)}–${bin1.toFixed(2)}`,
        type: 'sector-bin',
        measureId: null,
        ratingKey: null,
        sectorKey: sKey,
        binRange: [bin0, bin1],
      };
      nextTick(() => renderDistPanel());
    });
    return;
  }

  if (sel.type === 'measure') {
    // Measure: rating distribution (categorical), clickable
    const measureId = sel.measureId;
    const sKey = sel.sectorKey;
    const sector = sectorStats.value.find(s => s.sectorKey === sKey);
    const measureEntry = sector?.measures?.[measureId];
    if (!measureEntry) return;
    const ratingKeys = getRatingKeys();
    const values = ratingKeys.map(k => ({
      label: ratingLabelsMap[k] ?? k,
      ratingKey: k,
      count: measureEntry.ratings[k]?.length ?? 0,
      color: ratingColors[k] ?? '#9CA3AF',
      municipalities: measureEntry.ratings[k] ?? [],
    }));
    const selectedRk = panelMunFilter.value.type === 'measure-rating' && panelMunFilter.value.measureId === measureId
      ? panelMunFilter.value.ratingKey : null;
    const spec = {
      $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
      width: 'container', height: 360,
      data: { values },
      mark: { type: 'bar', cornerRadiusTopLeft: 3, cornerRadiusTopRight: 3, cursor: 'pointer', strokeWidth: 2.5 },
      encoding: {
        x: { field: 'label', type: 'nominal', sort: null, title: 'Bewertung', axis: { labelAngle: -20 } },
        y: { field: 'count', type: 'quantitative', title: 'Kommunen', axis: { tickMinStep: 1 } },
        color: { field: 'color', type: 'nominal', scale: null, legend: null },
        tooltip: [{ field: 'label', title: 'Bewertung' }, { field: 'count', title: 'Kommunen' }],
        stroke: { condition: { test: `datum.ratingKey === ${JSON.stringify(selectedRk)}`, value: '#1d4ed8' }, value: null },
      },
    };
    const res = await vegaEmbed(distPanelContainer.value, spec, { renderer: 'svg', actions: false });
    vegaViewDist = res.view;
    // Click on a bar: filter municipality list to that rating
    res.view.addEventListener('click', (_e, item) => {
      if (!item?.datum) return;
      const rk = item.datum.ratingKey;
      if (!rk) return;
      panelMunFilter.value = {
        active: true,
        label: ratingLabelsMap[rk] ?? rk,
        type: 'measure-rating',
        measureId,
        ratingKey: rk,
        sectorKey: null,
        binRange: null,
      };
      nextTick(() => renderDistPanel());
    });
  }
}

// ── Arrow-key / button navigation through sectors & measures ─────────────────
const orderedMeasures = computed(() => {
  if (!statsData.value?.measures) return [];
  const result = [];
  sectorOrder.forEach(sKey => {
    statsData.value.measures.filter(m => m.sector === sKey).forEach(m => result.push(m));
  });
  return result;
});

function navigateSunburstSelection(dir) {
  const sel = sunburstSelection.value;
  if (!sel.type) return;
  if (sel.type === 'sector') {
    const idx = sectorOrder.indexOf(sel.sectorKey);
    if (idx === -1) return;
    const newIdx = (idx + dir + sectorOrder.length) % sectorOrder.length;
    const newKey = sectorOrder[newIdx];
    sunburstSelection.value = { type: 'sector', sectorKey: newKey, measureId: null, label: shortSectorNames[newKey] ?? newKey };
  } else {
    const measures = orderedMeasures.value;
    const idx = measures.findIndex(m => m.id === sel.measureId);
    if (idx === -1) return;
    const newIdx = (idx + dir + measures.length) % measures.length;
    const m = measures[newIdx];
    sunburstSelection.value = { type: 'measure', sectorKey: m.sector, measureId: m.id, label: m.name };
  }
  clearPanelMunFilter();
  nextTick(() => { renderSunburst(); renderDistPanel(); });
}

function handleArrowKey(e) {
  if (activeTab.value !== 'measures') return;
  if (!sunburstSelection.value.type) return;
  if (e.key === 'ArrowLeft') { e.preventDefault(); navigateSunburstSelection(-1); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); navigateSunburstSelection(1); }
}

// ── (legacy functions kept for possible reuse but no longer called directly) ──
async function openSectorDistribution() {}
async function openMeasureDistribution() {}
async function renderDistributionChart() {}

// ── (renderHistogram removed — distribution is now inline in the detail panel) ──

function setSectorFilter(key) {
  activeSectorFilter.value = key;
}
// ── Reactive re-render on filter change ──────────────────────────────────────
watch([filterState, filterType], () => {
  nextTick(() => {
    renderSunburst();
    renderDistPanel();
  });
});

function switchToClusteringTab() {
  activeTab.value = 'clustering';
}

function switchToDominanceTab() {
  activeTab.value = 'dominance';
  nextTick(() => {
    computeDominanceAndRender();
  });
}

// ── Pairwise Dominance Analysis ───────────────────────────────────────────────
async function computeDominanceAndRender() {
  dominanceError.value = '';
  try {
    await nextTick();
    if (!dominanceRankContainer.value || !dominanceHeatmapContainer.value || !dominanceForceContainer.value) {
      dominanceError.value = 'Die Diagramm-Container konnten nicht initialisiert werden.';
      return;
    }

    const data = filteredMunScores.value;
  if (data.length < 3) {
    dominanceError.value = 'Mindestens 3 Kommunen im aktuellen Filter benötigt.';
    return;
  }

  const { ratings: allRatings, measures: allMeasures } = statsData.value;

  const munData = data.filter(ms => ms.municipality?.localteam_id);
  const N = munData.length;
  const ltIds = munData.map(ms => ms.municipality.localteam_id);
  const names = munData.map(ms => ms.municipality.name);

  // Build rating map per localteam: lt -> { measureId -> numeric 0-1 } (exclude N/A and null)
  const ltSet = new Set(ltIds);
  const ratingMap = {};
  allRatings.forEach(r => {
    if (!ltSet.has(r.localteam_id)) return;
    if (r.applicable === false || r.rating == null) return;
    const v = parseFloat(r.rating);
    if (isNaN(v)) return;
    if (!ratingMap[r.localteam_id]) ratingMap[r.localteam_id] = {};
    ratingMap[r.localteam_id][r.measure_id] = v;
  });

  // Per-measure rating arrays indexed by municipality
  const measureIds = allMeasures.map(m => m.id);
  const ratingArrays = measureIds.map(mid =>
    ltIds.map(lt => ratingMap[lt]?.[mid] ?? null),
  );

  // wins[i][j] = #measures where municipality i beat j
  // compared[i][j] = #measures where both had a valid rating
  const wins = Array.from({ length: N }, () => new Float32Array(N));
  const compared = Array.from({ length: N }, () => new Float32Array(N));

  for (const ratings of ratingArrays) {
    for (let i = 0; i < N; i++) {
      if (ratings[i] == null) continue;
      for (let j = i + 1; j < N; j++) {
        if (ratings[j] == null) continue;
        compared[i][j]++;
        compared[j][i]++;
        if (ratings[i] > ratings[j]) wins[i][j]++;
        else if (ratings[j] > ratings[i]) wins[j][i]++;
      }
    }
  }

  // Win rate per municipality
  const winRates = Array.from({ length: N }, (_, i) => {
    let totalW = 0, totalC = 0;
    for (let j = 0; j < N; j++) {
      totalW += wins[i][j];
      totalC += compared[i][j];
    }
    return totalC > 0 ? totalW / totalC : 0;
  });

  // Sort indices by win rate descending
  const sortedIdx = Array.from({ length: N }, (_, i) => i)
    .sort((a, b) => winRates[b] - winRates[a]);

  // Ranking data for bar chart
  const rankingData = sortedIdx.map((i, rank) => ({
    name: names[i],
    winRate: winRates[i],
    wins: Array.from(wins[i]).reduce((s, v) => s + v, 0),
    losses: Array.from({ length: N }, (_, j) => wins[j][i]).reduce((s, v) => s + v, 0),
    rank: rank + 1,
  }));

  // Top 40 for heatmap, sorted by win rate → topNames defines display order
  const topN = Math.min(40, N);
  const topIdx = sortedIdx.slice(0, topN);
  const topNames = topIdx.map(i => names[i]);

  const heatmapData = [];
  for (let ii = 0; ii < topN; ii++) {
    for (let jj = 0; jj < topN; jj++) {
      if (ii === jj) continue;
      const i = topIdx[ii], j = topIdx[jj];
      const rate = compared[i][j] > 0 ? wins[i][j] / compared[i][j] : 0.5;
      heatmapData.push({ row: names[i], col: names[j], rate });
    }
  }

  const { default: vegaEmbed } = await import('vega-embed');

  // ── Win rate ranking bar chart ─────────────────────────────────────────────
  if (vegaViewDominance) { vegaViewDominance.finalize(); vegaViewDominance = null; }
  dominanceRankContainer.value.innerHTML = '';

  const rankSpec = {
    $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
    width: 'container',
    height: { step: 18 },
    data: { values: rankingData },
    mark: { type: 'bar', cornerRadiusEnd: 2 },
    encoding: {
      y: {
        field: 'name', type: 'nominal', sort: { field: 'winRate', order: 'descending' },
        title: null, axis: { labelFontSize: 10 },
      },
      x: {
        field: 'winRate', type: 'quantitative', title: 'Gewinnrate',
        axis: { format: '.0%', labelFontSize: 10 },
        scale: { domain: [0, 1] },
      },
      color: {
        field: 'winRate', type: 'quantitative',
        scale: { domain: [0.25, 0.5, 0.75], range: ['#ef4444', '#f59e0b', '#1d4ed8'] },
        legend: null,
      },
      tooltip: [
        { field: 'rank', type: 'quantitative', title: 'Rang' },
        { field: 'name', title: 'Kommune' },
        { field: 'winRate', format: '.1%', title: 'Gewinnrate' },
        { field: 'wins', title: 'Siege' },
        { field: 'losses', title: 'Niederlagen' },
      ],
    },
  };

  const r1 = await vegaEmbed(dominanceRankContainer.value, rankSpec, { renderer: 'svg', actions: false });
  vegaViewDominance = r1.view;

  // ── Dominance heatmap ──────────────────────────────────────────────────────
  if (vegaViewDominanceHeatmap) { vegaViewDominanceHeatmap.finalize(); vegaViewDominanceHeatmap = null; }
  dominanceHeatmapContainer.value.innerHTML = '';

  const step = Math.max(10, Math.floor(500 / topN));
  const heatSpec = {
    $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
    width: { step },
    height: { step },
    data: { values: heatmapData },
    mark: { type: 'rect' },
    encoding: {
      y: {
        field: 'row', type: 'nominal', sort: topNames, title: null,
        axis: { labelFontSize: Math.min(10, step - 1) },
      },
      x: {
        field: 'col', type: 'nominal', sort: topNames, title: null,
        axis: { labelAngle: -45, labelFontSize: Math.min(10, step - 1) },
      },
      color: {
        field: 'rate', type: 'quantitative',
        scale: { domain: [0, 0.5, 1], range: ['#d62728', '#f0f0f0', '#1d4ed8'] },
        legend: { title: 'Gewinnrate' },
      },
      tooltip: [
        { field: 'row', title: 'Zeile (gewinnt)' },
        { field: 'col', title: 'Spalte (verliert)' },
        { field: 'rate', format: '.1%', title: 'Gewinnrate Zeile' },
      ],
    },
  };

  const r2 = await vegaEmbed(dominanceHeatmapContainer.value, heatSpec, { renderer: 'svg', actions: false });
  vegaViewDominanceHeatmap = r2.view;

  // ── Force-directed graph ──────────────────────────────────────────────────
  if (vegaViewDominanceForce) { vegaViewDominanceForce.finalize(); vegaViewDominanceForce = null; }
  dominanceForceContainer.value.innerHTML = '';

  const { forceSimulation, forceManyBody, forceLink, forceCenter, forceCollide } = await import('d3-force');

  const forceNodes = sortedIdx.map((i, pos) => ({
    id: String(pos),
    rank: pos + 1,
    name: names[i],
    winRate: winRates[i],
  }));

  const forceLinks = [];
  for (let ii = 0; ii < N; ii++) {
    for (let jj = ii + 1; jj < N; jj++) {
      const i = sortedIdx[ii];
      const j = sortedIdx[jj];
      if (compared[i][j] === 0) continue;

      const rateIJ = wins[i][j] / compared[i][j];
      const dominance = Math.abs(rateIJ - 0.5) * 2;
      if (dominance < 0.08) continue;

      const winner = rateIJ >= 0.5 ? ii : jj;
      const loser = rateIJ >= 0.5 ? jj : ii;
      const topRate = Math.max(rateIJ, 1 - rateIJ);

      forceLinks.push({
        source: String(winner),
        target: String(loser),
        dominance,
        rate: topRate,
      });
    }
  }

  const visibleLinks = forceLinks.filter(l => l.rate >= 0.68);
  const containerWidth = dominanceForceContainer.value.clientWidth || 900;
  const width = containerWidth;
  const height = Math.max(700, Math.min(1100, 300 + N * 14));

  const simulation = forceSimulation(forceNodes)
    .force('charge', forceManyBody().strength(-(70 + N * 2.5)))
    .force('center', forceCenter(width / 2, height / 2))
    .force('collide', forceCollide().radius(d => 7 + d.winRate * 7).iterations(2))
    .force('link', forceLink(forceLinks)
      .id(d => d.id)
      .distance(d => 140 - d.dominance * 95)
      .strength(d => 0.08 + d.dominance * 0.35))
    .stop();

  for (let i = 0; i < 300; i++) simulation.tick();

  // Normalize positions to fill the canvas
  const xs = forceNodes.map(n => n.x ?? width / 2);
  const ys = forceNodes.map(n => n.y ?? height / 2);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const pad = 60;
  const scale = Math.min((width - 2 * pad) / (maxX - minX || 1), (height - 2 * pad) / (maxY - minY || 1));
  const offX = (width - (maxX - minX) * scale) / 2 - minX * scale;
  const offY = (height - (maxY - minY) * scale) / 2 - minY * scale;
  forceNodes.forEach(n => {
    n.x = offX + (n.x ?? width / 2) * scale;
    n.y = offY + (n.y ?? height / 2) * scale;
  });

  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', String(height));
  svg.style.display = 'block';
  svg.style.background = 'white';

  const linksGroup = document.createElementNS(ns, 'g');
  const nodesGroup = document.createElementNS(ns, 'g');
  const labelsGroup = document.createElementNS(ns, 'g');

  visibleLinks.forEach(link => {
    const source = typeof link.source === 'object' ? link.source : forceNodes.find(n => n.id === link.source);
    const target = typeof link.target === 'object' ? link.target : forceNodes.find(n => n.id === link.target);
    if (!source || !target) return;
    const line = document.createElementNS(ns, 'line');
    line.setAttribute('x1', String(source.x));
    line.setAttribute('y1', String(source.y));
    line.setAttribute('x2', String(target.x));
    line.setAttribute('y2', String(target.y));
    line.setAttribute('stroke', '#93c5fd');
    line.setAttribute('stroke-opacity', String(0.10 + (link.rate - 0.68) * 1.4));
    line.setAttribute('stroke-width', String(0.6 + (link.rate - 0.68) * 4));
    linksGroup.appendChild(line);
  });

  const colorForWinRate = (r) => {
    if (r < 0.38) return '#ef4444';
    if (r < 0.5) return '#f59e0b';
    if (r < 0.62) return '#60a5fa';
    return '#1d4ed8';
  };

  forceNodes.forEach((node, idx) => {
    const circle = document.createElementNS(ns, 'circle');
    circle.setAttribute('cx', String(node.x));
    circle.setAttribute('cy', String(node.y));
    circle.setAttribute('r', String(4 + node.winRate * 7));
    circle.setAttribute('fill', colorForWinRate(node.winRate));
    circle.setAttribute('fill-opacity', '0.9');
    circle.setAttribute('stroke', '#ffffff');
    circle.setAttribute('stroke-width', '1');

    const title = document.createElementNS(ns, 'title');
    title.textContent = `${node.rank}. ${node.name} — Gewinnrate ${(node.winRate * 100).toFixed(1)}%`;
    circle.appendChild(title);
    nodesGroup.appendChild(circle);

    if (idx < 12 || node.winRate > 0.67) {
      const label = document.createElementNS(ns, 'text');
      label.setAttribute('x', String(node.x + 7));
      label.setAttribute('y', String(node.y - 7));
      label.setAttribute('font-size', '10');
      label.setAttribute('fill', '#374151');
      label.textContent = node.name;
      labelsGroup.appendChild(label);
    }
  });

  svg.appendChild(linksGroup);
  svg.appendChild(nodesGroup);
  svg.appendChild(labelsGroup);
  dominanceForceContainer.value.appendChild(svg);
  vegaViewDominanceForce = null;
  } catch (e) {
    console.error('Dominance analysis error', e);
    dominanceError.value = `Fehler beim Rendern: ${e?.message || e}`;
  }
}
function kMeans(points, k, iters = 100) {
  // k-means++ init
  const centroids = [points[Math.floor(Math.random() * points.length)]];
  while (centroids.length < k) {
    const dists = points.map(p => Math.min(...centroids.map(c => (p.x - c.x) ** 2 + (p.y - c.y) ** 2)));
    const sum = dists.reduce((a, b) => a + b, 0);
    if (sum === 0) { centroids.push(points[Math.floor(Math.random() * points.length)]); continue; }
    let r = Math.random() * sum;
    let idx = 0;
    while (r > 0 && idx < dists.length - 1) { r -= dists[idx]; idx++; }
    centroids.push(points[idx]);
  }
  let labels = points.map(() => 0);
  for (let iter = 0; iter < iters; iter++) {
    labels = points.map(p =>
      centroids.reduce((best, c, ci) => {
        const d = (p.x - c.x) ** 2 + (p.y - c.y) ** 2;
        return d < best.d ? { ci, d } : best;
      }, { ci: 0, d: Infinity }).ci,
    );
    for (let ci = 0; ci < k; ci++) {
      const pts = points.filter((_, i) => labels[i] === ci);
      if (pts.length) {
        centroids[ci] = {
          x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
          y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
        };
      }
    }
  }
  return labels;
}

async function computeClusteringAndRender() {
  clusteringError.value = '';
  if (!clusterContainer.value) return;
  const data = filteredMunScores.value;
  if (!data.length) {
    clusteringError.value = 'Keine vollständig bewerteten Kommunen im aktuellen Filter.';
    return;
  }
  if (data.length < kClusters.value + 1) {
    clusteringError.value = `Zu wenige Kommunen (${data.length}) für k=${kClusters.value} Cluster.`;
    return;
  }

  // Build feature matrix: individual measure ratings + log(population)
  const { measures: allMeasures, ratings: allRatings } = statsData.value;

  // Ordered list of measure IDs used as feature columns
  const measureIds = allMeasures.map(m => m.id);

  // Build lookup: localteam_id -> { measureId -> numeric score (0..1, -1 = N/A, null = missing) }
  const ltRatingMap = {};
  allRatings.forEach(r => {
    if (!ltRatingMap[r.localteam_id]) ltRatingMap[r.localteam_id] = {};
    ltRatingMap[r.localteam_id][r.measure_id] = r.applicable === false ? -1 : (r.rating != null ? parseFloat(r.rating) : null);
  });

  const munItems = data
    .filter(ms => ms.municipality?.localteam_id)
    .map(ms => {
      const lt = ms.municipality.localteam_id;
      const munRatings = ltRatingMap[lt] ?? {};
      // Measure scores: use actual rating (0..1), 0 for N/A or missing
      const measureVec = measureIds.map(mid => {
        const v = munRatings[mid];
        if (v == null || isNaN(v) || v < 0) return 0;
        return v;
      });
      return {
        name: ms.municipality.name,
        slug: ms.municipality.slug,
        scoreTotal: parseFloat(ms.score_total) || 0,
        vec: measureVec,
      };
    });

  if (munItems.length < kClusters.value + 1) {
    clusteringError.value = 'Zu wenige Datenpunkte.';
    return;
  }

  try {
    const { PCA } = await import('ml-pca');
    const matrix = munItems.map(m => m.vec);
    const pca = new PCA(matrix, { center: true, scale: false });
    const projected = pca.predict(matrix, { nComponents: 2 }).to2DArray();

    const points = projected.map(row => ({ x: row[0], y: row[1] }));
    const clusterLabels = kMeans(points, kClusters.value);

    const palette = ['#1f77b4','#ff7f0e','#2ca02c','#d62728','#9467bd','#8c564b','#e377c2','#7f7f7f','#bcbd22','#17becf'];
    const rows = munItems.map((m, i) => ({
      name: m.name,
      slug: m.slug,
      x: points[i].x,
      y: points[i].y,
      scoreTotal: m.scoreTotal.toFixed(1),
      cluster: `Cluster ${clusterLabels[i] + 1}`,
    }));

    const clusterDomain = Array.from({ length: kClusters.value }, (_, i) => `Cluster ${i + 1}`);
    const clusterRange = clusterDomain.map((_, i) => palette[i % palette.length]);

    const spec = {
      $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
      width: 'container',
      height: 460,
      data: { values: rows },
      mark: { type: 'point', filled: true, size: 100, opacity: 0.85 },
      encoding: {
        x: { field: 'x', type: 'quantitative', title: 'PC 1', axis: { grid: true } },
        y: { field: 'y', type: 'quantitative', title: 'PC 2', axis: { grid: true } },
        color: {
          field: 'cluster', type: 'nominal',
          scale: { domain: clusterDomain, range: clusterRange },
          legend: { title: 'Cluster' },
        },
        tooltip: [
          { field: 'name', type: 'nominal', title: 'Kommune' },
          { field: 'cluster', type: 'nominal', title: 'Cluster' },
          { field: 'scoreTotal', type: 'nominal', title: 'Score (%)' },
          { field: 'x', type: 'quantitative', title: 'PC 1', format: '.3f' },
          { field: 'y', type: 'quantitative', title: 'PC 2', format: '.3f' },
        ],
      },
    };

    const { default: vegaEmbed } = await import('vega-embed');
    if (vegaViewCluster) { vegaViewCluster.finalize(); vegaViewCluster = null; }
    clusterContainer.value.innerHTML = '';
    const result = await vegaEmbed(clusterContainer.value, spec, { actions: false, renderer: 'svg' });
    vegaViewCluster = result.view;

    // Store rows for profile lookup — keep slug for sector-score lookup
    clusterData.value = rows.map((r, i) => ({
      ...r,
      slug: munItems[i].slug,
    }));

    // Click on a point: show cluster profile
    result.view.addEventListener('click', (_e, item) => {
      if (!item?.datum) return;
      const clickedCluster = item.datum.cluster;
      if (!clickedCluster) return;
      const members = clusterData.value.filter(r => r.cluster === clickedCluster);
      if (!members.length) return;

      // Look up sector scores from the original filtered data (0-100 scale)
      const slugSet = new Set(members.map(m => m.slug));
      const memberScores = filteredMunScores.value.filter(ms => slugSet.has(ms.municipality?.slug));
      const sectorMeans = {};
      sectorOrder.forEach(sk => {
        const vals = memberScores.map(ms => parseFloat(ms[`score_${sk}`])).filter(v => !isNaN(v));
        sectorMeans[sk] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      });

      const totals = members.map(m => parseFloat(m.scoreTotal)).filter(v => !isNaN(v));
      const avgTotal = totals.length ? (totals.reduce((a, b) => a + b, 0) / totals.length).toFixed(1) : '–';
      clusterProfile.value = {
        clusterLabel: clickedCluster,
        count: members.length,
        avgTotal,
        sectorMeans,
        municipalities: members.map(m => ({ name: m.name, slug: m.slug })),
      };
    });
  } catch (e) {
    console.error('Cluster error', e);
    clusteringError.value = `Fehler: ${e.message}`;
  }
}

// ── Lifecycle ────────────────────────────────────────────────────────────────
onMounted(() => {
  window.addEventListener('keydown', handleArrowKey);
  nextTick(() => {
    renderSunburst();
    renderDistPanel();
  });
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleArrowKey);
  if (vegaViewSunburst) vegaViewSunburst.finalize();
  if (vegaViewCluster) vegaViewCluster.finalize();
  if (vegaViewDist) vegaViewDist.finalize();
  if (vegaViewDominance) vegaViewDominance.finalize();
  if (vegaViewDominanceHeatmap) vegaViewDominanceHeatmap.finalize();
  if (vegaViewDominanceForce) vegaViewDominanceForce.finalize();
});

// ── Catalog version change ───────────────────────────────────────────────────
async function onCatalogVersionChange(newId) {
  const newVersion = catalogVersions.value.find(v => v.id === newId);
  if (!newVersion) return;
  selectedCatalogVersionId.value = newId;
  selectedCatalogVersion.value = newVersion;
  router.replace({ query: { ...route.query, v: newVersion.name } });
  filterState.value = null;
  filterType.value = null;
  statsData.value = await fetchStatsForCatalog(newVersion.id);
  if (vegaViewSunburst) { vegaViewSunburst.finalize(); vegaViewSunburst = null; }
  if (vegaViewCluster) { vegaViewCluster.finalize(); vegaViewCluster = null; }
  if (vegaViewDist) { vegaViewDist.finalize(); vegaViewDist = null; }
  sunburstSelection.value = { type: null, sectorKey: null, measureId: null, label: '' };
  panelMunFilter.value = { active: false, label: '', type: null, measureId: null, ratingKey: null, sectorKey: null, binRange: null };
  nextTick(() => {
    renderSunburst();
    renderDistPanel();
  });
}
</script>

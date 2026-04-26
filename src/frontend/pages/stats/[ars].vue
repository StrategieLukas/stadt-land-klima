<template>
  <main class="px-4 sm:px-6 lg:px-8 py-4 sm:py-8 max-w-4xl mx-auto w-full min-w-0">

    <!-- Back to measure statistics index -->
    <div class="mb-4">
      <NuxtLink
        to="/stats"
        class="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1a4a6e] hover:underline"
      >
        <svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Zur Maßnahmenstatistik-Übersicht
      </NuxtLink>
    </div>

    <!-- Search section — same layout as stats index page -->
    <section class="mb-6 overflow-hidden shadow-list rounded-sm">
      <div class="flex flex-col md:flex-row md:items-stretch">
        <!-- Dark left: icon + title -->
        <div class="py-4 px-4 flex items-center gap-3 md:w-[35%] md:flex-shrink-0" style="background-color: #006e94;">
          <svg class="w-5 h-5 flex-shrink-0 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <div>
            <h2 class="text-lg font-bold text-white font-heading leading-tight">Kommunale Statistiken</h2>
            <p class="text-xs text-white/70 mt-0.5">Statistiken und Daten zu einer anderen Kommune oder einem Verwaltungsgebiet suchen</p>
          </div>
        </div>
        <!-- Right: search bar -->
        <div class="px-1 pt-4 pb-3 md:flex-1 md:px-5 md:flex md:items-center md:py-3">
          <AdministrativeAreaSearchBar base-path="/stats" class="w-full" />
        </div>
      </div>
    </section>

    <!-- Main Info Container -->
    <div class="bg-white rounded-lg shadow-lg overflow-hidden mt-6 min-w-0 max-w-full">
      <!-- Breadcrumbs section from contained_by -->
      <div class="breadcrumbs bg-gray-50 px-3 sm:px-4 lg:px-6 py-3 text-sm text-gray-600 overflow-x-auto">
        <ul class="flex flex-row flex-nowrap items-center min-w-0">
          <li v-for="containedArea in stats?.contained_by" :key="containedArea.ars" class="flex-shrink-0">
            <NuxtLink :to="`/stats/${containedArea.ars}`" class="hover:underline whitespace-nowrap text-xs sm:text-sm">
              {{ containedArea.prefix }} {{ containedArea.name }}
            </NuxtLink>
          </li>
        </ul>
      </div>
      

      <!-- Header Section -->
      <div class="flex flex-row w-full justify-between bg-gradient-to-r from-blue-50 to-indigo-50 px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8 gap-3 overflow-hidden">
        <!-- Left Column: Location Info -->
        <div class="flex-1 min-w-0">

          <p class="text-sm font-semibold text-gray-600 uppercase tracking-wide">
            {{ stats?.prefix || $t('generic.loading') }}
          </p>

          <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 mb-2 break-words">
            {{ stats?.name || $t('generic.loading') }}
          </h1>

          <p class="text-base lg:text-lg text-gray-600">{{ stats?.state || '' }}</p>

          <!-- ARS code -->
          <div class="mt-2">
            <span class="text-xs text-gray-500 font-semibold">ARS </span>
            <span class="text-xs font-mono text-gray-600">{{ stats?.ars || '-' }}</span>
          </div>
        </div>
        
        <!-- Right Column: Germany map indicator -->
        <div class="flex flex-col items-end gap-2 flex-shrink-0">
          <!-- Germany map with marker -->
          <GermanyMapIndicator
            v-if="stats?.geo_center"
            :lat="stats.geo_center.coordinates[1]"
            :lon="stats.geo_center.coordinates[0]"
            :size="100"
            class="flex-shrink-0"
          />
        </div>
      </div>
    </div>

    <!-- Measure Catalog Comparison Section -->
    <div v-if="stats?.is_reasonable_for_municipal_rating && allCatalogVersions.length > 0" class="mt-6 border border-gray-200 shadow-md overflow-hidden">

      <!-- Collapsible header -->
      <button
        class="w-full flex items-center justify-between gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
        @click="catalogOpen = !catalogOpen"
      >
        <div class="flex items-center gap-2 min-w-0">
          <svg class="w-5 h-5 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <h2 class="text-base font-semibold text-gray-900">{{ t('stats.measure_catalog_comparison', 'Bewertungen in den verschiedenen Maßnahmenkatalogen') }}</h2>
          <span class="text-xs text-gray-400 hidden sm:block">
            ({{ Object.values(municipalityScoresByCatalog).filter(s => s?.percentage_rated >= 98).length }} / {{ allCatalogVersions.length }} vollständig)
          </span>
        </div>
        <svg
          class="w-5 h-5 text-gray-400 flex-shrink-0 transition-transform duration-200"
          :class="catalogOpen ? 'rotate-180' : ''"
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <!-- Cards Grid -->
      <div v-show="catalogOpen" class="p-4">

        <!-- Localteam CTA (shown once) -->
        <div v-if="municipalityDirectusData" class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 px-3 py-2 rounded-lg bg-blue-50 border border-blue-100">
          <p class="text-xs text-blue-700">
            <template v-if="hasLocalteam">
              Ein Lokalteam bewertet diese Kommune aktiv.
            </template>
            <template v-else>
              Noch kein Lokalteam für diese Kommune registriert.
            </template>
          </p>
          <CanonicalButton
            v-if="!hasLocalteam"
            href="/register_localteam"
            :label="t('stats.action.start_rating', 'Lokalteam gründen')"
            color="green"
            icon-slug="icon_team"
          />
          <CanonicalButton
            v-else
            :href="localteamContactUrl"
            :label="t('stats.action.help_local_team', 'Lokalteam unterstützen')"
            color="green"
            icon-slug="icon_hand_holding_heart"
          />
        </div>

        <div class="flex flex-wrap gap-4">
          <div v-for="catalog in allCatalogVersions" :key="catalog.id"
               class="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow flex flex-col w-full sm:w-72">
            <div class="p-4 flex flex-col flex-1">

              <!-- Catalog Header -->
              <div class="flex flex-col items-center text-center mb-3">
                <h3 class="text-sm font-semibold text-gray-800 mb-2">{{ catalog.name }}</h3>
                <div class="flex flex-wrap justify-center gap-1">
                  <span v-if="catalog.isCurrentFrontend"
                       class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {{ t('stats.catalog_status.current_frontend', 'Momentan gültig') }}
                  </span>
                  <span v-if="catalog.isCurrentBackend"
                       class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                    {{ t('stats.catalog_status.current_backend', 'Momentan im Bewerten') }}
                  </span>
                </div>
              </div>

              <!-- Rating Status -->
              <div class="flex justify-center mb-4">
                <span v-if="municipalityScoresByCatalog[catalog.id]?.percentage_rated >= 98"
                      class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
                  </svg>
                  {{ t('stats.rating_status.complete', 'Vollständig bewertet') }}
                </span>
                <span v-else-if="municipalityScoresByCatalog[catalog.id]?.percentage_rated > 0"
                      class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                  {{ typeof municipalityScoresByCatalog[catalog.id].percentage_rated === 'number'
                      ? municipalityScoresByCatalog[catalog.id].percentage_rated.toFixed(1)
                      : parseFloat(municipalityScoresByCatalog[catalog.id].percentage_rated).toFixed(1) || '0.0' }}% {{ $t('administrative_areas.rated') }}
                </span>
                <span v-else class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                  {{ t('stats.rating_status.no_data', 'Keine Daten') }}
                </span>
              </div>

              <!-- Action — spacer pushes it to bottom -->
              <div class="mt-auto flex justify-center">
                <!-- Complete (≥98%): link to municipality detail page (ranking) -->
                <CanonicalButton
                  v-if="municipalityScoresByCatalog[catalog.id]?.percentage_rated >= 98 && municipalityScoresByCatalog[catalog.id]?.municipality?.slug"
                  :href="`/municipalities/${municipalityScoresByCatalog[catalog.id].municipality.slug}`"
                  :label="t('stats.action.current_rating', 'Zur Bewertung')"
                  color="bright-green"
                  text-color="white"
                  icon-slug="icon_location"
                  icon-size="lg"
                />
                <!-- Otherwise: informational text -->
                <span v-else class="text-sm text-gray-400 text-center italic">
                  {{ t('stats.action.rating_in_progress', 'Bewertung in Bearbeitung') }}
                </span>

              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Municipality not suitable message (level 4-6, not reasonable for rating) -->
    <div v-else-if="stats && !stats.is_reasonable_for_municipal_rating" class="flex border min-h-[100px] flex-col gap-4 p-6 bg-amber-50 border-amber-200 shadow-md mt-6 rounded-lg">
      <div class="flex items-start gap-3">
        <svg class="w-6 h-6 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <p class="text-base font-semibold text-amber-900">{{ $t('administrative_areas.not_reasonable_for_rating') }}</p>
          <p class="text-sm text-amber-700 mt-1">{{ t('stats.not_reasonable_explanation', 'Dieses Gebiet wird im Stadt-Land-Klima-Ranking nicht einzeln bewertet.') }}</p>
        </div>
      </div>
      <div v-if="reasonableParent" class="flex flex-col sm:flex-row items-start sm:items-center gap-3 pt-2 border-t border-amber-200">
        <p class="text-sm text-amber-800">
          {{ t('stats.reasonable_parent_hint', 'Die nächste bewertbare Verwaltungseinheit:') }}
        </p>
        <NuxtLink
          :to="`/stats/${reasonableParent.ars}`"
          class="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white text-sm font-semibold rounded-md hover:bg-amber-700 transition-colors"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {{ reasonableParent.prefix }} {{ reasonableParent.name }}
        </NuxtLink>
      </div>
    </div>

    <!-- Map Section -->
    <div v-if="stats && (stats.geo_center || stats.geo_area)" class="mt-6 bg-base-100 shadow-md overflow-hidden max-w-full">
      <AdministrativeAreaMap
        :geo-center="stats.geo_center"
        :geo-area="stats.geo_area"
        :administrative-area-name="stats.name"
        :zoom="3"
      />
      <!-- centroid coordinates and area in km^2-->
      <div v-if="stats.geo_center && stats.geo_area_km2" class="text-xs sm:text-sm text-gray-600 mt-2 pb-2 text-center px-2 overflow-hidden">
        <p class="break-all max-w-full overflow-hidden">
          <span class="block sm:inline">{{ $t('administrative_areas.centroid_coordinates') }}:</span> 
          <span class="font-mono text-xs break-all">
            [{{ stats.geo_center.coordinates[1].toFixed(4) }}, {{ stats.geo_center.coordinates[0].toFixed(4) }}]
          </span>
          <br class="sm:hidden">
          <span class="block sm:inline sm:ml-2">{{ $t('administrative_areas.area') }}: </span> 
          <span class="font-mono text-xs break-all">
            {{ stats.geo_area_km2.toLocaleString() }} km²
          </span>
        </p>
      </div>
    </div>

    <!-- Data Sections -->
    <div class="mt-6 space-y-6 w-full max-w-full overflow-hidden">
      <!-- Dynamic Data Products -->
      <template v-if="stats?.data_products">
        <template v-for="(productData, productKey) in stats.data_products" :key="productKey">
          <DataProductViewWrapper
            v-if="productData && productData.property_info"
            :title="getProductTitle(productData)"
            :code="productData.property_info?.catalog_version && productData.property_info?.measure_id ? productData.property_info.measure_id : undefined"
            :description="getProductDescription(productData)"
            :calculation="getProductCalculation(productData)"
            :show-measure-link="!!(productData.property_info?.measure_id && productData.property_info?.catalog_version)"
            :data-sources="getDataSources(productData)"
            :histogram-config="getHistogramConfig(productKey, productData)"
            :map-enabled="isMapSupportedForProduct(productKey)"
            :ars="stats?.ars"
            :data-product-type="productKey"
            :area-bounds="stats?.geo_area"
          >
            <template #content>
              <div v-if="productData.property_info?.display_config?.render">
                <div v-for="(renderItem, idx) in productData.property_info.display_config.render" :key="idx">
                  <!-- BigNumber display type -->
                  <div v-if="renderItem.type === 'BigNumber'" class="text-center max-w-full overflow-hidden">
                    <span class="text-base sm:text-lg lg:text-2xl font-bold break-all inline-block max-w-full">
                      {{ formatValue(productData[renderItem.key]) }}
                      {{ getUnit(renderItem.unit) }}
                    </span>
                  </div>
                  
                  <!-- ThresholdBar display type -->
                  <ThresholdProgressBar
                    v-else-if="renderItem.type === 'ThresholdBar'"
                    className="w-full"
                    :progress="calculateProgress(productData, renderItem)"
                    :orange-threshold="renderItem.is_percentage ? renderItem.thresholds.orange * 100 : renderItem.thresholds.orange|| 0"
                    :yellow-threshold="renderItem.is_percentage ? renderItem.thresholds.yellow * 100 : renderItem.thresholds.yellow || 0"
                    :light-green-threshold="renderItem.is_percentage ? renderItem.thresholds.lightgreen * 100 : renderItem.thresholds.lightgreen || 0"
                    :dark-green-threshold="renderItem.is_percentage ? renderItem.thresholds.darkgreen * 100 : renderItem.thresholds.darkgreen || 0"
                    :unit="getUnit(renderItem)"
                  />
                </div>
              </div>
            </template>
          </DataProductViewWrapper>
        </template>
      </template>

      <!-- Debug: Show if no data products -->
      <div v-else-if="stats && !stats.data_products" class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p class="text-sm text-yellow-800">No data_products found in stats object</p>
        <pre class="text-xs mt-2 overflow-auto">{{ JSON.stringify(Object.keys(stats), null, 2) }}</pre>
      </div>

      <!-- Nearby Areas Section -->
      <div v-if="stats?.is_reasonable_for_municipal_rating" class="border-t border-b bg-blue-50 px-3 sm:px-4 lg:px-6 py-6 max-w-full overflow-hidden">
        <div class="mb-4">
          <h3 class="text-lg font-semibold text-blue-900 mb-2">
            {{ $t('administrative_areas.nearby_alternatives') }}
          </h3>
          <p class="text-sm text-blue-700">
            {{ $t('administrative_areas.nearby_alternatives_description') }}
          </p>
        </div>
        
        <!-- Loading State -->
        <div v-if="loadingNearbyAreas" class="flex items-center justify-center py-8 gap-2">
          <SlkFlowerSpinner :size="32" />
          <span class="text-blue-600">{{ $t('generic.loading') }}...</span>
        </div>
        
        <!-- Alternatives Carousel -->
        <div v-else-if="nearbyAreas.length > 0" class="relative">
          <div 
            class="carousel-container relative"
            ref="carouselContainer"
          >
            <!-- Left Shadow -->
            <div 
              class="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-blue-50 to-transparent z-10 pointer-events-none transition-opacity duration-300"
              :class="{ 'opacity-0': !showLeftShadow }"
            ></div>
            
            <!-- Right Shadow -->
            <div 
              class="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-blue-50 to-transparent z-10 pointer-events-none transition-opacity duration-300"
              :class="{ 'opacity-0': !showRightShadow }"
            ></div>
            
            <!-- Scrollable Content -->
            <div 
              class="flex space-x-4 overflow-x-auto pb-4 scrollbar-hide"
              ref="scrollContainer"
              @scroll="updateShadows"
            >
              <div v-for="area in nearbyAreas" :key="area.ars" 
                   class="flex-none w-64 sm:w-72 lg:w-80 bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow max-w-full">
                
                <!-- Mini Map Placeholder -->
                <div class="h-32 bg-gradient-to-br from-green-100 to-blue-100 flex items-center justify-center relative">
                  <LMap
                    :ref="el => { if (el) nearbyMapRefs[area.ars] = el }"
                    :zoom="10"
                    :center="[area.geoCenter?.coordinates[1] || 51.1657, area.geoCenter?.coordinates[0] || 10.4515]"
                    class="h-full w-full z-0"
                    :options="{ zoomControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false }"
                    @ready="() => onNearbyMapReady(area.ars, area.geoArea)"
                  >
                    <LTileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    />
                    <LGeoJson
                      v-if="area.geoArea"
                      :geojson="area.geoArea"
                      :options="{ style: { color: '#3B82F6', weight: 2, fillColor: '#3B82F6', fillOpacity: 0.3 } }"
                      @ready="() => onNearbyGeoJsonReady(area.ars, area.geoArea)"
                    />
                  </LMap>
                </div>
                
                <!-- Card Content -->
                <div class="p-3 sm:p-4">
                  <div class="mb-3">
                    <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                      {{ area.prefix }}
                    </p>
                    <h4 class="text-sm font-bold text-gray-900 leading-tight break-words">
                      {{ area.name }}
                    </h4>
                  </div>
                  
                  <NuxtLink :to="area.hasRating ? `/municipalities/${area.stadtlandklimaData.slug}?v=${selectedCatalogVersion.name}` : `/stats/${area.ars}?v=${selectedCatalogVersion.name}`"
                            class="inline-flex items-center text-xs sm:text-sm text-blue-600 hover:text-blue-800 font-medium">
                    <span class="truncate">{{ area.hasRating ? $t('stats.view_ranking') : $t('stats.view_stats') }}</span>
                    <svg class="w-4 h-4 ml-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </NuxtLink>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- No Alternatives -->
        <div v-else class="text-center py-8">
          <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.29-1.016-5.707-2.572" />
          </svg>
          <p class="mt-2 text-sm text-gray-500">
            {{ $t('administrative_areas.no_alternatives_found') }}
          </p>
        </div>
      </div>

      <!-- Available soon-->
      <div class="bg-gray-50 px-3 sm:px-4 lg:px-6 py-6 text-center text-gray-500 max-w-full overflow-hidden">
        <p class="text-sm sm:text-base break-words" v-html="saneLinkifyStr($t('stats.more_data_coming_soon'))"></p>
      </div>

    </div>
  </main>
</template>

<script setup>
import { useRoute } from 'vue-router';
import { onMounted, ref, computed, nextTick } from 'vue';
import { saneLinkifyStr } from '~/shared/utils';
import { getCatalogVersion } from '~/composables/getCatalogVersion.js';
import { getAllCatalogVersions } from '~/composables/getAllCatalogVersions.js';

const route = useRoute();
const { $t, $stadtlandzahlAPI, $directus, $readItems } = useNuxtApp();

// Get the current catalog version and all available catalog versions
const selectedCatalogVersion = ref(await getCatalogVersion($directus, $readItems, route));
const allCatalogVersions = ref(await getAllCatalogVersions($directus, $readItems));

const stats = ref(null);
const nearbyAreas = ref([]);
const loadingNearbyAreas = ref(false);
const nearbyMapRefs = ref({});
const reasonableParent = ref(null);
const catalogOpen = ref(false); // starts collapsed; opened on desktop in onMounted

// Directus municipality data (includes localteam_id)
const municipalityDirectusData = ref(null);

// Municipality scores from Directus for all catalog versions
const municipalityScoresByCatalog = ref({});

/** Build a prefilled contact URL for the "help local team" CTA */
function catalogContactUrl(catalogName) {
  const name = stats.value?.name || ''
  return `/contact?type=cooperation&title=${encodeURIComponent(`Bewertung von ${name} unterstützen (${catalogName})`)}&content=${encodeURIComponent(`Ich möchte beim Bewertungsprozess für die Kommune ${name} helfen.`)}`
}

/** True when this municipality already has a registered local team */
const hasLocalteam = computed(() => !!municipalityDirectusData.value?.localteam_id)
/** Contact URL for supporting the existing local team */
const localteamContactUrl = computed(() => {
  const name = stats.value?.name || ''
  return `/contact?type=cooperation&title=${encodeURIComponent(`Lokalteam in ${name} unterstützen`)}&content=${encodeURIComponent(`Ich möchte das Lokalteam in ${name} unterstützen.`)}`
})

// Helper function for translation with fallbacks
const t = (key, fallback) => {
  const translation = $t(key);
  return translation === key ? fallback : translation;
};

// Function to fetch municipality score from Directus for all catalog versions
const fetchAllMunicipalityScores = async (ars) => {
  const scores = {};
  
  try {
    // First find the municipality by ARS
    const municipalities = await $directus.request($readItems("municipalities", {
      fields: ["id", "slug", "name", "ars", "localteam_id", "status"],
      filter: { ars: { _eq: ars } },
      limit: 1
    }));

    if (!municipalities || municipalities.length === 0) {
      console.log(`No municipality found for ARS: ${ars}`);
      return scores;
    }

    const municipality = municipalities[0];
    // Store municipality data (including localteam_id) for use outside this function
    municipalityDirectusData.value = municipality;

    // Fetch municipality scores for all catalog versions in parallel
    const scorePromises = allCatalogVersions.value.map(async (catalog) => {
      try {
        const municipalityScores = await $directus.request($readItems("municipality_scores", {
          fields: ["*"],
          filter: { 
            municipality: { _eq: municipality.id },
            catalog_version: { _eq: catalog.id }
          },
          limit: 1
        }));

        if (municipalityScores && municipalityScores.length > 0) {
          return {
            catalogId: catalog.id,
            data: {
              ...municipalityScores[0],
              municipality: municipality
            }
          };
        }
        return { catalogId: catalog.id, data: null };
      } catch (error) {
        console.error(`Error fetching municipality score for catalog ${catalog.name}:`, error);
        return { catalogId: catalog.id, data: null };
      }
    });

    const results = await Promise.all(scorePromises);
    
    // Convert results to an object keyed by catalog ID
    results.forEach(({ catalogId, data }) => {
      scores[catalogId] = data;
    });

    return scores;
  } catch (error) {
    console.error('Error fetching municipality scores:', error);
    return scores;
  }
};

// Function to fetch municipality score from Directus
const fetchMunicipalityScore = async (ars, catalogVersionId) => {
  try {
    // First find the municipality by ARS
    const municipalities = await $directus.request($readItems("municipalities", {
      fields: ["id", "slug", "name", "ars", "localteam_id", "status"],
      filter: { ars: { _eq: ars } },
      limit: 1
    }));

    if (!municipalities || municipalities.length === 0) {
      console.log(`No municipality found for ARS: ${ars}`);
      return null;
    }

    const municipality = municipalities[0];

    // Then fetch the municipality score for this municipality and catalog version
    const scores = await $directus.request($readItems("municipality_scores", {
      fields: ["*"],
      filter: { 
        municipality: { _eq: municipality.id },
        catalog_version: { _eq: catalogVersionId }
      },
      limit: 1
    }));

    if (!scores || scores.length === 0) {
      console.log(`No municipality score found for municipality ID: ${municipality.id} and catalog version: ${catalogVersionId}`);
      return null;
    }

    return {
      ...scores[0],
      municipality: municipality
    };
  } catch (error) {
    console.error('Error fetching municipality score:', error);
    return null;
  }
};

// Carousel shadow state
const scrollContainer = ref(null);
const carouselContainer = ref(null);
const showLeftShadow = ref(false);
const showRightShadow = ref(true);

// Computed property to get the correct stadtlandklima_data for the current catalog version
const filteredStadtlandklimaData = computed(() => {
  const currentCatalogScore = municipalityScoresByCatalog.value[selectedCatalogVersion.value.id];
  if (!currentCatalogScore) return null;
  
  return {
    slug: currentCatalogScore.municipality?.slug,
    percentage_rated: parseFloat(currentCatalogScore.percentage_rated),
    score_total: parseFloat(currentCatalogScore.score_total)
  };
});

const updateShadows = () => {
  if (!scrollContainer.value) return;
  
  const { scrollLeft, scrollWidth, clientWidth } = scrollContainer.value;
  
  // Show left shadow if scrolled right
  showLeftShadow.value = scrollLeft > 0;
  
  // Show right shadow if not scrolled to the end
  showRightShadow.value = scrollLeft < scrollWidth - clientWidth - 1;
};

const fitBoundsToGeoArea = (ars, geoArea) => {
  const mapRef = nearbyMapRefs.value[ars];
  if (!geoArea || !mapRef?.leafletObject) {
    return;
  }

  try {
    const leafletMap = mapRef.leafletObject;
    const geoJsonLayer = L.geoJSON(geoArea);
    const bounds = geoJsonLayer.getBounds();
    
    if (bounds.isValid()) {
      leafletMap.fitBounds(bounds, { 
        padding: [20, 20],
        maxZoom: 12
      });
    }
  } catch (error) {
    console.warn('Could not fit bounds to geoArea for nearby map:', error);
  }
};

const onNearbyMapReady = (ars, geoArea) => {
  setTimeout(() => {
    const mapRef = nearbyMapRefs.value[ars];
    if (mapRef?.leafletObject) {
      mapRef.leafletObject.invalidateSize();
      fitBoundsToGeoArea(ars, geoArea);
    }
  }, 100);
  
  setTimeout(() => {
    const mapRef = nearbyMapRefs.value[ars];
    if (mapRef?.leafletObject) {
      mapRef.leafletObject.invalidateSize();
      fitBoundsToGeoArea(ars, geoArea);
    }
  }, 500);
};

const onNearbyGeoJsonReady = (ars, geoArea) => {
  nextTick(() => {
    const mapRef = nearbyMapRefs.value[ars];
    if (mapRef?.leafletObject) {
      mapRef.leafletObject.invalidateSize();
      fitBoundsToGeoArea(ars, geoArea);
    }
  });
  
  setTimeout(() => {
    const mapRef = nearbyMapRefs.value[ars];
    if (mapRef?.leafletObject) {
      mapRef.leafletObject.invalidateSize();
      fitBoundsToGeoArea(ars, geoArea);
    }
  }, 300);
};

// Find the nearest parent area that is reasonable for municipal rating (levels 4-6 only)
const findReasonableParent = async (containedBy) => {
  if (!containedBy || containedBy.length === 0) return null;
  // Filter to levels 4-6, sort by level descending (most specific first)
  const candidates = containedBy
    .filter(a => a.level >= 4 && a.level <= 6)
    .sort((a, b) => b.level - a.level);
  for (const parent of candidates) {
    try {
      const data = await $stadtlandzahlAPI.fetchStatsByARS(parent.ars);
      if (data?.is_reasonable_for_municipal_rating === true) {
        return { ars: parent.ars, name: data.name, prefix: data.prefix };
      }
    } catch (_) {
      // try next candidate
    }
  }
  return null;
};

onMounted(async () => {
  // Default open on lg+ screens (≥1024px), collapsed on mobile/tablet
  catalogOpen.value = typeof window !== 'undefined' && window.innerWidth >= 1024;

  try {
    // Start both fetches in parallel for better performance
    const [result, scores] = await Promise.all([
      $stadtlandzahlAPI.fetchStatsByARS(route.params.ars),
      fetchAllMunicipalityScores(route.params.ars)
    ]);

    console.log('API result:', result);
    console.log('data_products:', result?.data_products);
    console.log('data_products keys:', result?.data_products ? Object.keys(result.data_products) : 'none');
    
    // Set municipality scores for all catalogs immediately
    municipalityScoresByCatalog.value = scores;
    
    if (result) {
      // Redirect level 1-3 areas (Germany, federal states, Regierungsbezirke) to /regions/
      if (result.level <= 3) {
        await navigateTo(`/regions/${route.params.ars}`, { replace: true });
        return;
      }

      stats.value = result;

      // For level 4-6 not-reasonable areas, find the best reasonable parent
      if (!result.is_reasonable_for_municipal_rating) {
        reasonableParent.value = await findReasonableParent(result.contained_by);
      } else {
        await fetchNearbyAlternatives(result);
      }
      
      // Update shadows after content is loaded
      await nextTick();
      updateShadows();
    }

    console.log('Stats set to:', stats.value);
    console.log('Municipality scores by catalog set to:', municipalityScoresByCatalog.value);
  } catch (error) {
    console.error('Error fetching stats:', error);
    stats.value = { name: 'Fehler beim Laden', prefix: '' };
  }
});

// Helper functions for dynamic data product rendering
const getProductTitle = (productData) => {
  return productData?.property_info?.title?.['de-DE'] || productData?.property_info?.title?.['en-US'] || ''
}

const getProductDescription = (productData) => {
  return productData?.property_info?.description?.['de-DE'] || productData?.property_info?.description?.['en-US'] || ''
}

const getProductCalculation = (productData) => {
  return productData?.property_info?.calculation?.['de-DE'] || productData?.property_info?.calculation?.['en-US'] || ''
}

const getDataSources = (productData) => {
  if (productData?.data_source_download) {
    return [productData.data_source_download]
  }
  if (productData?.pipeline_run?.downloads) {
    return productData.pipeline_run.downloads
  }
  return []
}


const getHistogramConfig = (productKey, productData) => {
  // Get the first render item to determine the primary attribute
  const firstRender = productData?.property_info?.display_config?.render?.[0]
  if (!firstRender) return null
  
  // Check if histogram URL is available
  const histogramUrl = productData?.histograms?.[firstRender.key]
  if (!histogramUrl) return null
  
  // Get the unit to check if it's a percentage
  let unit = firstRender.unit
  if (typeof firstRender.unit === 'object') {
    unit = firstRender.unit['de-DE'] || firstRender.unit['en-US'] || ''
  }
  const isPercentage = unit === '%' || unit.includes('%')
  
  // Pass the productKey directly (snake_case format like 'ev_charging_data')
  // The mapping to GraphQL field names is handled by the components
  return {
    histogramUrl: histogramUrl,
    dataType: productKey,
    attributeName: firstRender.key,
    currentValue: productData[firstRender.key],
    municipalityName: stats.value?.name || null,
    title: getProductTitle(productData),
    unit: unit,
    populationNormalized: firstRender.population_normalized || false,
    population: stats.value?.data_products?.population_data?.population || null,
    isPercentage: isPercentage,
    orangeThreshold: firstRender.thresholds?.orange || null,
    yellowThreshold: firstRender.thresholds?.yellow || null,
    lightGreenThreshold: firstRender.thresholds?.lightgreen || null,
    darkGreenThreshold: firstRender.thresholds?.darkgreen || null
  }
}

const formatValue = (value) => {
  if (typeof value === 'number') {
    return value.toLocaleString()
  }
  return value
}

const getUnit = (renderItem) => {
  let unit = renderItem.unit
  if (typeof renderItem.unit === 'object') {
    unit = renderItem.unit['de-DE'] || renderItem.unit['en-US'] || ''
  }
  if (renderItem.population_normalized) {
    unit += " / 1000 " + $t('stats.inhabitants_abbrev')
  }
  return unit
}

const calculateProgress = (productData, renderItem) => {
  let value = productData[renderItem.key]
  
  // If value is not available, return 0
  if (value === null || value === undefined) return 0
  
  // Check if we need to normalize by population
  if (renderItem.population_normalized && stats.value?.data_products?.population_data?.population) {
    const population = stats.value.data_products.population_data.population
    // Normalize and convert to per-1000-inhabitants (multiply by 1000)
    value = (value / population) * 1000
  }
  if (renderItem.is_percentage) {
    // If it's a percentage, ensure it's between 0 and 100
    value = value * 100
  }
  
  return value
}

async function fetchNearbyAlternatives(currentArea) {
  console.log("Fetching nearby alternatives for area:", currentArea);
  if (currentArea.is_reasonable_for_municipal_rating === false || !currentArea.ars) {
    console.log('Area not reasonable for municipal rating or missing ARS, skipping nearby alternatives fetch.');
    return;
  }
  
  loadingNearbyAreas.value = true;
  try {
    // Fetch bordering municipalities using REST API
    console.log('Fetching bordering municipalities for:', currentArea.ars);
    const config = useRuntimeConfig();
    const baseUrl = config.public.stadtlandzahlUrl?.replace('/graphql/', '').replace('/graphql', '') || 'http://localhost:8000';
    const apiUrl = `${baseUrl}/api/areas/${currentArea.ars}/bordering-municipalities/`;
    
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('Bordering municipalities result:', result);

    if (result?.bordering_municipalities) {
      // Fetch municipality scores for each nearby area from Directus
      const nearbyAreasWithScores = await Promise.all(
        result.bordering_municipalities.map(async (area) => {
          const score = await fetchMunicipalityScore(area.ars, selectedCatalogVersion.value.id);
          
          return {
            ars: area.ars,
            name: area.name,
            prefix: area.prefix,
            hasRating: score && score.municipality?.slug && score.percentage_rated > 0,
            stadtlandklimaData: score ? {
              slug: score.municipality?.slug,
              scoreTotal: score.score_total,
              percentageRated: score.percentage_rated,
            } : null,
            geoCenter: area.geo_center,
            geoArea: area.geo_area,
          };
        })
      );
      
      nearbyAreas.value = nearbyAreasWithScores;
      console.log('Nearby areas set to:', nearbyAreas.value);
      
      // Update shadows after nearby areas are loaded
      await nextTick();
      updateShadows();
    }
  } catch (error) {
    console.error('Error fetching bordering municipalities:', error);
  } finally {
    loadingNearbyAreas.value = false;
  }
}

// Computed title that updates when stats changes
const title = computed(() => {
  if (stats.value?.name) {
    return stats.value.prefix ? `${stats.value.prefix} ${stats.value.name}` : stats.value.name;
  }
  return 'Statistiken';
});

// Set the page title
useHead({
  title
})

const getOrdinalSuffix = (day) => {
  if (day >= 11 && day <= 13) return '.';
  switch (day % 10) {
    case 1: return '.';
    case 2: return '.';
    case 3: return '.';
    default: return '.';
  }
};

// Check if a product type supports map visualization
const isMapSupportedForProduct = (productKey) => {
  const supportedProducts = [
    'ev_charging_data',
    'public_transport_data', 
    'wind_power_data',
    'solar_power_data'
  ]
  return supportedProducts.includes(productKey)
}
</script>

<style scoped>

/* Ensure no element can expand beyond viewport */
main {
  max-width: 100vw;
  width: 100%;
  overflow-x: hidden;
  overflow-wrap: break-word;
}

/* Fix breadcrumb arrows z-index issue */
.breadcrumbs ul li + li:before {
  z-index: 10 !important;
}
</style>

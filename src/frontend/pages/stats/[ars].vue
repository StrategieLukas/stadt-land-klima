<template>
  <main class="px-4 sm:px-6 lg:px-8 py-4 sm:py-8 max-w-4xl mx-auto w-full min-w-0">
    <div class="flex bg-blue-100 rounded-lg border-blue-600 drop-shadow-md border mx-0 my-4 p-3 sm:p-4 justify-center">
      <AdministrativeAreaSearchBar 
        base-path="/stats" 
      />
    </div>

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
      <div class="flex flex-col lg:flex-row w-full justify-between bg-gradient-to-r from-blue-50 to-indigo-50 px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8 gap-4 lg:gap-0 overflow-hidden">
        <!-- Left Column: Location Info -->
        <div class="flex-1 min-w-0 max-w-full">

          <p class="text-sm font-semibold text-gray-600 uppercase tracking-wide">
            {{ stats?.prefix || $t('generic.loading') }}
          </p>

          <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 mb-2 break-words">
            {{ stats?.name || $t('generic.loading') }}
          </h1>

          <p class="text-base lg:text-lg text-gray-600">{{ stats?.state || '' }}</p>
        </div>
        
        <!-- Right Column: Rating Status & Action -->
        <div class="flex flex-col lg:text-right space-y-3 flex-shrink-0">
          <!-- ARS -->
          <div class="lg:text-right">
            <p class="text-xs text-gray-500 font-semibold">ARS</p>
            <p class="text-sm font-mono text-gray-700">{{ stats?.ars || '-' }}</p>
          </div>
          <!-- Rating Status Badge -->
          <div v-if="stats">
            <span v-if="stats.is_reasonable_for_municipal_rating && stats.data_products?.stadtlandklima_data?.slug" 
                  class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
              {{ stats.data_products?.stadtlandklima_data?.percentage_rated }}% {{ $t('administrative_areas.rated') }}
            </span>
            <span v-else-if="stats.is_reasonable_for_municipal_rating"
                  class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
              {{ $t('administrative_areas.not_rated_yet') }}
            </span>
            <span v-else 
                  class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
              {{ $t('administrative_areas.not_reasonable_for_rating') }}
            </span>
          </div>
          
          <!-- Action Button -->
          <div v-if="stats">
            <!-- Case 1: Has rating - link to ranking -->
            <NuxtLink v-if="stats.is_reasonable_for_municipal_rating && stats.data_products?.stadtlandklima_data?.percentage_rated == 100 && stats.data_products?.stadtlandklima_data?.slug"
                      :to="`/municipalities/${stats.data_products.stadtlandklima_data.slug}`"
                      class="inline-flex items-center px-3 sm:px-4 py-2 bg-primary text-white text-xs sm:text-sm font-medium rounded-lg transition-colors shadow-sm">
              <svg class="w-4 h-4 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span class="truncate">{{ $t('stats.view_municipality_ranking') }}</span>
            </NuxtLink>
            
            <!-- Case 2: Unfinished rating - get in touch with your local team -->
            <NuxtLink v-else-if="stats.is_reasonable_for_municipal_rating && stats.data_products?.stadtlandklima_data?.percentage_rated < 95 && stats.data_products?.stadtlandklima_data?.slug"
                      :to="'/kontakt'"
                      class="inline-flex items-center px-3 sm:px-4 py-2 bg-secondary text-white text-xs sm:text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm">
              <svg class="w-4 h-4 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
              </svg>
              <span class="truncate">{{ $t('stats.participate.contact_your_local_team') }}</span>
            </NuxtLink>

            <!-- Case 3: No rating - participate button -->
            <NuxtLink v-else-if="stats.is_reasonable_for_municipal_rating"
                      :to="'/mitmachen'"
                      class="inline-flex items-center px-3 sm:px-4 py-2 bg-ranking-dark text-white text-xs sm:text-sm font-medium rounded-lg hover:bg-green-700 transition-colors shadow-sm">
              <svg class="w-4 h-4 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <span class="truncate">{{ $t('stats.participate.start_to_rank_your_municipality') }}</span>
            </NuxtLink>
          </div>
        </div>
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
                    :orange-threshold="renderItem.thresholds.orange || 0"
                    :yellow-threshold="renderItem.thresholds.yellow || 0"
                    :light-green-threshold="renderItem.thresholds.lightgreen || 0"
                    :dark-green-threshold="renderItem.thresholds.darkgreen || 0"
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

      <!-- Alternatives Section -->
      <div v-if="stats?.level >= 4" class="border-t border-b bg-blue-50 px-3 sm:px-4 lg:px-6 py-6 max-w-full overflow-hidden">
        <div class="mb-4">
          <h3 class="text-lg font-semibold text-blue-900 mb-2">
            {{ $t('administrative_areas.nearby_alternatives') }}
          </h3>
          <p class="text-sm text-blue-700">
            {{ $t('administrative_areas.nearby_alternatives_description') }}
          </p>
        </div>
        
        <!-- Loading State -->
        <div v-if="loadingNearbyAreas" class="flex items-center justify-center py-8">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span class="ml-2 text-blue-600">{{ $t('generic.loading') }}...</span>
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
                  
                  <NuxtLink :to="area.hasRating ? `/municipalities/${area.stadtlandklimaData.slug}` : `/stats/${area.ars}`"
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

const route = useRoute();
const { $t, $stadtlandzahlAPI } = useNuxtApp();
const stats = ref(null);
const nearbyAreas = ref([]);
const loadingNearbyAreas = ref(false);
const nearbyMapRefs = ref({});

// Carousel shadow state
const scrollContainer = ref(null);
const carouselContainer = ref(null);
const showLeftShadow = ref(false);
const showRightShadow = ref(true);

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

onMounted(async () => {
  try {
    const result = await $stadtlandzahlAPI.fetchStatsByARS(route.params.ars);
    console.log('API result:', result);
    console.log('data_products:', result?.data_products);
    console.log('data_products keys:', result?.data_products ? Object.keys(result.data_products) : 'none');
    
    if (result) {
      stats.value = result;
      
      await fetchNearbyAlternatives(result);
      
      // Update shadows after content is loaded
      await nextTick();
      updateShadows();
    }

    console.log('Stats set to:', stats.value);
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
    population: stats.value?.populationData?.population || null,
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
  if (!currentArea.geo_center || [1,2,3].includes(currentArea.level)) return;
  
  loadingNearbyAreas.value = true;
  try {
    // Fetch nearby reasonable alternatives
    console.log('Fetching nearby alternatives for:', currentArea.geo_center);
    const result = await $stadtlandzahlAPI.getNearbyAdministrativeAreas(
      currentArea.geo_center.coordinates[1], // latitude
      currentArea.geo_center.coordinates[0], // longitude
      15, // limit to 15 km radius
      [4,5,6]
    );
    console.log('getNearbyAdministrativeAreas result:', result);

    if (result?.allAdministrativeAreas?.edges) {
      // and filter out the current area
      nearbyAreas.value = result.allAdministrativeAreas.edges.filter(area => area.node.ars !== currentArea.ars).map(area => ({
        ars: area.node.ars,
        name: area.node.name,
        prefix: area.node.prefix,
        hasRating: area.node.stadtlandklimaData && area.node.stadtlandklimaData.slug,
        stadtlandklimaData: area.node.stadtlandklimaData,
        geoCenter: area.node.geoCenter,
        geoArea: area.node.geoArea,
      }));
      console.log('Nearby areas set to:', nearbyAreas.value);
      
      // Update shadows after nearby areas are loaded
      await nextTick();
      updateShadows();
    }
  } catch (error) {
    console.error('Error fetching nearby areas:', error);
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

// Format date to detailed string
const formatDateDetailed = (dateString) => {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  
  // Format options for detailed date display
  const options = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Berlin', // Adjust timezone as needed
    timeZoneName: 'short'
  };
  
  // Format the date
  const formatter = new Intl.DateTimeFormat('de-DE', options);
  const formattedDate = formatter.format(date);
  
  // Add ordinal suffix to day
  const day = date.getDate();
  const ordinalSuffix = getOrdinalSuffix(day);
  
  // Replace the day number with ordinal version
  return formattedDate.replace(` ${day} `, ` ${day}${ordinalSuffix} `);
};

const getOrdinalSuffix = (day) => {
  if (day >= 11 && day <= 13) return '.';
  switch (day % 10) {
    case 1: return '.';
    case 2: return '.';
    case 3: return '.';
    default: return '.';
  }
};
</script>

<style scoped>

/* Ensure no element can expand beyond viewport */
main {
  max-width: 100vw;
  width: 100%;
  overflow-x: hidden;
  overflow-wrap: break-word;
}
</style>

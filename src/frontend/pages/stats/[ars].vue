<template>
  <main class="px-4 sm:px-6 lg:px-8 py-4 sm:py-8 max-w-4xl mx-auto w-full min-w-0">
    <div class="flex bg-blue-100 rounded-lg border-blue-600 drop-shadow-md border mx-0 sm:mx-4 my-4 p-3 sm:p-4 justify-center">
      <AdministrativeAreaSearchBar 
        base-path="/stats" 
      />
    </div>

    <!-- Main Info Container -->
    <div class="bg-white rounded-lg shadow-lg overflow-hidden mt-6 min-w-0 max-w-full">
      <!-- Breadcrumbs section from contaned by -->
      <div class="breadcrumbs bg-gray-50 px-3 sm:px-4 lg:px-6 py-3 text-sm text-gray-600 overflow-x-auto">
        <ul class="flex flex-row flex-nowrap items-center min-w-0">
          <li v-for="containedArea in stats?.containedBy?.edges" :key="containedArea.node.ars" class="flex-shrink-0">
            <NuxtLink :to="`/stats/${containedArea.node.ars}`" class="hover:underline whitespace-nowrap text-xs sm:text-sm">
              {{ containedArea.node.prefix }} {{ containedArea.node.name }}
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
            <span v-if="stats.isReasonableForMunicipalRating && stats.stadtlandklimaData?.slug" 
                  class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
              {{ stats.stadtlandklimaData?.percentageRated }}% {{ $t('administrative_areas.rated') }}
            </span>
            <span v-else-if="stats.isReasonableForMunicipalRating"
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
            <NuxtLink v-if="stats.isReasonableForMunicipalRating && stats.stadtlandklimaData?.percentageRated == 100 && stats.stadtlandklimaData?.slug"
                      :to="`/municipalities/${stats.stadtlandklimaData.slug}`"
                      class="inline-flex items-center px-3 sm:px-4 py-2 bg-primary text-white text-xs sm:text-sm font-medium rounded-lg transition-colors shadow-sm">
              <svg class="w-4 h-4 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span class="truncate">{{ $t('stats.view_municipality_ranking') }}</span>
            </NuxtLink>
            
            <!-- Case 2: Unfinished rating - get in touch with your local team -->
            <NuxtLink v-else-if="stats.isReasonableForMunicipalRating && stats.stadtlandklimaData?.percentageRated < 95 && stats.stadtlandklimaData?.slug"
                      :to="'/kontakt'"
                      class="inline-flex items-center px-3 sm:px-4 py-2 bg-secondary text-white text-xs sm:text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm">
              <svg class="w-4 h-4 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
              </svg>
              <span class="truncate">{{ $t('stats.participate.contact_your_local_team') }}</span>
            </NuxtLink>

            <!-- Case 3: No rating - participate button -->
            <NuxtLink v-else-if="stats.isReasonableForMunicipalRating"
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
    <div v-if="stats && (stats.geoCenter || stats.geoArea)" class="mt-6 bg-base-100 shadow-md overflow-hidden max-w-full">
      <AdministrativeAreaMap
        :geo-center="stats.geoCenter"
        :geo-area="stats.geoArea"
        :administrative-area-name="stats.name"
        :zoom="3"
      />
      <!-- centroid coordinates and area in km^2-->
      <div v-if="stats.geoCenter && stats.geoAreaKm2" class="text-xs sm:text-sm text-gray-600 mt-2 pb-2 text-center px-2 overflow-hidden">
        <p class="break-all max-w-full overflow-hidden">
          <span class="block sm:inline">{{ $t('administrative_areas.centroid_coordinates') }}:</span> 
          <span class="font-mono text-xs break-all">
            [{{ stats.geoCenter.coordinates[1].toFixed(4) }}, {{ stats.geoCenter.coordinates[0].toFixed(4) }}]
          </span>
          <br class="sm:hidden">
          <span class="block sm:inline sm:ml-2">{{ $t('administrative_areas.area') }}:</span> 
          <span class="font-mono break-all">
            {{ stats.geoAreaKm2.toLocaleString() }} km²
          </span>
        </p>
      </div>
    </div>

    <!-- Data Sections -->
    <div class="mt-6 space-y-6 min-w-0 max-w-full overflow-hidden">
      <!-- Population Data -->
      <DataProductViewWrapper
        v-if="stats?.populationData"
        :title="$t('stats.data.population.title')"
        :show-measure-link="false"
        :data-sources="[stats.populationData.dataSourceDownload]"
        :histogram-config="{
          dataType: 'populationData',
          attributeName: 'population',
          currentValue: stats.populationData.population,
          populationNormalized: false
        }"
      >
        <template #content>
          <div class="text-center max-w-full overflow-hidden">
            <span class="text-base sm:text-lg lg:text-2xl font-bold break-all inline-block max-w-full">{{ stats.populationData.population?.toLocaleString() }}</span>
          </div>
        </template>
      </DataProductViewWrapper>
      
      <!-- Freiflächen-PV -->
      <DataProductViewWrapper
        v-if="stats?.solarPowerData"
        :title="$t('stats.data.solar_power.title')"
        code="EN_01"
        :description="$t('stats.data.solar_power.description')"
        :calculation="$t('stats.data.solar_power.calculation')"
        :data-sources="[stats.solarPowerData.dataSourceDownload]"
        :histogram-config="{
          dataType: 'solarPowerData',
          attributeName: 'power',
          currentValue: stats.solarPowerData.power,
          populationNormalized: false
        }"
      >
        <template #content>
          <!-- <div class="text-center max-w-full overflow-hidden">
            <span class="text-base sm:text-lg lg:text-2xl font-bold break-all inline-block max-w-full">{{ stats.solarPowerData.power?.toLocaleString() }} kW</span>
          </div> -->
          <ThresholdProgressBar
            :progress="stats.solarPowerData.power / stats.populationData.population * 1000"
            :orange-threshold="1"
            :yellow-threshold="100"
            :light-green-threshold="350"
            :dark-green-threshold="1000"
            :unit="`W / ${$t('stats.inhabitants_abbrev')}`"
          />
        </template>
      </DataProductViewWrapper>

      <!-- Windkraft -->
      <DataProductViewWrapper
        v-if="stats?.windPowerData"
        :title="$t('stats.data.wind_power.title')"
        :show-measure-link="false"
        :description="$t('stats.data.wind_power.description')"
        :calculation="$t('stats.data.wind_power.calculation')"
        code="EN_02"
        :data-sources="[stats.windPowerData.dataSourceDownload]"
        :histogram-config="{
          dataType: 'windPowerData',
          attributeName: 'power',
          currentValue: stats.windPowerData.power,
          populationNormalized: false
        }"
      >
        <template #content>
          <!-- <div class="text-center max-w-full overflow-hidden">
            <span class="text-base sm:text-lg lg:text-2xl font-bold break-all inline-block max-w-full">{{ stats.windPowerData.power?.toLocaleString() }} kW</span>
          </div> -->
          <ThresholdProgressBar
            :progress="stats.windPowerData.power / stats.populationData.population * 1000"
            :orange-threshold="1"
            :yellow-threshold="200"
            :light-green-threshold="550"
            :dark-green-threshold="1500"
            :unit="`W / ${$t('stats.inhabitants_abbrev')}`"
          />
        </template>
      </DataProductViewWrapper>

      <!-- E-Ladesäulen -->
      <DataProductViewWrapper
        v-if="stats?.evChargingData"
        :title="$t('stats.data.ev_charging.title')"
        :unit="`W / ${$t('stats.inhabitants_abbrev')}`"
        :show-measure-link="false"
        :description="$t('stats.data.ev_charging.description')"
        :calculation="$t('stats.data.ev_charging.calculation')"
        code="VK_01"
        :data-sources="[stats.evChargingData.dataSourceDownload]"
        :histogram-config="{
          dataType: 'evChargingData',
          attributeName: 'power',
          currentValue: stats.evChargingData.power,
          populationNormalized: true
        }"
      >
        <template #content>
          <ThresholdProgressBar
            :progress="stats.evChargingData.power / stats.populationData.population * 1000"
            :orange-threshold="25"
            :yellow-threshold="50"
            :light-green-threshold="100"
            :dark-green-threshold="150"
            :unit="`W / ${$t('stats.inhabitants_abbrev')}`"
          />
        </template>
      </DataProductViewWrapper>

      <!-- Öffentlicher Nahverkehr -->
      <DataProductViewWrapper
        v-if="stats?.publicTransportScoreData"
        :title="$t('stats.data.public_transport.title')"
        unit="km/h"
        :description="$t('stats.data.public_transport.description')"
        :calculation="`Monte-Carlo-Simulation mit n=${stats.publicTransportScoreData.simulationCount} Simulationen innerhalb des Verwaltungsgebiets. Für das Routing wurde die Programmbibliothek r5py genutzt. Zeitliches Sampling aus der Zeitverwendungsstudie 2022, räumliches aus der Bevölkerungsdichte (JRC Census 2021 Daten). Die Fahrplansolldaten gelten für den Zeitraum von ${formatDateDetailed(stats.publicTransportScoreData.validSinceDt)} bis ${formatDateDetailed(stats.publicTransportScoreData.validUntilDt)}.`"
        :show-measure-link="false"
        :data-sources="stats.publicTransportScoreData.pipelineRun?.downloads"
        code="VK_05"
        :histogram-config="{
          dataType: 'publicTransportScoreData',
          attributeName: 'commonTravelVelocity',
          currentValue: stats.publicTransportScoreData.commonTravelVelocity,
          populationNormalized: false
        }"
      >
        <template #content>
          <div class="grow">
            <ThresholdProgressBar
              :progress="stats.publicTransportScoreData.commonTravelVelocity"
              :orange-threshold="3.0"
              :yellow-threshold="3.5"
              :light-green-threshold="4.5"
              :dark-green-threshold="5.5"
              :unit="`km/h`"
            />
            <!-- Mean Travel Time -->
            <div class="max-w-full overflow-hidden">
              <span class="font-bold text-left text-xs sm:text-sm lg:text-base break-all inline-block max-w-full">
                Reisezeit: {{ `(${Math.round(stats.publicTransportScoreData.meanTravelTimeMinutes)} ± ${Math.round(stats.publicTransportScoreData.stdDevTravelTimeMinutes)}) min` }}
              </span>
            </div>
          </div>
        </template>
      </DataProductViewWrapper>

      <!-- Radwege Infrastruktur Daten -->
      <DataProductViewWrapper
        v-if="stats?.cyclewayInfrastructureData"
        :title="$t('stats.data.cyclewayInfrastructureData.title')"
        :description="$t('stats.data.cyclewayInfrastructureData.description')"
        :calculation="$t('stats.data.cyclewayInfrastructureData.calculation')"
        code="VK_16"
        unit="%"
        :show-measure-link="false"
        :data-sources="[stats.cyclewayInfrastructureData.dataSourceDownload]"
        :histogram-config="{
          dataType: 'cyclewayInfrastructureData',
          attributeName: 'bicycleInfrastructureRatio',
          currentValue: stats.cyclewayInfrastructureData.bicycleInfrastructureRatio * 100,
          populationNormalized: false
        }"
      >
        <template #content>
          <ThresholdProgressBar
            :progress="stats.cyclewayInfrastructureData.bicycleInfrastructureRatio*100"
            :orange-threshold="10"
            :yellow-threshold="15"
            :light-green-threshold="20"
            :dark-green-threshold="25"
            unit="%"
          />
        </template>
      </DataProductViewWrapper>

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
                    :zoom="10"
                    :center="[area.geoCenter?.coordinates[1] || 51.1657, area.geoCenter?.coordinates[0] || 10.4515]"
                    class="h-full w-full z-0"
                    :options="{ zoomControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false }"
                  >
                    <LTileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    />
                    <LGeoJson
                      v-if="area.geoArea"
                      :geojson="area.geoArea"
                      :options="{ style: { color: '#3B82F6', weight: 2, fillColor: '#3B82F6', fillOpacity: 0.3 } }"
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

onMounted(async () => {
  try {
    const result = await $stadtlandzahlAPI.fetchStatsByARS(route.params.ars);
    console.log('API result:', result);
    
    // Extract the first administrative area from the GraphQL response
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

async function fetchNearbyAlternatives(currentArea) {
  if (!currentArea.geoCenter || [1,2,3].includes(currentArea.level)) return;
  
  loadingNearbyAreas.value = true;
  try {
    // Fetch nearby reasonable alternatives
    console.log('Fetching nearby alternatives for:', currentArea.geoCenter);
    const result = await $stadtlandzahlAPI.getNearbyAdministrativeAreas(
      currentArea.geoCenter.coordinates[1], // latitude
      currentArea.geoCenter.coordinates[0], // longitude
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

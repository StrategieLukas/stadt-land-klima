<template>
  <main class="px-4 py-8 max-w-4xl mx-auto w-full">
    <AdministrativeAreaSearchBar 
      :label="$t('administrative_areas.search.label')" 
      base-path="/stats" 
    />

    <div class="bg-stats-light px-4 mt-2 pt-8 pb-8 shadow-lg">
      <p class="mb-0 uppercase font-bold">{{ stats?.prefix || $t('generic.loading') }}</p>
      <h1 class="text-2xl font-bold">{{ stats?.name || $t('generic.loading') }}</h1>
      <h3 v-if="stats">{{ stats.state }}</h3>
      
      <!-- ARS and Rating Info -->
      <div v-if="stats" class="mt-2 mb-4 space-y-1">
        <div class="text-sm text-gray-600">
          <span class="font-medium">ARS:</span> {{ stats.ars }}
        </div>
        <div class="text-sm">
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                :class="stats.isReasonableForMunicipalRating ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'">
            {{ stats.isReasonableForMunicipalRating ? $t('administrative_areas.reasonable_for_rating') : $t('administrative_areas.not_reasonable_for_rating') }}
          </span>
        </div>
      </div>

      <!-- Rating Info and Links Section -->
      <div v-if="stats" class="mt-4 mb-4">
        <!-- Case 1: Reasonable for rating AND has rating -->
        <div v-if="stats.isReasonableForMunicipalRating && stats.stadtlandklimaData?.slug">
          <div class="flex flex-wrap gap-2 mb-3">
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              {{ Math.round(stats.stadtlandklimaData.scoreTotal * 10) / 10 }}% {{ $t('administrative_areas.overall_score') }}
            </span>
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {{ stats.stadtlandklimaData.percentageRated }}% {{ $t('administrative_areas.rated') }}
            </span>
          </div>
          <NuxtLink 
            :to="`/municipalities/${stats.stadtlandklimaData.slug}`"
            class="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            {{ $t('stats.view_municipality_ranking') }}
          </NuxtLink>
        </div>

        <!-- Case 2: Reasonable for rating BUT no rating -->
        <div v-else-if="stats.isReasonableForMunicipalRating && !stats.stadtlandklimaData?.slug">
          <div class="mb-3">
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
              {{ $t('administrative_areas.not_rated_yet') }}
            </span>
          </div>
          <NuxtLink 
            :to="'/mitmachen'"
            class="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
          >
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            {{ $t('stats.participate') }}
          </NuxtLink>
        </div>

        <!-- Case 3: Not reasonable for rating - show nearby alternatives -->
        <div v-else-if="!stats.isReasonableForMunicipalRating">
          <div class="bg-blue-50 border border-blue-200 rounded-md p-4">
            <h4 class="text-sm font-medium text-blue-900 mb-2">
              {{ $t('administrative_areas.nearby_alternatives') }}
            </h4>
            <p class="text-xs text-blue-700 mb-3">
              {{ $t('administrative_areas.nearby_alternatives_description') }}
            </p>
            
            <!-- Loading state -->
            <div v-if="loadingNearbyAreas" class="text-sm text-blue-600">
              {{ $t('generic.loading') }}...
            </div>
            
            <!-- Nearby areas list -->
            <ul v-else-if="nearbyAreas.length > 0" class="space-y-2">
              <li v-for="area in nearbyAreas" :key="area.ars" class="flex items-center justify-between">
                <div class="flex-1">
                  <div class="text-sm font-medium text-blue-900">{{ area.name }}</div>
                  <div class="text-xs text-blue-600">{{ area.prefix }}</div>
                </div>
                <div class="flex items-center space-x-2">
                  <span v-if="area.hasRating" class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                    {{ Math.round(area.stadtlandklimaData.scoreTotal * 10) / 10 }}%
                  </span>
                  <NuxtLink 
                    :to="area.hasRating ? `/municipalities/${area.stadtlandklimaData.slug}` : `/stats/${area.ars}`"
                    class="text-blue-600 hover:text-blue-800 text-xs underline"
                  >
                    {{ area.hasRating ? $t('stats.view_ranking') : $t('stats.view_stats') }}
                  </NuxtLink>
                </div>
              </li>
            </ul>
            
            <!-- No alternatives found -->
            <div v-else class="text-sm text-blue-600">
              {{ $t('administrative_areas.no_alternatives_found') }}
            </div>
          </div>
        </div>
      </div>
      
      <!-- Map Section -->
      <div v-if="stats && (stats.geoCenter || stats.geoArea)" class="mt-2 mb-2">
        <AdministrativeAreaMap
          :geo-center="stats.geoCenter"
          :geo-area="stats.geoArea"
          :administrative-area-name="stats.name"
          :zoom="3"
        />
      </div>

      <!-- Population Data -->
      <DataProductViewWrapper
        v-if="stats?.populationData"
        :title="$t('stats.population.title')"
        :show-measure-link="false"
        :data-sources="[stats.populationData.dataSourceDownload]"
        :data-license="stats.populationData.license"
      >
        <template #content>
          <div class="text-center">
            <span class="text-2xl font-bold">{{ stats.populationData.population?.toLocaleString() }}</span>
          </div>
        </template>
      </DataProductViewWrapper>
      
      <!-- Freiflächen-PV -->
      <DataProductViewWrapper
        v-if="stats?.solarPowerData"
        :title="$t('stats.solar_power.title')"
        :unit="`W / ${$t('stats.inhabitants_abbrev')}`"
        code="EN_1"
        :description="$t('stats.en_1.description')"
        :calculation="$t('stats.en_1.calculation')"
        :data-sources="[stats.solarPowerData.dataSourceDownload]"
        :data-license="stats.solarPowerData.license"
      >
        <template #content>
          <ThresholdProgressBar
            :progress="stats.solarPowerData.power / stats.populationData.population * 1000"
            :orange-threshold="30"
            :light-green-threshold="60"
            :dark-green-threshold="80"
            :unit="`W / ${$t('stats.inhabitants_abbrev')}`"
          />
        </template>
      </DataProductViewWrapper>

      <!-- Windkraft -->
      <DataProductViewWrapper
        v-if="stats?.windPowerData"
        :title="$t('stats.wind_power.title')"
        :unit="`W / ${$t('stats.inhabitants_abbrev')}`"
        :show-measure-link="false"
        description="das ist nur die Windkraft, die auf dem Gebiet der Kommune ist. Wenn die Kommune Windkraft in weiteren Orten betreibt, muss dies dazugerechnet werden."
        :data-sources="[stats.windPowerData.dataSourceDownload]"
        :data-license="stats.windPowerData.license"
      >
        <template #content>
          <ThresholdProgressBar
            :progress="stats.windPowerData.power / stats.populationData.population * 1000"
            :orange-threshold="15"
            :light-green-threshold="40"
            :dark-green-threshold="70"
            :unit="`W / ${$t('stats.inhabitants_abbrev')}`"
          />
        </template>
      </DataProductViewWrapper>

      <!-- E-Ladesäulen -->
      <DataProductViewWrapper
        v-if="stats?.evChargingData"
        :title="$t('stats.ev_charging.title')"
        :unit="`W / ${$t('stats.inhabitants_abbrev')}`"
        :show-measure-link="false"
        :data-sources="[stats.evChargingData.dataSourceDownload]"
      >
        <template #content>
          <ThresholdProgressBar
            :progress="stats.evChargingData.power / stats.populationData.population * 1000"
            :orange-threshold="20"
            :light-green-threshold="30"
            :dark-green-threshold="50"
            :unit="`W / ${$t('stats.inhabitants_abbrev')}`"
          />
        </template>
      </DataProductViewWrapper>

      <!-- Öffentlicher Nahverkehr -->
      <DataProductViewWrapper
        v-if="stats?.publicTransportScoreData"
        :title="$t('stats.public_transport.title')"
        unit="min"
        description="Mittlere Reisezeit mit dem Nahverkehr innerhalb des Verwaltungsgebiets zu gewöhnlichen Zeiten (aus Zeitverwendungsstudie 2022) von gewöhnlichen Abfahrt- und Ankunfsorten (Bevölkerungsdichte-gewichtet)."
        :calculation="`Monte-Carlo-Simulation mit n=${stats.publicTransportScoreData.simulationCount} Simulationen innerhalb des Verwaltungsgebiets. Für das Routing wurde die Programmbibliothek r5py genutzt. Zeitliches Sampling aus der Zeitverwendungsstudie 2022, räumliches aus der Bevölkerungsdichte (JRC Census 2021 Daten) .`"
        :show-measure-link="false"
        :data-sources="stats.publicTransportScoreData.pipelineRun.downloads"
      >
        <template #content>
          <div class="text-center">
            <span class="text-2xl font-bold">{{ `(${Math.round(stats.publicTransportScoreData.meanTravelTimeMinutes)} ± ${Math.round(stats.publicTransportScoreData.stdDevTravelTimeMinutes)}) min` }}</span>
          </div>
        </template>
      </DataProductViewWrapper>
    </div>
  </main>
</template>

<script setup>
import { useRoute } from 'vue-router';
import { onMounted, ref, computed } from 'vue';
import AdministrativeAreaSearchBar from '~/components/AdministrativeAreaSearchBar.vue';
import DataProductViewWrapper from '~/components/DataProductViewWrapper.vue';
import AdministrativeAreaMap from '~/components/AdministrativeAreaMap.vue';

const route = useRoute();
const { $t, $stadtlandzahlAPI } = useNuxtApp();
const stats = ref(null);
const nearbyAreas = ref([]);
const loadingNearbyAreas = ref(false);

onMounted(async () => {
  try {
    const result = await $stadtlandzahlAPI.fetchStatsByARS(route.params.ars);
    console.log('API result:', result);
    
    // Extract the first administrative area from the GraphQL response
    if (result) {
      stats.value = result;
      
      // If area is not reasonable for rating, fetch nearby alternatives
      if (!result.isReasonableForMunicipalRating) {
        await fetchNearbyAlternatives(result);
      }
    } else {
      console.error('No data found for ARS:', route.params.ars);
      stats.value = { name: 'Keine Daten gefunden', prefix: '' };
    }
    
    console.log('Stats set to:', stats.value);
  } catch (error) {
    console.error('Error fetching stats:', error);
    stats.value = { name: 'Fehler beim Laden', prefix: '' };
  }
});

async function fetchNearbyAlternatives(currentArea) {
  if (!currentArea.geoCenter) return;
  
  loadingNearbyAreas.value = true;
  try {
    // Fetch nearby reasonable alternatives
    const result = await $stadtlandzahlAPI.findNearbyReasonableAreas(
      currentArea.geoCenter.coordinates[1], // latitude
      currentArea.geoCenter.coordinates[0], // longitude
      5 // limit to 5 areas
    );
    
    if (result?.nearbyAreas) {
      nearbyAreas.value = result.nearbyAreas.map(area => ({
        ars: area.ars,
        name: area.name,
        prefix: area.prefix,
        hasRating: area.stadtlandklimaData && area.stadtlandklimaData.slug,
        stadtlandklimaData: area.stadtlandklimaData
      }));
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
</script>

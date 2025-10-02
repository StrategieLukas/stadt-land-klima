<template>
  <main class="px-4 py-8 max-w-4xl mx-auto w-full">
    <AdministrativeAreaSearchBar 
      :label="$t('administrative_areas.search.label')" 
      base-path="/stats" 
    />

    <div class="bg-very-light-blue px-4 mt-2 pt-8 pb-8 shadow-lg">
      <p class="mb-0 uppercase font-bold">{{ stats?.prefix || $t('generic.loading') }}</p>
      <h1 class="text-2xl font-bold">{{ stats?.name || $t('generic.loading') }}</h1>
      <h3 v-if="stats">{{ stats.state }}</h3>
      
      <!-- Map Section -->
      <div v-if="stats && (stats.geoCenter || stats.geoArea)" class="mb-6">
        <h2 class="text-lg font-semibold mb-3">{{ $t('stats.labels.map') }}</h2>
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
        :data-source="stats.populationData.dataSourceDownload"
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
        :data-source="stats.solarPowerData.dataSourceDownload"
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
        :data-source="stats.windPowerData.dataSourceDownload"
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
        :data-source="stats.evChargingData.dataSourceDownload"
        :data-license="stats.evChargingData.license"
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
        v-if="stats?.publicTransportScore"
        :title="$t('stats.public_transport.title')"
        unit="min"
        description="Mittlere Reisezeit mit dem Nahverkehr innerhalb des Verwaltungsgebiets zu gewöhnlichen Zeiten (aus Zeitverwendungsstudie 2022) von gewöhnlichen Abfahrt- und Ankunfsorten (Bevölkerungsdichte-gewichtet)."
        :calculation="`Monte-Carlo-Simulation mit n=${stats.publicTransportScore.simulationCount} Simulationen innerhalb des Verwaltungsgebiets. Für das Routing wurde die Programmbibliothek r5py genutzt. Zeitliches Sampling aus der Zeitverwendungsstudie 2022, räumliches aus der Bevölkerungsdichte (JRC Census 2021 Daten) .`"
        :show-measure-link="false"
        :data-source="stats.publicTransportScore.dataSourceDownload"
        :data-license="stats.publicTransportScore.license"
      >
        <template #content>
          <div class="text-center">
            <span class="text-2xl font-bold">{{ `(${Math.round(stats.publicTransportScore.meanTravelTimeMinutes)} ± ${Math.round(stats.publicTransportScore.stdDevTravelTimeMinutes)}) min` }}</span>
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

onMounted(async () => {
  try {
    const result = await $stadtlandzahlAPI.fetchStatsByARS(route.params.ars);
    console.log('API result:', result);
    
    // Extract the first administrative area from the GraphQL response
    if (result) {
      stats.value = result
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

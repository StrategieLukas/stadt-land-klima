<template>
  <main class="px-4 py-8 max-w-4xl mx-auto">
    <AdministrativeAreaSearchBar 
      :label="$t('administrative_areas_search.label')" 
      base-path="/stats" 
    />

    <div class="bg-very-light-blue px-4 mt-2 pt-8 pb-8 shadow-lg">
      <p class="mb-0 uppercase font-bold">{{ stats?.prefix || 'Lade Daten...' }}</p>
      <h1 class="text-2xl font-bold">{{ stats?.name || 'Lade Daten...' }}</h1>
      <h3 v-if="stats">{{ stats.state }}</h3>
      
      <!-- Map Section -->
      <div v-if="stats && (stats.geoCenter || stats.geoArea)" class="mb-6">
        <h2 class="text-lg font-semibold mb-3">{{ $t('stats.map.title') }}</h2>
        <AdministrativeAreaMap
          :geo-center="stats.geoCenter"
          :geo-area="stats.geoArea"
          :administrative-area-name="stats.name"
          :zoom="3"
        />
      </div>
      
      <!-- Freiflächen-PV -->
      <DataProductViewWrapper
        v-if="stats?.solarPowerData"
        title="Freiflächen-PV"
        :unit="stats.solarPowerData.powerUnit"
        code="EN_1"
        :description="$t('stats.en_1.description')"
        :calculation="$t('stats.en_1.calculation')"
        :data-source="stats.solarPowerData.dataSourceDownload"
        :data-license="stats.solarPowerData.license"
      >
        <template #content>
          <ThresholdProgressBar
            :progress="stats.solarPowerData.power"
            :orange-threshold="30"
            :light-green-threshold="60"
            :dark-green-threshold="80"
            :unit="stats.solarPowerData.powerUnit"
          />
        </template>
      </DataProductViewWrapper>

      <!-- Windkraft -->
      <DataProductViewWrapper
        v-if="stats?.windPowerData"
        title="Windkraft"
        :unit="stats.windPowerData.powerUnit"
        :show-measure-link="false"
        description="das ist nur die Windkraft, die auf dem Gebiet der Kommune ist. Wenn die Kommune Windkraft in weiteren Orten betreibt, muss dies dazugerechnet werden."
        :data-source="stats.windPowerData.dataSourceDownload"
        :data-license="stats.windPowerData.license"
      >
        <template #content>
          <ThresholdProgressBar
            :progress="stats.windPowerData.power"
            :orange-threshold="15"
            :light-green-threshold="40"
            :dark-green-threshold="70"
            :unit="stats.windPowerData.powerUnit"
          />
        </template>
      </DataProductViewWrapper>

      <!-- E-Ladesäulen -->
      <DataProductViewWrapper
        v-if="stats?.evChargingData"
        title="E-Ladesäulen"
        :unit="stats.evChargingData.powerUnit"
        :show-measure-link="false"
        :data-source="stats.evChargingData.dataSourceDownload"
        :data-license="stats.evChargingData.license"
      >
        <template #content>
          <ThresholdProgressBar
            :progress="stats.evChargingData.power"
            :orange-threshold="20"
            :light-green-threshold="30"
            :dark-green-threshold="50"
            :unit="stats.evChargingData.powerUnit"
          />
        </template>
      </DataProductViewWrapper>

      <!-- Population Data -->
      <DataProductViewWrapper
        v-if="stats?.populationData"
        title="Einwohnerzahl"
        unit="Personen"
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

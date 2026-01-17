<template>
  <aside class="w-72 bg-white border-r border-gray-200 flex flex-col h-screen sticky top-0">
    <!-- Header -->
    <div class="p-4 border-b bg-gray-50">
      <h2 class="font-bold text-gray-900">Maßnahmenkataloge</h2>
    </div>

    <!-- Catalog Tree -->
    <nav class="flex-1 overflow-y-auto p-2">
      <!-- Climate Mitigation Section -->
      <div class="mb-4">
        <div class="flex items-center gap-2 px-2 py-1 text-sm font-medium text-gray-500 uppercase tracking-wider">
          <span>🌱</span>
          <span>Klimaschutz</span>
        </div>
        <CatalogTreeItem
          v-for="catalog in mitigationCatalogs"
          :key="catalog.id"
          :catalog="catalog"
          :is-selected="selectedCatalogId === catalog.id"
          :selected-sector="selectedCatalogId === catalog.id ? selectedSector : null"
          :selected-measure-id="selectedCatalogId === catalog.id ? selectedMeasureId : null"
          :measures-by-sector="selectedCatalogId === catalog.id ? measuresBySector : {}"
          @select-catalog="$emit('select-catalog', $event)"
          @select-sector="$emit('select-sector', $event)"
          @select-measure="$emit('select-measure', $event)"
        />
        <div v-if="mitigationCatalogs.length === 0" class="px-4 py-2 text-sm text-gray-400 italic">
          Keine Kataloge
        </div>
      </div>

      <!-- Climate Adaption Section -->
      <div class="mb-4">
        <div class="flex items-center gap-2 px-2 py-1 text-sm font-medium text-gray-500 uppercase tracking-wider">
          <span>🌊</span>
          <span>Klimaanpassung</span>
        </div>
        <CatalogTreeItem
          v-for="catalog in adaptionCatalogs"
          :key="catalog.id"
          :catalog="catalog"
          :is-selected="selectedCatalogId === catalog.id"
          :selected-sector="selectedCatalogId === catalog.id ? selectedSector : null"
          :selected-measure-id="selectedCatalogId === catalog.id ? selectedMeasureId : null"
          :measures-by-sector="selectedCatalogId === catalog.id ? measuresBySector : {}"
          @select-catalog="$emit('select-catalog', $event)"
          @select-sector="$emit('select-sector', $event)"
          @select-measure="$emit('select-measure', $event)"
        />
        <div v-if="adaptionCatalogs.length === 0" class="px-4 py-2 text-sm text-gray-400 italic">
          Keine Kataloge
        </div>
      </div>
    </nav>

    <!-- Footer -->
    <div class="p-3 border-t bg-gray-50">
      <NuxtLink 
        to="/admin/catalogs"
        class="flex items-center justify-center gap-2 w-full px-3 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        Kataloge verwalten
      </NuxtLink>
    </div>
  </aside>
</template>

<script setup>
import { computed } from 'vue';
import CatalogTreeItem from './CatalogTreeItem.vue';

const props = defineProps({
  catalogs: {
    type: Array,
    default: () => []
  },
  selectedCatalogId: {
    type: String,
    default: null
  },
  selectedSector: {
    type: String,
    default: null
  },
  selectedMeasureId: {
    type: String,
    default: null
  },
  measuresBySector: {
    type: Object,
    default: () => ({})
  }
});

defineEmits(['select-catalog', 'select-sector', 'select-measure']);

const mitigationCatalogs = computed(() => {
  return props.catalogs.filter(c => c.catalog_type === 'climate_mitigation');
});

const adaptionCatalogs = computed(() => {
  return props.catalogs.filter(c => c.catalog_type === 'climate_adaption');
});
</script>

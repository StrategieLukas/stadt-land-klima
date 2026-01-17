<template>
  <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
    <!-- Section Header -->
    <div 
      class="px-6 py-4 border-b"
      :class="headerClass"
    >
      <div class="flex items-center gap-3">
        <span class="text-2xl">{{ catalogType.icon }}</span>
        <h2 class="text-xl font-bold" :class="textClass">
          {{ catalogType.label }}
        </h2>
        <span class="text-sm text-gray-500">
          ({{ catalogs.length }} {{ catalogs.length === 1 ? 'Katalog' : 'Kataloge' }})
        </span>
      </div>
    </div>

    <!-- Catalogs Table -->
    <div v-if="catalogs.length > 0" class="overflow-x-auto">
      <table class="w-full">
        <thead class="bg-gray-50 border-b">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Katalog
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Typ
            </th>
            <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              Frontend
            </th>
            <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              Backend
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Statistik
            </th>
            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Aktionen
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200">
          <template v-for="catalog in catalogs" :key="catalog.id">
            <tr 
              class="hover:bg-gray-50 transition-colors"
            >
              <!-- Expand Button + Catalog Name -->
              <td class="px-6 py-4">
                <div class="flex items-center gap-3">
                  <button
                    @click="toggleExpanded(catalog.id)"
                    class="p-1 hover:bg-gray-100 rounded transition-colors"
                    :title="expandedCatalogId === catalog.id ? 'Zuklappen' : 'Aufklappen'"
                  >
                    <svg 
                      class="w-5 h-5 text-gray-400 transition-transform"
                      :class="{ 'transform rotate-90': expandedCatalogId === catalog.id }"
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                  <div>
                    <div class="font-medium text-gray-900">{{ catalog.name }}</div>
                    <div v-if="catalog.version_number" class="text-sm text-gray-500">
                      v{{ catalog.version_number }}
                    </div>
                  </div>
                  <span 
                    v-if="catalog.hidden" 
                    class="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded"
                  >
                    Versteckt
                  </span>
                </div>
              </td>

            <!-- Rating Type -->
            <td class="px-6 py-4">
              <span 
                class="px-2 py-1 text-xs font-medium rounded-full"
                :class="catalog.uses_structured_ratings 
                  ? 'bg-purple-100 text-purple-700' 
                  : 'bg-gray-100 text-gray-700'"
              >
                {{ catalog.uses_structured_ratings ? 'Strukturiert' : 'Legacy' }}
              </span>
            </td>

            <!-- Frontend Radio -->
            <td class="px-6 py-4 text-center">
              <input
                type="radio"
                :name="`frontend-${catalogType.value}`"
                :checked="catalog.isCurrentFrontend"
                @change="$emit('set-current', catalog.id, 'isCurrentFrontend', catalogType.value)"
                class="w-4 h-4 text-green-600 border-gray-300 focus:ring-green-500"
              />
            </td>

            <!-- Backend Radio -->
            <td class="px-6 py-4 text-center">
              <input
                type="radio"
                :name="`backend-${catalogType.value}`"
                :checked="catalog.isCurrentBackend"
                @change="$emit('set-current', catalog.id, 'isCurrentBackend', catalogType.value)"
                class="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
              />
            </td>

            <!-- Stats -->
            <td class="px-6 py-4">
              <CatalogStatsDisplay 
                :catalog="catalog"
                :stats="catalogStats[catalog.id]"
              />
            </td>

            <!-- Actions -->
            <td class="px-6 py-4 text-right">
              <div class="flex items-center justify-end gap-2">
                <button
                  @click="$emit('open', catalog)"
                  class="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                  title="Maßnahmen öffnen"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                <button
                  @click="$emit('edit', catalog)"
                  class="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Bearbeiten"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  v-if="!catalog.isCurrentFrontend && !catalog.isCurrentBackend"
                  @click="$emit('delete', catalog)"
                  class="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Löschen"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </td>
          </tr>
          
          <!-- Expanded Measures Row -->
          <tr v-if="expandedCatalogId === catalog.id">
            <td colspan="6" class="p-0">
              <CatalogMeasuresList :catalog-id="catalog.id" />
            </td>
          </tr>
          </template>
        </tbody>
      </table>
    </div>

    <!-- Empty State -->
    <div v-else class="px-6 py-12 text-center">
      <svg class="w-12 h-12 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <p class="text-gray-500">Noch keine Kataloge für {{ catalogType.label }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import CatalogStatsDisplay from './CatalogStatsDisplay.vue';
import CatalogMeasuresList from './CatalogMeasuresList.vue';

const props = defineProps({
  catalogType: {
    type: Object,
    required: true
  },
  catalogs: {
    type: Array,
    default: () => []
  },
  catalogStats: {
    type: Object,
    default: () => ({})
  }
});

defineEmits(['set-current', 'edit', 'delete', 'open']);

const expandedCatalogId = ref(null);

function toggleExpanded(catalogId) {
  expandedCatalogId.value = expandedCatalogId.value === catalogId ? null : catalogId;
}

const headerClass = computed(() => {
  return props.catalogType.color === 'green'
    ? 'bg-green-50 border-green-200'
    : 'bg-blue-50 border-blue-200';
});

const textClass = computed(() => {
  return props.catalogType.color === 'green'
    ? 'text-green-800'
    : 'text-blue-800';
});
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <header class="bg-white shadow">
      <div class="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-4">
            <NuxtLink to="/admin/dashboard" class="text-gray-500 hover:text-gray-700">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </NuxtLink>
            <h1 class="text-2xl font-bold text-gray-900">
              {{ $t('admin.catalogs.title') }}
            </h1>
          </div>
          <button 
            @click="showCreateModal = true"
            class="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            {{ $t('admin.catalogs.create_new') }}
          </button>
        </div>
      </div>
    </header>

    <main class="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      <!-- Access Denied -->
      <div v-if="!canManageCatalogVersions" class="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <svg class="w-12 h-12 mx-auto text-red-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <h3 class="text-lg font-medium text-red-800">{{ $t('admin.access_denied') }}</h3>
        <p class="text-red-600 mt-2">{{ $t('admin.admin_required') }}</p>
      </div>

      <!-- Loading -->
      <div v-else-if="isLoading" class="flex justify-center py-12">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>

      <!-- Catalog Types -->
      <div v-else class="space-y-8">
        <CatalogTypeSection
          v-for="catalogType in catalogTypes"
          :key="catalogType.value"
          :catalog-type="catalogType"
          :catalogs="catalogsByType[catalogType.value] || []"
          :catalog-stats="catalogStats"
          @set-current="handleSetCurrent"
          @edit="handleEditCatalog"
          @delete="handleDeleteCatalog"
          @open="handleOpenCatalog"
        />
      </div>
    </main>

    <!-- Create Catalog Modal -->
    <CreateCatalogModal
      v-model:visible="showCreateModal"
      :existing-catalogs="catalogs"
      @created="handleCatalogCreated"
    />

    <!-- Edit Catalog Modal -->
    <EditCatalogModal
      v-if="editingCatalog"
      :catalog="editingCatalog"
      @close="editingCatalog = null"
      @saved="handleCatalogSaved"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { usePermissions } from '~/composables/usePermissions';
import { useCatalogAdmin } from '~/composables/useCatalogAdmin';
import CatalogTypeSection from '~/components/admin/CatalogTypeSection.vue';
import CreateCatalogModal from '~/components/admin/CreateCatalogModal.vue';
import EditCatalogModal from '~/components/admin/EditCatalogModal.vue';

const { $t } = useNuxtApp();
const router = useRouter();

const { canManageCatalogVersions } = usePermissions();
const { 
  catalogs, 
  catalogStats, 
  catalogsByType,
  isLoading, 
  fetchCatalogs,
  setCurrentCatalog,
  deleteCatalog
} = useCatalogAdmin();

// State
const showCreateModal = ref(false);
const editingCatalog = ref(null);

// Catalog types configuration
const catalogTypes = [
  { 
    value: 'climate_mitigation', 
    label: 'Klimaschutz',
    icon: '🌱',
    color: 'green'
  },
  { 
    value: 'climate_adaption', 
    label: 'Klimaanpassung',
    icon: '🌊',
    color: 'blue'
  }
];

// Handlers
async function handleSetCurrent(catalogId, field, catalogType) {
  await setCurrentCatalog(catalogId, field, catalogType);
}

function handleEditCatalog(catalog) {
  editingCatalog.value = catalog;
}

async function handleDeleteCatalog(catalog) {
  if (confirm($t('admin.catalogs.confirm_delete', { name: catalog.name }))) {
    await deleteCatalog(catalog.id);
  }
}

function handleOpenCatalog(catalog) {
  router.push(`/admin/measures?catalog=${catalog.id}`);
}

function handleCatalogCreated() {
  showCreateModal.value = false;
  fetchCatalogs();
}

function handleCatalogSaved() {
  editingCatalog.value = null;
  fetchCatalogs();
}

// Page meta
useHead({
  title: 'Katalogverwaltung - Admin'
});

// Load data
onMounted(() => {
  if (canManageCatalogVersions.value) {
    fetchCatalogs();
  }
});
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <!-- Backdrop -->
      <div 
        class="absolute inset-0 bg-black/50"
        @click="$emit('close')"
      ></div>

      <!-- Modal -->
      <div class="relative bg-white rounded-xl shadow-2xl w-full max-w-lg">
        <!-- Header -->
        <div class="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
          <h3 class="text-lg font-bold text-gray-900">
            Katalog bearbeiten
          </h3>
          <button 
            @click="$emit('close')"
            class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Form -->
        <form @submit.prevent="handleSubmit" class="p-6 space-y-5">
          <!-- Name -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Name *
            </label>
            <input
              v-model="formData.name"
              type="text"
              required
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
          </div>

          <!-- Version Number -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Versionsnummer
            </label>
            <input
              v-model="formData.version_number"
              type="text"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
          </div>

          <!-- Description -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Beschreibung
            </label>
            <textarea
              v-model="formData.description"
              rows="3"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            ></textarea>
          </div>

          <!-- Catalog Type (Read-only info) -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Katalogtyp
            </label>
            <div class="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-600">
              {{ catalog.catalog_type === 'climate_mitigation' ? '🌱 Klimaschutz' : '🌊 Klimaanpassung' }}
            </div>
            <p class="text-xs text-gray-500 mt-1">Katalogtyp kann nicht geändert werden</p>
          </div>

          <!-- Rating System (Read-only info) -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Bewertungssystem
            </label>
            <div class="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-600">
              {{ catalog.uses_structured_ratings ? 'Strukturiert' : 'Legacy' }}
            </div>
            <p class="text-xs text-gray-500 mt-1">Bewertungssystem kann nicht geändert werden</p>
          </div>

          <!-- Hidden -->
          <div>
            <label class="flex items-center gap-3">
              <input
                v-model="formData.hidden"
                type="checkbox"
                class="w-4 h-4 text-gray-600 rounded"
              />
              <span class="text-sm text-gray-700">
                Katalog verstecken
              </span>
            </label>
          </div>
        </form>

        <!-- Footer -->
        <div class="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50">
          <button
            type="button"
            @click="$emit('close')"
            class="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            :disabled="isSubmitting"
          >
            Abbrechen
          </button>
          <button
            @click="handleSubmit"
            class="px-4 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
            :disabled="isSubmitting"
          >
            {{ isSubmitting ? 'Speichern...' : 'Speichern' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useCatalogAdmin } from '~/composables/useCatalogAdmin';

const props = defineProps({
  catalog: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['close', 'saved']);

const { updateCatalog } = useCatalogAdmin();

const formData = ref({
  name: '',
  version_number: '',
  description: '',
  hidden: false
});

const isSubmitting = ref(false);

// Initialize form with catalog data
watch(() => props.catalog, (catalog) => {
  if (catalog) {
    formData.value = {
      name: catalog.name || '',
      version_number: catalog.version_number || '',
      description: catalog.description || '',
      hidden: catalog.hidden || false
    };
  }
}, { immediate: true });

async function handleSubmit() {
  if (isSubmitting.value) return;
  
  isSubmitting.value = true;
  
  try {
    const success = await updateCatalog(props.catalog.id, formData.value);
    
    if (success) {
      emit('saved');
    }
  } finally {
    isSubmitting.value = false;
  }
}
</script>

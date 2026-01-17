<template>
  <Teleport to="body">
    <Transition name="modal">
      <div 
        v-if="visible" 
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <!-- Backdrop -->
        <div 
          class="absolute inset-0 bg-black/50"
          @click="$emit('update:visible', false)"
        ></div>

        <!-- Modal -->
        <div class="relative bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden">
          <!-- Header -->
          <div class="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
            <h3 class="text-lg font-bold text-gray-900">
              Neuen Maßnahmenkatalog erstellen
            </h3>
            <button 
              @click="$emit('update:visible', false)"
              class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Form -->
          <form @submit.prevent="handleSubmit" class="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-140px)]">
            <!-- Name -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Name *
              </label>
              <input
                v-model="formData.name"
                type="text"
                required
                placeholder="z.B. v2.0"
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
                placeholder="z.B. 2.0.0"
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
                placeholder="Optionale Beschreibung des Katalogs..."
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              ></textarea>
            </div>

            <!-- Catalog Type -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Katalogtyp *
              </label>
              <div class="grid grid-cols-2 gap-3">
                <label 
                  class="flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors"
                  :class="formData.catalog_type === 'climate_mitigation' 
                    ? 'border-green-500 bg-green-50' 
                    : 'border-gray-200 hover:border-gray-300'"
                >
                  <input
                    v-model="formData.catalog_type"
                    type="radio"
                    value="climate_mitigation"
                    class="text-green-600"
                  />
                  <div>
                    <span class="text-lg mr-2">🌱</span>
                    <span class="font-medium">Klimaschutz</span>
                  </div>
                </label>
                <label 
                  class="flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors"
                  :class="formData.catalog_type === 'climate_adaption' 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300'"
                >
                  <input
                    v-model="formData.catalog_type"
                    type="radio"
                    value="climate_adaption"
                    class="text-blue-600"
                  />
                  <div>
                    <span class="text-lg mr-2">🌊</span>
                    <span class="font-medium">Klimaanpassung</span>
                  </div>
                </label>
              </div>
            </div>

            <!-- Rating System -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Bewertungssystem *
              </label>
              <div class="grid grid-cols-2 gap-3">
                <label 
                  class="flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors"
                  :class="!formData.uses_structured_ratings 
                    ? 'border-gray-500 bg-gray-50' 
                    : 'border-gray-200 hover:border-gray-300'"
                >
                  <input
                    v-model="formData.uses_structured_ratings"
                    type="radio"
                    :value="false"
                    class="mt-1"
                  />
                  <div>
                    <div class="font-medium">Legacy</div>
                    <div class="text-xs text-gray-500">Einfache Bewertungen</div>
                  </div>
                </label>
                <label 
                  class="flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors"
                  :class="formData.uses_structured_ratings 
                    ? 'border-purple-500 bg-purple-50' 
                    : 'border-gray-200 hover:border-gray-300'"
                >
                  <input
                    v-model="formData.uses_structured_ratings"
                    type="radio"
                    :value="true"
                    class="mt-1"
                  />
                  <div>
                    <div class="font-medium">Strukturiert</div>
                    <div class="text-xs text-gray-500">Mit Kriterien & Entscheidungsbäumen</div>
                  </div>
                </label>
              </div>
            </div>

            <!-- Import from existing -->
            <div class="pt-4 border-t">
              <label class="flex items-center gap-3 mb-3">
                <input
                  v-model="importFromExisting"
                  type="checkbox"
                  class="w-4 h-4 text-green-600 rounded"
                />
                <span class="text-sm font-medium text-gray-700">
                  Maßnahmen aus bestehendem Katalog importieren
                </span>
              </label>
              
              <div v-if="importFromExisting" class="ml-7">
                <select
                  v-model="formData.importFromCatalogId"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                >
                  <option value="">Katalog auswählen...</option>
                  <option 
                    v-for="catalog in existingCatalogs" 
                    :key="catalog.id"
                    :value="catalog.id"
                  >
                    {{ catalog.name }} ({{ catalog.catalog_type === 'climate_mitigation' ? 'Klimaschutz' : 'Klimaanpassung' }})
                  </option>
                </select>
                <p class="text-xs text-gray-500 mt-1">
                  Alle Maßnahmen werden als Entwurf kopiert
                </p>
              </div>
            </div>

            <!-- Hidden Option -->
            <div>
              <label class="flex items-center gap-3">
                <input
                  v-model="formData.hidden"
                  type="checkbox"
                  class="w-4 h-4 text-gray-600 rounded"
                />
                <span class="text-sm text-gray-700">
                  Katalog verstecken (nicht öffentlich sichtbar)
                </span>
              </label>
            </div>
          </form>

          <!-- Footer -->
          <div class="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50">
            <button
              type="button"
              @click="$emit('update:visible', false)"
              class="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              :disabled="isSubmitting"
            >
              Abbrechen
            </button>
            <button
              @click="handleSubmit"
              class="px-4 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
              :disabled="isSubmitting || !isValid"
            >
              {{ isSubmitting ? 'Erstellen...' : 'Katalog erstellen' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useCatalogAdmin } from '~/composables/useCatalogAdmin';

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  existingCatalogs: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['update:visible', 'created']);

const { createCatalog } = useCatalogAdmin();

// Form state
const formData = ref({
  name: '',
  version_number: '',
  description: '',
  catalog_type: 'climate_mitigation',
  uses_structured_ratings: false,
  hidden: false,
  importFromCatalogId: ''
});

const importFromExisting = ref(false);
const isSubmitting = ref(false);

// Validation
const isValid = computed(() => {
  return formData.value.name.trim().length > 0;
});

// Reset form when modal opens
watch(() => props.visible, (visible) => {
  if (visible) {
    formData.value = {
      name: '',
      version_number: '',
      description: '',
      catalog_type: 'climate_mitigation',
      uses_structured_ratings: false,
      hidden: false,
      importFromCatalogId: ''
    };
    importFromExisting.value = false;
  }
});

// Handle submit
async function handleSubmit() {
  if (!isValid.value || isSubmitting.value) return;
  
  isSubmitting.value = true;
  
  try {
    const data = { ...formData.value };
    
    if (!importFromExisting.value) {
      delete data.importFromCatalogId;
    }
    
    const result = await createCatalog(data);
    
    if (result) {
      emit('created', result);
    }
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .relative,
.modal-leave-active .relative {
  transition: transform 0.2s ease;
}

.modal-enter-from .relative,
.modal-leave-to .relative {
  transform: scale(0.95);
}
</style>

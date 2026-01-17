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
            Neue Maßnahme erstellen
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
          <!-- Measure ID -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Maßnahmen-ID *
            </label>
            <input
              v-model="formData.measure_id"
              type="text"
              required
              placeholder="z.B. M1.1"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
          </div>

          <!-- Name -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Name *
            </label>
            <input
              v-model="formData.name"
              type="text"
              required
              placeholder="Name der Maßnahme"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
          </div>

          <!-- Sector -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Sektor *
            </label>
            <select
              v-model="formData.sector"
              required
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              <option value="">Sektor auswählen...</option>
              <option v-for="sector in sectors" :key="sector" :value="sector">
                {{ $t(`sectors.${sector}`) }}
              </option>
            </select>
          </div>

          <!-- Description -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Beschreibung
            </label>
            <textarea
              v-model="formData.description"
              rows="3"
              placeholder="Kurze Beschreibung der Maßnahme..."
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            ></textarea>
          </div>

          <!-- Weight & Impact -->
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Gewichtung
              </label>
              <input
                v-model.number="formData.weight"
                type="number"
                min="0"
                step="0.1"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Impact (1-5)
              </label>
              <input
                v-model.number="formData.impact"
                type="number"
                min="1"
                max="5"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>
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
            :disabled="isSubmitting || !isValid"
          >
            {{ isSubmitting ? 'Erstellen...' : 'Maßnahme erstellen' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useNuxtApp } from '#app';

const { $directus, $t } = useNuxtApp();

const props = defineProps({
  catalog: {
    type: Object,
    required: true
  },
  sectors: {
    type: Array,
    default: () => ['management', 'energy', 'transport', 'buildings', 'agriculture', 'industry']
  }
});

const emit = defineEmits(['close', 'created']);

const formData = ref({
  measure_id: '',
  name: '',
  sector: '',
  description: '',
  weight: 1,
  impact: 3
});

const isSubmitting = ref(false);

const isValid = computed(() => {
  return formData.value.measure_id.trim() && 
         formData.value.name.trim() && 
         formData.value.sector;
});

async function handleSubmit() {
  if (!isValid.value || isSubmitting.value) return;
  
  isSubmitting.value = true;
  
  try {
    const { createItem } = await import('@directus/sdk');
    
    const newMeasure = await $directus.request(
      createItem('measures', {
        ...formData.value,
        catalog_version: props.catalog.id,
        status: 'draft',
        slug: formData.value.measure_id.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now()
      })
    );
    
    emit('created', newMeasure);
  } catch (err) {
    console.error('Error creating measure:', err);
    alert('Fehler beim Erstellen: ' + err.message);
  } finally {
    isSubmitting.value = false;
  }
}
</script>

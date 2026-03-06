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
                {{ $t(`measure_sectors.${sector}.title`) }}
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

          <!-- Legacy Catalog Fields (only for catalogs without structured ratings) -->
          <div v-if="!isStructuredCatalog" class="space-y-5 pt-4 border-t">
            <div class="text-sm font-medium text-gray-700 mb-2">
              Legacy Katalog - Zusätzliche Pflichtfelder
            </div>

            <!-- Choices Rating -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Bewertungsoptionen *
              </label>
              <select
                v-model="formData.choices_rating"
                required
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              >
                <option value="">Optionen auswählen...</option>
                <option value="0">Rot / Grün</option>
                <option value="1">Rot / Gelb / Grün</option>
                <option value="2">Rot / Hellgrün / Grün</option>
                <option value="3">Rot / Gelb / Hellgrün / Grün</option>
                <option value="4">Rot / Orange / Gelb / Hellgrün / Grün</option>
                <option value="5">Rot / Orange / Gelb / Grün</option>
                <option value="6">Rot / Orange / Grün</option>
                <option value="7">Rot / Orange / Hellgrün / Grün</option>
              </select>
            </div>

            <!-- Description About -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Was beinhaltet diese Maßnahme? *
              </label>
              <textarea
                v-model="formData.description_about"
                rows="3"
                required
                placeholder="Beschreibung was diese Maßnahme beinhaltet..."
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              ></textarea>
            </div>

            <!-- Description Evaluation Criteria -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Bewertungskriterien *
              </label>
              <textarea
                v-model="formData.description_evaluation_criteria"
                rows="3"
                required
                placeholder="Kriterien für die Bewertung dieser Maßnahme..."
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              ></textarea>
            </div>

            <!-- Description Verification -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Wie wird diese Maßnahme überprüft? *
              </label>
              <textarea
                v-model="formData.description_verification"
                rows="3"
                required
                placeholder="Beschreibung wie man herausfindet, ob diese Maßnahme angenommen wurde..."
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              ></textarea>
            </div>
          </div>

          <!-- Structured Catalog Info -->
          <div v-else class="pt-4 border-t">
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p class="text-sm text-blue-800">
                <strong>Strukturierter Katalog:</strong> Bewertungskriterien und Entscheidungsbäume können nach der Erstellung der Maßnahme hinzugefügt werden.
              </p>
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
            class="px-4 py-2 rounded-lg disabled:opacity-50"
            style="background-color: #16a34a !important; color: white !important; border: none !important;"
            :disabled="isSubmitting || !isValid"
          >
            <span style="color: white !important;">{{ isSubmitting ? 'Erstellen...' : 'Maßnahme erstellen' }}</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useNuxtApp, useRuntimeConfig } from '#app';
import { createDirectus, rest, authentication } from '@directus/sdk';
import { useAuthStore } from '~/stores/auth';

const { $t } = useNuxtApp();
const config = useRuntimeConfig();
const authStore = useAuthStore();

// Create authenticated Directus client
function createAuthenticatedClient() {
  const token = authStore.accessToken?.value;
  if (!token) {
    throw new Error('No authentication token available');
  }
  
  const baseUrl = process.client 
    ? config.public.clientDirectusUrl 
    : config.public.serverDirectusUrl;
  
  const client = createDirectus(baseUrl || 'http://localhost:8055')
    .with(rest())
    .with(authentication('json'));
  
  client.setToken(token);
  return client;
}

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
  impact: 3,
  // Legacy catalog fields (only required if not structured)
  choices_rating: '',
  description_about: '',
  description_evaluation_criteria: '',
  description_verification: ''
});

const isSubmitting = ref(false);

const isStructuredCatalog = computed(() => {
  return props.catalog?.uses_structured_ratings === true;
});

const isValid = computed(() => {
  const basicValid = formData.value.measure_id.trim() && 
                     formData.value.name.trim() && 
                     formData.value.sector;
  
  // For legacy catalogs, also require the legacy fields
  if (!isStructuredCatalog.value) {
    return basicValid && 
           formData.value.choices_rating &&
           formData.value.description_about.trim() &&
           formData.value.description_evaluation_criteria.trim() &&
           formData.value.description_verification.trim();
  }
  
  return basicValid;
});

async function handleSubmit() {
  if (!isValid.value || isSubmitting.value) return;
  
  isSubmitting.value = true;
  
  try {
    const directus = createAuthenticatedClient();
    const { createItem } = await import('@directus/sdk');
    
    // Build the data object
    const measureData = {
      measure_id: formData.value.measure_id,
      name: formData.value.name,
      sector: formData.value.sector,
      description: formData.value.description,
      weight: formData.value.weight,
      impact: formData.value.impact,
      catalog_version: props.catalog.id,
      status: 'draft',
      slug: formData.value.measure_id.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now()
    };
    
    // Only include legacy fields for legacy catalogs
    if (!isStructuredCatalog.value) {
      measureData.choices_rating = formData.value.choices_rating;
      measureData.description_about = formData.value.description_about;
      measureData.description_evaluation_criteria = formData.value.description_evaluation_criteria;
      measureData.description_verification = formData.value.description_verification;
    }
    
    console.log('Creating measure with data:', measureData);
    
    const newMeasure = await directus.request(
      createItem('measures', measureData)
    );
    
    console.log('Measure created successfully:', newMeasure);
    emit('created', newMeasure);
  } catch (err) {
    console.error('Error creating measure:', err);
    console.error('Error details:', {
      message: err.message,
      errors: err.errors,
      response: err.response,
      stack: err.stack
    });
    alert('Fehler beim Erstellen: ' + (err.errors?.[0]?.message || err.message));
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <div class="bg-gray-50 px-6 py-4">
    <!-- Loading State -->
    <div v-if="loading" class="flex justify-center py-8">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="text-center py-8 text-red-600">
      <p>Fehler beim Laden der Maßnahmen: {{ error }}</p>
    </div>

    <!-- Measures List -->
    <div v-else-if="measures.length > 0" class="space-y-3">
      <div class="text-sm text-gray-600 mb-3">
        {{ measures.length }} {{ measures.length === 1 ? 'Maßnahme' : 'Maßnahmen' }} gefunden
      </div>
      
      <div 
        v-for="measure in measures" 
        :key="measure.id"
        class="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow"
      >
        <div class="flex items-start justify-between gap-4">
          <!-- Measure Info -->
          <div class="flex-1">
            <div class="flex items-center gap-3 mb-2">
              <h4 class="font-medium text-gray-900">{{ measure.measure_id }}</h4>
              <span 
                class="px-2 py-0.5 text-xs rounded-full"
                :class="getStatusClass(measure.status)"
              >
                {{ measure.status === 'published' ? 'Veröffentlicht' : 'Entwurf' }}
              </span>
            </div>
            
            <p v-if="measure.title" class="text-sm text-gray-600 mb-2">
              {{ measure.title }}
            </p>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-2">
            <NuxtLink
              :to="`/admin/measures?catalog=${catalogId}&measure=${measure.id}`"
              class="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
              title="Maßnahme bearbeiten"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </NuxtLink>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="text-center py-8 text-gray-500">
      <svg class="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <p>Keine Maßnahmen in diesem Katalog</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { createDirectus, rest, authentication, readItems } from '@directus/sdk';
import { useAuthStore } from '~/stores/auth';

const props = defineProps({
  catalogId: {
    type: String,
    required: true
  }
});

const config = useRuntimeConfig();
const authStore = useAuthStore();

const measures = ref([]);
const loading = ref(false);
const error = ref(null);

/**
 * Create authenticated Directus client
 */
function createAuthenticatedClient() {
  const baseUrl = process.client 
    ? config.public.clientDirectusUrl 
    : config.public.serverDirectusUrl;
  
  const client = createDirectus(baseUrl || 'http://localhost:8055')
    .with(rest())
    .with(authentication('json'));
  
  // Add auth token for authenticated requests
  // Note: accessToken is a readonly ref, so we need to access .value
  const token = authStore.accessToken?.value;
  if (token) {
    client.setToken(token);
  }
  
  return client;
}

function getStatusClass(status) {
  return status === 'published' 
    ? 'bg-green-100 text-green-700'
    : 'bg-gray-100 text-gray-700';
}

async function fetchMeasures() {
  loading.value = true;
  error.value = null;

  try {
    const client = createAuthenticatedClient();
    
    const data = await client.request(
      readItems('measures', {
        filter: {
          catalog_version: {
            _eq: props.catalogId
          }
        },
        fields: [
          'id',
          'measure_id',
          'title',
          'status',
          'sector'
        ],
        sort: ['sector', 'measure_id'],
        limit: -1
      })
    );

    measures.value = data || [];
  } catch (err) {
    console.error('Error loading measures:', err);
    error.value = err.message || 'Unbekannter Fehler';
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  fetchMeasures();
});

watch(() => props.catalogId, () => {
  if (props.catalogId) {
    fetchMeasures();
  }
});
</script>

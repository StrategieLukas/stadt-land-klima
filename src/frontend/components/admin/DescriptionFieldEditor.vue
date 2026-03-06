<template>
  <div class="border-b pb-4 last:border-b-0">
    <div class="flex items-center justify-between mb-2">
      <h4 class="font-medium text-gray-900">{{ title }}</h4>
      <button
        v-if="canEdit && !isEditing"
        @click="startEditing"
        class="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
        Bearbeiten
      </button>
    </div>
    
    <!-- View Mode -->
    <div v-if="!isEditing">
      <div 
        v-if="value"
        class="prose prose-sm max-w-none text-gray-700"
        v-html="value"
      ></div>
      <p v-else class="text-gray-400 text-sm italic">
        Nicht definiert
      </p>
    </div>
    
    <!-- Edit Mode -->
    <div v-else class="space-y-3">
      <RichTextEditor v-model="editValue" />
      <div class="flex justify-end gap-2">
        <button
          @click="cancelEditing"
          class="px-3 py-1.5 text-sm text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
          :disabled="isSaving"
        >
          Abbrechen
        </button>
        <button
          @click="saveField"
          class="px-3 py-1.5 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          :disabled="isSaving"
        >
          {{ isSaving ? 'Speichern...' : 'Speichern' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useRuntimeConfig } from '#app';
import { createDirectus, rest, authentication } from '@directus/sdk';
import { useAuthStore } from '~/stores/auth';
import RichTextEditor from './RichTextEditor.vue';

const config = useRuntimeConfig();
const authStore = useAuthStore();

const props = defineProps({
  title: {
    type: String,
    required: true
  },
  fieldKey: {
    type: String,
    required: true
  },
  value: {
    type: String,
    default: ''
  },
  canEdit: {
    type: Boolean,
    default: false
  },
  measureId: {
    type: String,
    required: true
  }
});

const emit = defineEmits(['saved']);

const isEditing = ref(false);
const isSaving = ref(false);
const editValue = ref('');

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

function startEditing() {
  editValue.value = props.value || '';
  isEditing.value = true;
}

function cancelEditing() {
  isEditing.value = false;
  editValue.value = '';
}

async function saveField() {
  if (isSaving.value) return;
  
  isSaving.value = true;
  
  try {
    const directus = createAuthenticatedClient();
    const { updateItem } = await import('@directus/sdk');
    
    await directus.request(
      updateItem('measures', props.measureId, {
        [props.fieldKey]: editValue.value || null
      })
    );
    
    isEditing.value = false;
    emit('saved');
  } catch (err) {
    console.error(`Error saving ${props.fieldKey}:`, err);
    alert('Fehler beim Speichern: ' + err.message);
  } finally {
    isSaving.value = false;
  }
}

// Update editValue when value prop changes
watch(() => props.value, (newValue) => {
  if (!isEditing.value) {
    editValue.value = newValue || '';
  }
});
</script>

<template>
  <div class="space-y-6">
    <!-- Measure Header -->
    <div class="bg-white rounded-lg shadow-sm border p-6">
      <div class="flex items-start justify-between gap-4 mb-4">
        <div>
          <div class="flex items-center gap-3 mb-2">
            <span class="font-mono text-lg font-bold text-gray-700">
              {{ measure.measure_id }}
            </span>
            <span 
              class="px-2 py-1 text-xs rounded-full"
              :class="measure.status === 'published' 
                ? 'bg-green-100 text-green-700' 
                : 'bg-yellow-100 text-yellow-700'"
            >
              {{ measure.status === 'published' ? 'Veröffentlicht' : 'Entwurf' }}
            </span>
          </div>
          <h2 class="text-xl font-bold text-gray-900">{{ measure.name }}</h2>
        </div>
        
        <div v-if="canEdit && !isEditing" class="flex items-center gap-2">
          <button
            @click="startEditing"
            class="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Bearbeiten
          </button>
        </div>
      </div>

      <!-- View Mode -->
      <div v-if="!isEditing">
        <!-- Meta Info -->
        <div class="flex flex-wrap items-center gap-4 mb-4 pb-4 border-b">
          <div class="flex items-center gap-2">
            <span class="text-sm text-gray-500">Sektor:</span>
            <span class="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm">
              {{ $t(`sectors.${measure.sector}`) }}
            </span>
          </div>
          <div v-if="measure.weight" class="flex items-center gap-2">
            <span class="text-sm text-gray-500">Gewichtung:</span>
            <span class="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm">
              {{ measure.weight }}x
            </span>
          </div>
          <div v-if="measure.impact" class="flex items-center gap-2">
            <span class="text-sm text-gray-500">Impact:</span>
            <span class="text-yellow-500">
              {{ '★'.repeat(measure.impact) }}{{ '☆'.repeat(5 - measure.impact) }}
            </span>
          </div>
        </div>

        <!-- Description -->
        <div v-if="measure.description" class="prose prose-sm max-w-none" v-html="measure.description"></div>
      </div>

      <!-- Edit Mode -->
      <form v-else @submit.prevent="handleSave" class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Maßnahmen-ID</label>
            <input
              v-model="editData.measure_id"
              type="text"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Sektor</label>
            <select
              v-model="editData.sector"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="management">Management</option>
              <option value="energy">Energie</option>
              <option value="transport">Verkehr</option>
              <option value="buildings">Gebäude</option>
              <option value="agriculture">Landwirtschaft</option>
              <option value="industry">Industrie</option>
            </select>
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Name</label>
          <input
            v-model="editData.name"
            type="text"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Beschreibung</label>
          <textarea
            v-model="editData.description"
            rows="4"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          ></textarea>
        </div>

        <div class="grid grid-cols-3 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Gewichtung</label>
            <input
              v-model.number="editData.weight"
              type="number"
              min="0"
              step="0.1"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Impact (1-5)</label>
            <input
              v-model.number="editData.impact"
              type="number"
              min="1"
              max="5"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              v-model="editData.status"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="draft">Entwurf</option>
              <option value="published">Veröffentlicht</option>
            </select>
          </div>
        </div>

        <div class="flex justify-end gap-3 pt-4 border-t">
          <button
            type="button"
            @click="cancelEdit"
            class="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            :disabled="isSaving"
          >
            Abbrechen
          </button>
          <button
            type="submit"
            class="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            :disabled="isSaving"
          >
            {{ isSaving ? 'Speichern...' : 'Speichern' }}
          </button>
        </div>
      </form>
    </div>

    <!-- Additional Details (View Mode Only) -->
    <template v-if="!isEditing">
      <!-- Bewertungskriterien / Criteria Text (Legacy) -->
      <div class="bg-white rounded-lg shadow-sm border p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-bold text-gray-900">Bewertungskriterien</h3>
          <button
            v-if="canEdit && !isEditingCriteria"
            @click="isEditingCriteria = true"
            class="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Bearbeiten
          </button>
        </div>
        
        <div v-if="!isEditingCriteria">
          <div 
            v-if="fullMeasure?.description_evaluation_criteria"
            class="prose prose-sm max-w-none"
            v-html="fullMeasure.description_evaluation_criteria"
          ></div>
          <p v-else class="text-gray-500 text-sm italic">
            Keine Bewertungskriterien definiert.
          </p>
        </div>
        
        <!-- Edit Criteria -->
        <div v-else>
          <textarea
            v-model="criteriaText"
            rows="8"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
            placeholder="Beschreiben Sie hier die Kriterien, nach denen diese Maßnahme bewertet wird..."
          ></textarea>
          <p class="text-xs text-gray-500 mt-1">HTML wird unterstützt.</p>
          <div class="flex justify-end gap-2 mt-3">
            <button
              @click="isEditingCriteria = false; criteriaText = fullMeasure?.description_evaluation_criteria || ''"
              class="px-3 py-1.5 text-sm text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
            >
              Abbrechen
            </button>
            <button
              @click="saveCriteriaText"
              class="px-3 py-1.5 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              Speichern
            </button>
          </div>
        </div>
      </div>

      <!-- Rating Choices (Legacy System) -->
      <div class="bg-white rounded-lg shadow-sm border p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-bold text-gray-900">Bewertungsoptionen (Legacy)</h3>
          <button
            v-if="canEdit && !isEditingChoices"
            @click="startEditingChoices"
            class="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Bearbeiten
          </button>
        </div>
        
        <!-- View Choices -->
        <div v-if="!isEditingChoices">
          <div v-if="fullMeasure?.choices_rating?.length" class="space-y-2">
            <div 
              v-for="(choice, idx) in fullMeasure.choices_rating" 
              :key="idx"
              class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
            >
              <span 
                class="w-8 h-8 flex items-center justify-center rounded-full text-sm font-medium"
                :class="getRatingColorClass(choice.value)"
              >
                {{ choice.value }}
              </span>
              <span class="text-gray-700">{{ choice.text || choice.label }}</span>
            </div>
          </div>
          <div v-else class="text-gray-500 text-sm italic">
            Keine Bewertungsoptionen definiert. Es wird der Standard-Schieberegler verwendet.
          </div>
        </div>
        
        <!-- Edit Choices -->
        <div v-else class="space-y-4">
          <p class="text-sm text-gray-600 mb-4">
            Definieren Sie die verfügbaren Bewertungsoptionen. Der Wert bestimmt die Farbe (0 = rot, 1 = dunkelgrün).
          </p>
          
          <div 
            v-for="(choice, idx) in editChoices" 
            :key="idx"
            class="flex items-center gap-3 p-3 border rounded-lg bg-gray-50"
          >
            <input
              v-model.number="choice.value"
              type="number"
              min="0"
              max="1"
              step="0.25"
              class="w-20 px-2 py-1 border rounded text-center"
              placeholder="Wert"
            />
            <input
              v-model="choice.text"
              type="text"
              class="flex-1 px-3 py-1 border rounded"
              placeholder="Beschreibung (z.B. 'Vollständig umgesetzt')"
            />
            <button
              @click="removeChoice(idx)"
              class="p-1 text-red-600 hover:bg-red-50 rounded"
              title="Entfernen"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
          
          <button
            @click="addChoice"
            class="flex items-center gap-2 text-sm text-green-600 hover:text-green-800"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            Option hinzufügen
          </button>
          
          <!-- Quick Presets -->
          <div class="pt-4 border-t">
            <p class="text-xs text-gray-500 mb-2">Schnellauswahl:</p>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="preset in ratingPresets"
                :key="preset.name"
                @click="applyPreset(preset)"
                class="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
              >
                {{ preset.name }}
              </button>
            </div>
          </div>
          
          <div class="flex justify-end gap-2 pt-4">
            <button
              @click="cancelEditingChoices"
              class="px-3 py-1.5 text-sm text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
            >
              Abbrechen
            </button>
            <button
              @click="saveChoices"
              class="px-3 py-1.5 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              Speichern
            </button>
          </div>
        </div>
      </div>

      <!-- Structured Ratings Section -->
      <div v-if="catalog?.uses_structured_ratings" class="bg-white rounded-lg shadow-sm border p-6">
        <h3 class="font-bold text-gray-900 mb-4">Strukturierte Bewertung</h3>
        <p class="text-gray-500 text-sm">
          Dieser Katalog verwendet strukturierte Bewertungen mit Kriterien und Entscheidungsbäumen.
        </p>
        <!-- TODO: Add criteria management here -->
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue';
import { useNuxtApp } from '#app';

const { $directus, $readItems, $t } = useNuxtApp();

const props = defineProps({
  measure: {
    type: Object,
    required: true
  },
  catalog: {
    type: Object,
    default: null
  },
  canEdit: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['updated']);

// Basic edit state
const isEditing = ref(false);
const isSaving = ref(false);
const editData = ref({});

// Full measure data (with all fields)
const fullMeasure = ref(null);

// Criteria text editing
const isEditingCriteria = ref(false);
const criteriaText = ref('');

// Rating choices editing
const isEditingChoices = ref(false);
const editChoices = ref([]);

// Rating presets for quick setup
const ratingPresets = [
  {
    name: 'Rot-Grün (2 Stufen)',
    choices: [
      { value: 0, text: 'Nicht umgesetzt' },
      { value: 1, text: 'Umgesetzt' }
    ]
  },
  {
    name: 'Rot-Gelb-Grün (3 Stufen)',
    choices: [
      { value: 0, text: 'Nicht umgesetzt' },
      { value: 0.5, text: 'In Planung/Teilweise' },
      { value: 1, text: 'Vollständig umgesetzt' }
    ]
  },
  {
    name: 'Rot-Orange-Gelb-Grün (4 Stufen)',
    choices: [
      { value: 0, text: 'Nicht umgesetzt' },
      { value: 0.25, text: 'In Planung' },
      { value: 0.5, text: 'In Umsetzung' },
      { value: 1, text: 'Vollständig umgesetzt' }
    ]
  },
  {
    name: '5 Stufen (Ampel+)',
    choices: [
      { value: 0, text: 'Nicht umgesetzt' },
      { value: 0.25, text: 'Geplant' },
      { value: 0.5, text: 'Begonnen' },
      { value: 0.75, text: 'Weitgehend umgesetzt' },
      { value: 1, text: 'Vollständig umgesetzt' }
    ]
  }
];

// Load full measure details
async function loadFullMeasure() {
  if (!props.measure?.id) return;
  
  try {
    const result = await $directus.request(
      $readItems('measures', {
        filter: { id: { _eq: props.measure.id } },
        fields: [
          '*',
          'description_evaluation_criteria',
          'description_verification',
          'description_about',
          'choices_rating'
        ],
        limit: 1
      })
    );
    
    fullMeasure.value = result?.[0] || null;
    criteriaText.value = fullMeasure.value?.description_evaluation_criteria || '';
  } catch (err) {
    console.error('Error loading full measure:', err);
  }
}

// Initialize edit data when measure changes
watch(() => props.measure, (measure) => {
  if (measure) {
    editData.value = {
      measure_id: measure.measure_id,
      name: measure.name,
      description: measure.description || '',
      sector: measure.sector,
      weight: measure.weight || 1,
      impact: measure.impact || 3,
      status: measure.status || 'draft'
    };
    loadFullMeasure();
  }
}, { immediate: true });

// Basic measure editing
function startEditing() {
  isEditing.value = true;
}

function cancelEdit() {
  isEditing.value = false;
  editData.value = {
    measure_id: props.measure.measure_id,
    name: props.measure.name,
    description: props.measure.description || '',
    sector: props.measure.sector,
    weight: props.measure.weight || 1,
    impact: props.measure.impact || 3,
    status: props.measure.status || 'draft'
  };
}

async function handleSave() {
  if (isSaving.value) return;
  
  isSaving.value = true;
  
  try {
    const { updateItem } = await import('@directus/sdk');
    
    await $directus.request(
      updateItem('measures', props.measure.id, {
        ...editData.value,
        slug: editData.value.measure_id.toLowerCase().replace(/\s+/g, '-')
      })
    );
    
    isEditing.value = false;
    emit('updated');
  } catch (err) {
    console.error('Error saving measure:', err);
    alert('Fehler beim Speichern: ' + err.message);
  } finally {
    isSaving.value = false;
  }
}

// Criteria text editing
async function saveCriteriaText() {
  try {
    const { updateItem } = await import('@directus/sdk');
    
    await $directus.request(
      updateItem('measures', props.measure.id, {
        description_evaluation_criteria: criteriaText.value
      })
    );
    
    if (fullMeasure.value) {
      fullMeasure.value.description_evaluation_criteria = criteriaText.value;
    }
    
    isEditingCriteria.value = false;
    emit('updated');
  } catch (err) {
    console.error('Error saving criteria:', err);
    alert('Fehler beim Speichern: ' + err.message);
  }
}

// Rating choices editing
function startEditingChoices() {
  editChoices.value = fullMeasure.value?.choices_rating?.length 
    ? JSON.parse(JSON.stringify(fullMeasure.value.choices_rating))
    : [];
  isEditingChoices.value = true;
}

function cancelEditingChoices() {
  isEditingChoices.value = false;
  editChoices.value = [];
}

function addChoice() {
  editChoices.value.push({ value: 0.5, text: '' });
}

function removeChoice(idx) {
  editChoices.value.splice(idx, 1);
}

function applyPreset(preset) {
  editChoices.value = JSON.parse(JSON.stringify(preset.choices));
}

async function saveChoices() {
  try {
    const { updateItem } = await import('@directus/sdk');
    
    // Sort by value and filter out empty entries
    const validChoices = editChoices.value
      .filter(c => c.text && c.text.trim())
      .sort((a, b) => a.value - b.value);
    
    await $directus.request(
      updateItem('measures', props.measure.id, {
        choices_rating: validChoices.length > 0 ? validChoices : null
      })
    );
    
    if (fullMeasure.value) {
      fullMeasure.value.choices_rating = validChoices.length > 0 ? validChoices : null;
    }
    
    isEditingChoices.value = false;
    emit('updated');
  } catch (err) {
    console.error('Error saving choices:', err);
    alert('Fehler beim Speichern: ' + err.message);
  }
}

// Helper to get rating color class based on value
function getRatingColorClass(value) {
  const numValue = parseFloat(value);
  if (numValue >= 0.875) return 'bg-green-500 text-white';
  if (numValue >= 0.625) return 'bg-lime-400 text-gray-900';
  if (numValue >= 0.375) return 'bg-yellow-400 text-gray-900';
  if (numValue >= 0.125) return 'bg-orange-400 text-white';
  return 'bg-red-500 text-white';
}
</script>

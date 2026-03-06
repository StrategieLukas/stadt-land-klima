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
          <button
            @click="handleDeleteClick"
            class="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            title="Maßnahme löschen"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Löschen
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
              {{ $t(`measure_sectors.${measure.sector}.title`) }}
            </span>
          </div>
          <div v-if="measure.weight" class="flex items-center gap-2">
            <span class="text-sm text-gray-500">Gewichtung:</span>
            <span class="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm">
              {{ measure.weight }}x
            </span>
          </div>
        </div>

        <!-- Description (using description_about) -->
        <div class="mb-4">
          <div class="flex items-center justify-between mb-2">
            <h4 class="text-sm font-medium text-gray-700">Kurzbeschreibung</h4>
            <button
              v-if="canEdit && !isEditingDescription"
              @click="startEditingDescription"
              class="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Bearbeiten
            </button>
          </div>
          
          <!-- Description View -->
          <div v-if="!isEditingDescription">
            <div v-if="fullMeasure?.description_about" class="prose prose-sm max-w-none bg-gray-50 p-3 rounded-lg" v-html="fullMeasure.description_about"></div>
            <p v-else class="text-gray-400 text-sm italic">Keine Beschreibung vorhanden</p>
          </div>
          
          <!-- Description Edit -->
          <div v-else class="space-y-2">
            <RichTextEditor v-model="descriptionEdit" />
            <div class="flex justify-end gap-2">
              <button
                @click="cancelEditingDescription"
                class="px-3 py-1.5 text-sm text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
              >
                Abbrechen
              </button>
              <button
                @click="saveDescription"
                class="px-3 py-1.5 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                Speichern
              </button>
            </div>
          </div>
        </div>
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
          <RichTextEditor v-model="editData.description" />
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
      <!-- Feasibility Indicators Section (for ALL catalogs) -->
      <div class="bg-white rounded-lg shadow-sm border p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-bold text-gray-900">Machbarkeit & Impact</h3>
          <button
            v-if="canEdit && !isEditingFeasibility"
            @click="startEditingFeasibility"
            class="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Bearbeiten
          </button>
        </div>
        
        <!-- View Mode with Icons -->
        <div v-if="!isEditingFeasibility" class="flex flex-row justify-around items-end">
          <ClientOnly>
            <FeasibilityBarChart
              key="impact-section"
              icon="/assets/icons/icon_impact.svg"
              :label="$t('measure.impact_label') || 'Impact'"
              :value="Number(fullMeasure?.impact || 0)"
            />
            <FeasibilityBarChart
              key="politics-section"
              icon="/assets/icons/icon_politics.svg"
              :label="$t('measure.feasibility_political_label') || 'Politik'"
              :value="Number(fullMeasure?.feasibility_political || 0)"
            />
            <FeasibilityBarChart
              key="invest-section"
              icon="/assets/icons/icon_invest.svg"
              :label="$t('measure.feasibility_economical_label') || 'Kosten'"
              :value="Number(fullMeasure?.feasibility_economical || 0)"
            />
          </ClientOnly>
        </div>
        
        <!-- Edit Mode -->
        <div v-else class="space-y-4">
          <div class="grid grid-cols-3 gap-6">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Impact (1-5)</label>
              <input
                v-model.number="feasibilityData.impact"
                type="number"
                min="1"
                max="5"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Politische Machbarkeit (1-5)</label>
              <input
                v-model.number="feasibilityData.feasibility_political"
                type="number"
                min="1"
                max="5"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Wirtschaftliche Machbarkeit (1-5)</label>
              <input
                v-model.number="feasibilityData.feasibility_economical"
                type="number"
                min="1"
                max="5"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <p class="text-xs text-gray-500">
            1 = niedrig/schwierig, 5 = hoch/einfach. Diese Werte werden den Bearbeitern als Kontextinformation angezeigt.
          </p>
          <div class="flex justify-end gap-2 pt-2">
            <button
              @click="cancelEditingFeasibility"
              class="px-3 py-1.5 text-sm text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
            >
              Abbrechen
            </button>
            <button
              @click="saveFeasibility"
              class="px-3 py-1.5 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              Speichern
            </button>
          </div>
        </div>
      </div>

      <!-- Bewertungskriterien / Criteria Text (Legacy only) -->
      <div v-if="!catalog?.uses_structured_ratings" class="bg-white rounded-lg shadow-sm border p-6">
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
          <RichTextEditor v-model="criteriaText" />
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

      <!-- Rating Choices (Legacy System) - only show for legacy catalogs -->
      <div v-if="!catalog?.uses_structured_ratings" class="bg-white rounded-lg shadow-sm border p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-bold text-gray-900">Bewertungsoptionen (Legacy)</h3>
          <button
            v-if="canEdit && !isEditingChoicesRating"
            @click="startEditingChoicesRating"
            class="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Bearbeiten
          </button>
        </div>
        
        <!-- View Mode -->
        <div v-if="!isEditingChoicesRating">
          <div v-if="fullMeasure?.choices_rating !== null && fullMeasure?.choices_rating !== undefined && fullMeasure?.choices_rating !== ''">
            <p class="text-sm text-gray-700 mb-3">
              {{ getChoiceOptionText(fullMeasure?.choices_rating) }}
            </p>
            
            <!-- Preview of selected rating colors -->
            <div class="flex gap-2 flex-wrap">
              <span 
                v-for="(color, idx) in getChoiceColors(fullMeasure?.choices_rating)" 
                :key="idx"
                class="w-8 h-8 rounded-full border-2 border-white shadow-sm"
                :style="{ backgroundColor: color.hex }"
                :title="color.label"
              />
            </div>
          </div>
          <p v-else class="text-sm text-gray-500 italic">
            Keine Bewertungsoptionen definiert.
          </p>
        </div>
        
        <!-- Edit Mode -->
        <div v-else class="space-y-4">
          <p class="text-sm text-gray-600">
            Wählen Sie die Farbkombination für die Bewertung dieser Maßnahme.
          </p>
          
          <select
            v-model="editChoicesRating"
            class="w-full px-3 py-2 border rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">-- Bitte wählen --</option>
            <option v-for="option in choicesRatingOptions" :key="option.value" :value="option.value">
              {{ option.text }}
            </option>
          </select>
          
          <!-- Preview of selected rating colors -->
          <div v-if="editChoicesRating" class="mt-4">
            <p class="text-xs text-gray-500 mb-2">Vorschau der Farben:</p>
            <div class="flex gap-2 flex-wrap">
              <span 
                v-for="(color, idx) in getChoiceColors(editChoicesRating)" 
                :key="idx"
                class="w-8 h-8 rounded-full border-2 border-white shadow-sm"
                :style="{ backgroundColor: color.hex }"
                :title="color.label"
              />
            </div>
          </div>
          
          <div class="flex justify-end gap-2 pt-4">
            <button
              @click="cancelEditingChoicesRating"
              class="px-3 py-1.5 text-sm text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
            >
              Abbrechen
            </button>
            <button
              @click="saveChoicesRating"
              class="px-3 py-1.5 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              Speichern
            </button>
          </div>
        </div>
      </div>

      <!-- Structured Ratings Section - Use StructuredMeasureEditor -->
      <div v-if="catalog?.uses_structured_ratings">
        <StructuredMeasureEditor
          :measure-id="measure.id"
          :can-edit="canEdit"
          @updated="loadFullMeasure"
        />
      </div>

      <!-- Description Fields Section - Collapsible (for ALL catalogs) -->
      <div class="bg-white rounded-lg shadow-sm border p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-bold text-gray-900">Beschreibungsfelder</h3>
          <button
            @click="showDescriptionFields = !showDescriptionFields"
            class="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            <svg 
              class="w-4 h-4 transition-transform" 
              :class="{ 'rotate-180': showDescriptionFields }"
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
            {{ showDescriptionFields ? 'Ausblenden' : 'Anzeigen' }}
          </button>
        </div>
        
        <div v-if="showDescriptionFields" class="space-y-6">
          <!-- Description Benefit -->
          <DescriptionFieldEditor
            title="Nutzen"
            field-key="description_benefit"
            :value="fullMeasure?.description_benefit"
            :can-edit="canEdit"
            :measure-id="measure.id"
            @saved="loadFullMeasure"
          />
          
          <!-- Description Implementation -->
          <DescriptionFieldEditor
            title="Umsetzung"
            field-key="description_implementation"
            :value="fullMeasure?.description_implementation"
            :can-edit="canEdit"
            :measure-id="measure.id"
            @saved="loadFullMeasure"
          />
          
          <!-- Description Contribution -->
          <DescriptionFieldEditor
            title="Beitrag"
            field-key="description_contribution"
            :value="fullMeasure?.description_contribution"
            :can-edit="canEdit"
            :measure-id="measure.id"
            @saved="loadFullMeasure"
          />
          
          <!-- Description Legal -->
          <DescriptionFieldEditor
            title="Rechtliches"
            field-key="description_legal"
            :value="fullMeasure?.description_legal"
            :can-edit="canEdit"
            :measure-id="measure.id"
            @saved="loadFullMeasure"
          />
          
          <!-- Description Funding -->
          <DescriptionFieldEditor
            title="Finanzierung"
            field-key="description_funding"
            :value="fullMeasure?.description_funding"
            :can-edit="canEdit"
            :measure-id="measure.id"
            @saved="loadFullMeasure"
          />
          
          <!-- Description Verification (Legacy only) -->
          <DescriptionFieldEditor
            v-if="!catalog?.uses_structured_ratings"
            title="Verifizierung"
            field-key="description_verification"
            :value="fullMeasure?.description_verification"
            :can-edit="canEdit"
            :measure-id="measure.id"
            @saved="loadFullMeasure"
          />
        </div>
      </div>
    </template>

    <!-- Delete Confirmation Dialog -->
    <div v-if="showDeleteDialog" class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div class="bg-white rounded-lg shadow-xl p-6 max-w-md mx-4">
        <h3 class="text-lg font-bold text-gray-900 mb-3">Maßnahme löschen?</h3>
        <p class="text-gray-600 mb-2">
          Möchten Sie die Maßnahme <strong>{{ measure.name }}</strong> wirklich löschen?
        </p>
        <p class="text-sm text-red-600 mb-4">
          Diese Aktion kann nicht rückgängig gemacht werden. Alle zugehörigen Bewertungen bleiben erhalten, haben aber keine zugeordnete Maßnahme mehr.
        </p>
        <div class="flex justify-end gap-3">
          <button
            @click="showDeleteDialog = false"
            class="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            :disabled="isDeleting"
          >
            Abbrechen
          </button>
          <button
            @click="handleDeleteConfirm"
            class="px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
            :disabled="isDeleting"
          >
            {{ isDeleting ? 'Löschen...' : 'Ja, löschen' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useNuxtApp, useRuntimeConfig } from '#app';
import { createDirectus, rest, authentication } from '@directus/sdk';
import { useAuthStore } from '~/stores/auth';
import RichTextEditor from './RichTextEditor.vue';
import DescriptionFieldEditor from './DescriptionFieldEditor.vue';
import StructuredMeasureEditor from './StructuredMeasureEditor.vue';
import FeasibilityBarChart from '~/components/FeasibilityBarChart.client.vue';

const { $directus, $readItems, $t } = useNuxtApp();
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

// Choices rating editing
const isEditingChoicesRating = ref(false);
const editChoicesRating = ref('');

// Delete confirmation
const showDeleteDialog = ref(false);
const isDeleting = ref(false);

// Description fields
const showDescriptionFields = ref(false);

// Description editing (main description in header)
const isEditingDescription = ref(false);
const descriptionEdit = ref('');

// Choices rating dropdown options (matching Directus field definition)
const choicesRatingOptions = [
  { value: '0', text: 'Rot-Grün (2 Stufen)', colors: ['red', 'green'] },
  { value: '1', text: 'Rot-Gelb-Grün (3 Stufen)', colors: ['red', 'yellow', 'green'] },
  { value: '2', text: 'Rot-Hellgrün-Grün (3 Stufen)', colors: ['red', 'light_green', 'green'] },
  { value: '3', text: 'Rot-Gelb-Hellgrün-Grün (4 Stufen)', colors: ['red', 'yellow', 'light_green', 'green'] },
  { value: '4', text: 'Rot-Orange-Gelb-Hellgrün-Grün (5 Stufen)', colors: ['red', 'orange', 'yellow', 'light_green', 'green'] },
  { value: '5', text: 'Rot-Orange-Gelb-Grün (4 Stufen)', colors: ['red', 'orange', 'yellow', 'green'] },
  { value: '6', text: 'Rot-Orange-Grün (3 Stufen)', colors: ['red', 'orange', 'green'] },
  { value: '7', text: 'Rot-Orange-Hellgrün-Grün (4 Stufen)', colors: ['red', 'orange', 'light_green', 'green'] }
];

// Color hex values for preview
const colorHexMap = {
  red: { hex: '#D9000D', label: 'Rot' },
  orange: { hex: '#F27C00', label: 'Orange' },
  yellow: { hex: '#FFD400', label: 'Gelb' },
  light_green: { hex: '#AFCA0B', label: 'Hellgrün' },
  green: { hex: '#1DA64A', label: 'Grün' }
};

// Get color preview for a given choices_rating value
function getChoiceColors(value) {
  const option = choicesRatingOptions.find(opt => opt.value === value);
  if (!option) return [];
  return option.colors.map(c => colorHexMap[c]);
}

// Feasibility editing
const isEditingFeasibility = ref(false);
const feasibilityData = ref({
  impact: 3,
  feasibility_political: 3,
  feasibility_economical: 3
});

// Get text for a choice option value
function getChoiceOptionText(value) {
  const option = choicesRatingOptions.find(opt => opt.value === value);
  return option ? option.text : 'Unbekannt';
}

// Start editing choices rating
function startEditingChoicesRating() {
  editChoicesRating.value = fullMeasure.value?.choices_rating || '';
  isEditingChoicesRating.value = true;
}

// Cancel editing choices rating
function cancelEditingChoicesRating() {
  isEditingChoicesRating.value = false;
  editChoicesRating.value = '';
}

// Save choices_rating dropdown selection
async function saveChoicesRating() {
  try {
    console.log('Saving choices_rating:', editChoicesRating.value);
    console.log('Measure ID:', props.measure.id);
    
    const directus = createAuthenticatedClient();
    const { updateItem } = await import('@directus/sdk');
    
    const result = await directus.request(
      updateItem('measures', props.measure.id, {
        choices_rating: editChoicesRating.value || null
      })
    );
    
    console.log('Save result:', result);
    
    isEditingChoicesRating.value = false;
    
    // Reload full measure data to ensure everything is in sync
    await loadFullMeasure();
    
    emit('updated');
  } catch (err) {
    console.error('Error saving choices_rating:', err);
    console.error('Error details:', err);
    alert('Fehler beim Speichern: ' + err.message);
  }
}

// Load full measure details
async function loadFullMeasure() {
  if (!props.measure?.id) return;
  
  try {
    const directus = createAuthenticatedClient();
    const result = await directus.request(
      $readItems('measures', {
        filter: { id: { _eq: props.measure.id } },
        fields: [
          '*',
          'description_evaluation_criteria',
          'description_verification',
          'description_about',
          'description_benefit',
          'description_implementation',
          'description_contribution',
          'description_legal',
          'description_funding',
          'choices_rating',
          'impact',
          'feasibility_political',
          'feasibility_economical'
        ],
        limit: 1
      })
    );
    
    const measure = result?.[0] || null;
    // choices_rating is a simple string value ("0"-"7"), no parsing needed
    
    fullMeasure.value = measure;
    criteriaText.value = fullMeasure.value?.description_evaluation_criteria || '';
  } catch (err) {
    console.error('Error loading full measure:', err);
  }
}

// Initialize edit data when measure changes
watch(() => props.measure, (measure, oldMeasure) => {
  // Reset all editing states when measure changes
  if (measure?.id !== oldMeasure?.id) {
    isEditing.value = false;
    isEditingCriteria.value = false;
    isEditingChoicesRating.value = false;
    isEditingFeasibility.value = false;
    showDescriptionFields.value = false;
    fullMeasure.value = null;
  }
  
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

// Also watch the entire measure object deeply to catch prop updates after parent refetches
watch(() => props.measure, () => {
  // If fullMeasure exists and the measure has been reloaded, refresh fullMeasure too
  if (fullMeasure.value && props.measure?.id === fullMeasure.value.id) {
    loadFullMeasure();
  }
}, { deep: true });

// Watch for catalog changes to ensure fresh data
watch(() => props.catalog, (catalog, oldCatalog) => {
  if (catalog?.id !== oldCatalog?.id && props.measure?.id) {
    // Reload data when catalog changes
    loadFullMeasure();
  }
});

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
    const directus = createAuthenticatedClient();
    const { updateItem } = await import('@directus/sdk');
    
    await directus.request(
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
    const directus = createAuthenticatedClient();
    const { updateItem } = await import('@directus/sdk');
    
    await directus.request(
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

// Helper to get rating color class based on value
function getRatingColorClass(value) {
  const numValue = parseFloat(value);
  if (numValue >= 0.875) return 'bg-green-500 text-white';
  if (numValue >= 0.625) return 'bg-lime-400 text-gray-900';
  if (numValue >= 0.375) return 'bg-yellow-400 text-gray-900';
  if (numValue >= 0.125) return 'bg-orange-400 text-white';
  return 'bg-red-500 text-white';
}

// Description editing (using description_about field)
function startEditingDescription() {
  descriptionEdit.value = fullMeasure.value?.description_about || '';
  isEditingDescription.value = true;
}

function cancelEditingDescription() {
  isEditingDescription.value = false;
  descriptionEdit.value = '';
}

async function saveDescription() {
  try {
    const directus = createAuthenticatedClient();
    const { updateItem } = await import('@directus/sdk');
    
    await directus.request(
      updateItem('measures', props.measure.id, {
        description_about: descriptionEdit.value
      })
    );
    
    if (fullMeasure.value) {
      fullMeasure.value.description_about = descriptionEdit.value;
    }
    
    isEditingDescription.value = false;
    emit('updated');
  } catch (err) {
    console.error('Error saving description:', err);
    alert('Fehler beim Speichern: ' + err.message);
  }
}

// Feasibility editing
function startEditingFeasibility() {
  feasibilityData.value = {
    impact: fullMeasure.value?.impact || 3,
    feasibility_political: fullMeasure.value?.feasibility_political || 3,
    feasibility_economical: fullMeasure.value?.feasibility_economical || 3
  };
  isEditingFeasibility.value = true;
}

function cancelEditingFeasibility() {
  isEditingFeasibility.value = false;
}

async function saveFeasibility() {
  try {
    const directus = createAuthenticatedClient();
    const { updateItem } = await import('@directus/sdk');
    
    await directus.request(
      updateItem('measures', props.measure.id, {
        impact: feasibilityData.value.impact,
        feasibility_political: feasibilityData.value.feasibility_political,
        feasibility_economical: feasibilityData.value.feasibility_economical
      })
    );
    
    if (fullMeasure.value) {
      fullMeasure.value.impact = feasibilityData.value.impact;
      fullMeasure.value.feasibility_political = feasibilityData.value.feasibility_political;
      fullMeasure.value.feasibility_economical = feasibilityData.value.feasibility_economical;
    }
    
    isEditingFeasibility.value = false;
    emit('updated');
  } catch (err) {
    console.error('Error saving feasibility:', err);
    alert('Fehler beim Speichern: ' + err.message);
  }
}

// Delete measure
function handleDeleteClick() {
  showDeleteDialog.value = true;
}

async function handleDeleteConfirm() {
  if (isDeleting.value) return;
  
  isDeleting.value = true;
  
  try {
    const directus = createAuthenticatedClient();
    const { deleteItem } = await import('@directus/sdk');
    
    await directus.request(
      deleteItem('measures', props.measure.id)
    );
    
    showDeleteDialog.value = false;
    emit('updated'); // This will trigger a refresh in the parent component
  } catch (err) {
    console.error('Error deleting measure:', err);
    alert('Fehler beim Löschen: ' + err.message);
  } finally {
    isDeleting.value = false;
  }
}
</script>

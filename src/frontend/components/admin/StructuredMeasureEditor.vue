<template>
  <div class="structured-measure-editor space-y-6">
    <!-- Criteria Definitions Section -->
    <div class="bg-white rounded-lg shadow-sm border p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-bold text-gray-900">Kriterien-Definitionen</h3>
        <button
          v-if="canEdit"
          @click="showAddCriterionModal = true"
          class="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg"
          style="background-color: #16a34a !important; color: white !important; border: none !important;"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Kriterium hinzufügen
        </button>
      </div>
      
      <p class="text-sm text-gray-600 mb-4">
        Definieren Sie die Kriterien, die für die Bewertung dieser Maßnahme verwendet werden.
        Kriterien können vom Typ "quantitativ" (Zahlen), "kategorisch" (Auswahl) oder "logisch" (Ja/Nein) sein.
      </p>
      
      <!-- Loading state -->
      <div v-if="loadingCriteria" class="flex justify-center py-8">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
      
      <!-- Criteria list -->
      <div v-else-if="criteriaDefinitions.length > 0" class="space-y-3">
        <div
          v-for="criterion in sortedCriteria"
          :key="criterion.id"
          class="flex items-start gap-4 p-4 bg-gray-50 rounded-lg border"
        >
          <div class="flex-1">
            <div class="flex items-center gap-2 mb-1">
              <span class="font-mono text-sm text-gray-500">{{ criterion.key }}</span>
              <span 
                class="px-2 py-0.5 text-xs rounded-full"
                :class="getCriterionTypeClass(criterion.type)"
              >
                {{ getCriterionTypeLabel(criterion.type) }}
              </span>
              <span 
                class="px-2 py-0.5 text-xs rounded-full"
                :class="criterion.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'"
              >
                {{ criterion.status === 'published' ? 'Aktiv' : 'Entwurf' }}
              </span>
            </div>
            <h4 class="font-medium text-gray-900">{{ criterion.display_name }}</h4>
            <p v-if="criterion.description" class="text-sm text-gray-600 mt-1">{{ criterion.description }}</p>
            
            <!-- Type-specific details -->
            <div class="mt-2 text-xs text-gray-500">
              <span v-if="criterion.type === 'quantitative'">
                Bereich: {{ criterion.min_value ?? '-∞' }} - {{ criterion.max_value ?? '∞' }}
                <span v-if="criterion.unit"> ({{ criterion.unit }})</span>
              </span>
              <span v-else-if="criterion.type === 'categorical' && criterion.enum_options">
                Optionen: {{ criterion.enum_options.join(', ') }}
              </span>
              <span v-else-if="criterion.type === 'logical'">
                Ja/Nein
              </span>
            </div>
          </div>
          
          <div v-if="canEdit" class="flex items-center gap-1">
            <button
              @click="editCriterion(criterion)"
              class="p-2 text-blue-600 hover:bg-blue-50 rounded"
              title="Bearbeiten"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              @click="deleteCriterion(criterion)"
              class="p-2 text-red-600 hover:bg-red-50 rounded"
              title="Löschen"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>
      
      <div v-else class="text-center py-8 text-gray-500">
        <p>Keine Kriterien definiert.</p>
        <p class="text-sm mt-1">Fügen Sie Kriterien hinzu, um die Bewertungslogik zu definieren.</p>
      </div>
    </div>
    
    <!-- Decision Tree Section -->
    <div class="bg-white rounded-lg shadow-sm border p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-bold text-gray-900">Entscheidungsbaum</h3>
        <div class="flex items-center gap-2">
          <button
            v-if="canEdit && !activeTree"
            @click="createNewTree"
            class="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg"
            style="background-color: #16a34a !important; color: white !important; border: none !important;"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            Baum erstellen
          </button>
          <button
            v-if="canEdit && activeTree"
            @click="editTree"
            class="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg"
            style="background-color: #2563eb !important; color: white !important; border: none !important;"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Baum bearbeiten
          </button>
        </div>
      </div>
      
      <p class="text-sm text-gray-600 mb-4">
        Der Entscheidungsbaum bestimmt, wie die Kriterienwerte in eine Bewertung umgewandelt werden.
        Jeder Pfad durch den Baum führt zu einer Ampelfarbe (rot/orange/gelb/hellgrün/dunkelgrün).
      </p>
      
      <!-- Loading state -->
      <div v-if="loadingTrees" class="flex justify-center py-8">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
      
      <!-- Tree visualization -->
      <div v-else-if="activeTree">
        <div class="flex items-center gap-2 mb-4">
          <span class="text-sm text-gray-500">Version {{ activeTree.version }}</span>
          <span class="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">
            Aktiv
          </span>
        </div>
        
        <DecisionTreeVisualizer
          :tree="activeTree.tree_structure"
          :criteria-definitions="criteriaDefinitions"
          :editable="false"
        />
      </div>
      
      <!-- Show single draft tree if no active tree -->
      <div v-else-if="trees.length === 1 && !activeTree">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <span class="text-sm text-gray-500">{{ trees[0].name || `Version ${trees[0].version}` }}</span>
            <span class="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
              {{ trees[0].status }}
            </span>
          </div>
          <button
            v-if="canEdit"
            @click="editTree(trees[0])"
            class="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Bearbeiten
          </button>
        </div>
        
        <DecisionTreeVisualizer
          :tree="trees[0].tree_structure"
          :criteria-definitions="criteriaDefinitions"
          :editable="false"
        />
      </div>
      
      <div v-else class="text-center py-8 text-gray-500">
        <p>Kein Entscheidungsbaum vorhanden.</p>
        <p class="text-sm mt-1">Erstellen Sie einen Entscheidungsbaum, um die Bewertungslogik festzulegen.</p>
      </div>
      
      <!-- Tree versions list -->
      <div v-if="trees.length > 1" class="mt-6 pt-4 border-t">
        <h4 class="text-sm font-medium text-gray-700 mb-2">Alle Versionen</h4>
        <div class="space-y-2">
          <div
            v-for="tree in trees"
            :key="tree.id"
            class="flex items-center justify-between p-2 bg-gray-50 rounded"
          >
            <div class="flex items-center gap-2">
              <span class="text-sm">{{ tree.name || `Version ${tree.version}` }}</span>
              <span 
                class="px-2 py-0.5 text-xs rounded-full"
                :class="tree.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'"
              >
                {{ tree.status }}
              </span>
            </div>
            <div class="flex items-center gap-2">
              <button
                v-if="canEdit"
                @click="editTree(tree)"
                class="text-xs text-blue-600 hover:text-blue-800"
              >
                Bearbeiten
              </button>
              <button
                v-if="canEdit && tree.status !== 'active'"
                @click="activateTree(tree)"
                class="text-xs text-green-600 hover:text-green-800"
              >
                Aktivieren
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Add/Edit Criterion Modal -->
    <Teleport to="body">
      <div 
        v-if="showAddCriterionModal || editingCriterion"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      >
        <div class="bg-white rounded-lg shadow-xl p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
          <h3 class="text-lg font-bold text-gray-900 mb-4">
            {{ editingCriterion ? 'Kriterium bearbeiten' : 'Neues Kriterium' }}
          </h3>
          
          <form @submit.prevent="saveCriterion" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Schlüssel (key)</label>
              <input
                v-model="criterionForm.key"
                type="text"
                required
                :disabled="!!editingCriterion"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                placeholder="z.B. has_climate_plan"
              />
              <p class="text-xs text-gray-500 mt-1">Technischer Bezeichner (keine Leerzeichen)</p>
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Anzeigename</label>
              <input
                v-model="criterionForm.display_name"
                type="text"
                required
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="z.B. Klimaschutzplan vorhanden"
              />
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Beschreibung</label>
              <textarea
                v-model="criterionForm.description"
                rows="2"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Erklärung für Bearbeiter..."
              ></textarea>
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Typ</label>
              <select
                v-model="criterionForm.type"
                required
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="logical">Logisch (Ja/Nein)</option>
                <option value="quantitative">Quantitativ (Zahl)</option>
                <option value="categorical">Kategorisch (Auswahl)</option>
              </select>
            </div>
            
            <!-- Quantitative fields -->
            <div v-if="criterionForm.type === 'quantitative'" class="grid grid-cols-3 gap-3">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Min</label>
                <input
                  v-model.number="criterionForm.min_value"
                  type="number"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Max</label>
                <input
                  v-model.number="criterionForm.max_value"
                  type="number"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Einheit</label>
                <input
                  v-model="criterionForm.unit"
                  type="text"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="z.B. %"
                />
              </div>
            </div>
            
            <!-- Categorical fields -->
            <div v-if="criterionForm.type === 'categorical'">
              <label class="block text-sm font-medium text-gray-700 mb-1">Optionen (eine pro Zeile)</label>
              <textarea
                v-model="criterionForm.enum_options_text"
                rows="4"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Option 1&#10;Option 2&#10;Option 3"
              ></textarea>
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Hinweis für Bearbeiter</label>
              <textarea
                v-model="criterionForm.how_to_find"
                rows="2"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Wo findet man diese Information?"
              ></textarea>
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                v-model="criterionForm.status"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="draft">Entwurf</option>
                <option value="published">Aktiv</option>
              </select>
            </div>
            
            <div class="flex justify-end gap-3 pt-4 border-t">
              <button
                type="button"
                @click="closeCriterionModal"
                class="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                class="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                :disabled="savingCriterion"
              >
                {{ savingCriterion ? 'Speichern...' : 'Speichern' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
    
    <!-- Decision Tree Editor Modal -->
    <Teleport to="body">
      <div 
        v-if="showTreeEditor && editingTree"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      >
        <div class="bg-white rounded-lg shadow-xl p-6 w-full max-w-5xl mx-4 max-h-[95vh] overflow-y-auto">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-bold text-gray-900">
              Entscheidungsbaum bearbeiten: {{ editingTree.name }}
            </h3>
            <div class="flex items-center gap-2">
              <button
                @click="showAddCriterionModal = true"
                class="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                title="Neues Kriterium erstellen"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
                Kriterium
              </button>
            </div>
          </div>
          
          <ClientOnly>
            <DecisionTreeEditor
              :tree-structure="editingTree.tree_structure"
              :criteria-definitions="criteriaDefinitions"
              @save="saveTreeStructure"
              @close="closeTreeEditor"
            />
          </ClientOnly>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue';
import { useRuntimeConfig } from '#app';
import { createDirectus, rest, authentication, readItems, createItem, updateItem, deleteItem } from '@directus/sdk';
import { useAuthStore } from '~/stores/auth';
import DecisionTreeVisualizer from '~/components/DecisionTreeVisualizer.vue';
import DecisionTreeEditor from './DecisionTreeEditor.vue';

const config = useRuntimeConfig();
const authStore = useAuthStore();

const props = defineProps({
  measureId: {
    type: [String, Number],
    required: true
  },
  canEdit: {
    type: Boolean,
    default: true  // Default to true since this is an admin component
  }
});

const emit = defineEmits(['updated']);

// Decision tree state (managed locally for better reactivity)
const trees = ref([]);
const loadingTrees = ref(false);
const showTreeEditor = ref(false);
const editingTree = ref(null);

// Computed active tree
const activeTree = computed(() => {
  return trees.value.find(t => t.status === 'active') || null;
});

// Criteria state
const criteriaDefinitions = ref([]);
const loadingCriteria = ref(false);
const showAddCriterionModal = ref(false);
const editingCriterion = ref(null);
const savingCriterion = ref(false);
const criterionForm = ref({
  key: '',
  display_name: '',
  description: '',
  type: 'logical',
  min_value: null,
  max_value: null,
  unit: '',
  enum_options_text: '',
  how_to_find: '',
  status: 'draft',
  sort_order: 0
});

// Computed
const sortedCriteria = computed(() => {
  return [...criteriaDefinitions.value].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
});

// Methods
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

// Load decision trees
async function loadTrees() {
  if (!props.measureId) {
    console.log('No measureId, skipping tree load');
    return;
  }
  
  console.log('Loading trees for measureId:', props.measureId, 'type:', typeof props.measureId);
  loadingTrees.value = true;
  
  try {
    const directus = createAuthenticatedClient();
    
    // First check if the collection exists
    console.log('Attempting to read decision_trees collection...');
    const result = await directus.request(
      readItems('decision_trees', {
        filter: { measure_id: { _eq: props.measureId } },
        fields: ['*'],
        sort: ['-version']
      })
    );
    
    trees.value = result || [];
    console.log('Trees loaded:', trees.value.length);
  } catch (err) {
    console.error('Error loading trees:', err);
    console.error('Error details:', JSON.stringify(err, null, 2));
    trees.value = [];
  } finally {
    loadingTrees.value = false;
  }
}

async function loadCriteriaDefinitions() {
  loadingCriteria.value = true;
  
  console.log('Loading criteria for measureId:', props.measureId, 'type:', typeof props.measureId);
  
  try {
    const directus = createAuthenticatedClient();
    
    console.log('Attempting to read rating_criteria_definitions collection...');
    const result = await directus.request(
      readItems('rating_criteria_definitions', {
        filter: { measure_id: { _eq: props.measureId } },
        fields: ['*'],
        sort: ['sort_order', 'key']
      })
    );
    
    criteriaDefinitions.value = result || [];
    console.log('Criteria loaded:', criteriaDefinitions.value.length);
  } catch (err) {
    console.error('Error loading criteria definitions:', err);
    console.error('Error details:', JSON.stringify(err, null, 2));
  } finally {
    loadingCriteria.value = false;
  }
}

function getCriterionTypeClass(type) {
  switch (type) {
    case 'logical': return 'bg-purple-100 text-purple-700';
    case 'quantitative': return 'bg-blue-100 text-blue-700';
    case 'categorical': return 'bg-orange-100 text-orange-700';
    default: return 'bg-gray-100 text-gray-700';
  }
}

function getCriterionTypeLabel(type) {
  switch (type) {
    case 'logical': return 'Ja/Nein';
    case 'quantitative': return 'Zahl';
    case 'categorical': return 'Auswahl';
    default: return type;
  }
}

function editCriterion(criterion) {
  editingCriterion.value = criterion;
  criterionForm.value = {
    key: criterion.key,
    display_name: criterion.display_name,
    description: criterion.description || '',
    type: criterion.type,
    min_value: criterion.min_value,
    max_value: criterion.max_value,
    unit: criterion.unit || '',
    enum_options_text: criterion.enum_options?.join('\n') || '',
    how_to_find: criterion.how_to_find || '',
    status: criterion.status || 'draft',
    sort_order: criterion.sort_order || 0
  };
}

async function saveCriterion() {
  savingCriterion.value = true;
  
  try {
    const directus = createAuthenticatedClient();
    
    const data = {
      key: criterionForm.value.key,
      display_name: criterionForm.value.display_name,
      description: criterionForm.value.description || null,
      type: criterionForm.value.type,
      min_value: criterionForm.value.type === 'quantitative' ? criterionForm.value.min_value : null,
      max_value: criterionForm.value.type === 'quantitative' ? criterionForm.value.max_value : null,
      unit: criterionForm.value.type === 'quantitative' ? criterionForm.value.unit : null,
      enum_options: criterionForm.value.type === 'categorical' 
        ? criterionForm.value.enum_options_text.split('\n').filter(o => o.trim())
        : null,
      how_to_find: criterionForm.value.how_to_find || null,
      status: criterionForm.value.status,
      sort_order: criterionForm.value.sort_order
    };
    
    console.log('Saving criterion:', data, 'for measure:', props.measureId);
    
    if (editingCriterion.value) {
      await directus.request(
        updateItem('rating_criteria_definitions', editingCriterion.value.id, data)
      );
      console.log('Criterion updated');
    } else {
      const result = await directus.request(
        createItem('rating_criteria_definitions', {
          ...data,
          measure_id: props.measureId
        })
      );
      console.log('Criterion created:', result);
    }
    
    // Close modal first
    closeCriterionModal();
    
    // Reload criteria from server and wait for Vue to update
    await loadCriteriaDefinitions();
    await nextTick();
    
    console.log('Criteria reloaded, count:', criteriaDefinitions.value.length);
    emit('updated');
  } catch (err) {
    console.error('Error saving criterion:', err);
    alert('Fehler beim Speichern: ' + err.message);
  } finally {
    savingCriterion.value = false;
  }
}

async function deleteCriterion(criterion) {
  if (!confirm(`Kriterium "${criterion.display_name}" wirklich löschen?`)) return;
  
  try {
    const directus = createAuthenticatedClient();
    await directus.request(
      deleteItem('rating_criteria_definitions', criterion.id)
    );
    
    await loadCriteriaDefinitions();
    await nextTick();
    emit('updated');
  } catch (err) {
    console.error('Error deleting criterion:', err);
    alert('Fehler beim Löschen: ' + err.message);
  }
}

function closeCriterionModal() {
  showAddCriterionModal.value = false;
  editingCriterion.value = null;
  criterionForm.value = {
    key: '',
    display_name: '',
    description: '',
    type: 'logical',
    min_value: null,
    max_value: null,
    unit: '',
    enum_options_text: '',
    how_to_find: '',
    status: 'draft',
    sort_order: criteriaDefinitions.value.length
  };
}

async function createNewTree() {
  const name = prompt('Name für den neuen Entscheidungsbaum:');
  if (!name) return;
  
  try {
    console.log('Creating new tree with name:', name, 'for measure:', props.measureId);
    
    const directus = createAuthenticatedClient();
    
    // Calculate next version
    const maxVersion = Math.max(0, ...trees.value.map(t => t.version || 0));
    
    const newTree = await directus.request(
      createItem('decision_trees', {
        measure_id: props.measureId,
        name,
        description: '',
        version: maxVersion + 1,
        status: 'draft',
        tree_structure: {
          rootNodeId: 'root',
          nodes: {
            root: {
              id: 'root',
              type: 'decision',
              criterionKey: '',
              question: 'Erstes Entscheidungskriterium',
              branches: [
                { condition: { type: 'equals', value: true }, label: 'Ja', targetNodeId: 'yes_leaf' },
                { condition: { type: 'equals', value: false }, label: 'Nein', targetNodeId: 'no_leaf' }
              ]
            },
            yes_leaf: { id: 'yes_leaf', type: 'leaf', ratingFunction: { type: 'direct_mapping', rating: 'dark_green' } },
            no_leaf: { id: 'no_leaf', type: 'leaf', ratingFunction: { type: 'direct_mapping', rating: 'red' } }
          }
        }
      })
    );
    
    console.log('Tree created:', newTree);
    
    // Reload trees from server to get fresh data
    await loadTrees();
    console.log('Trees reloaded, count:', trees.value.length);
    
    // Use nextTick to ensure Vue updates
    await nextTick();
    
    emit('updated');
  } catch (err) {
    console.error('Error creating tree:', err);
    alert('Fehler beim Erstellen: ' + err.message);
  }
}

function editTree(tree = null) {
  // Open the VueFlow-based tree editor
  editingTree.value = tree || activeTree.value || trees.value[0];
  showTreeEditor.value = true;
}

function closeTreeEditor() {
  showTreeEditor.value = false;
  editingTree.value = null;
}

async function saveTreeStructure(newStructure) {
  if (!editingTree.value) return;
  
  try {
    const directus = createAuthenticatedClient();
    await directus.request(
      updateItem('decision_trees', editingTree.value.id, {
        tree_structure: newStructure
      })
    );
    
    await loadTrees();
    closeTreeEditor();
    emit('updated');
  } catch (err) {
    console.error('Error saving tree structure:', err);
    alert('Fehler beim Speichern: ' + err.message);
  }
}

async function activateTree(tree) {
  try {
    const directus = createAuthenticatedClient();
    
    // Deactivate current active tree
    if (activeTree.value) {
      await directus.request(
        updateItem('decision_trees', activeTree.value.id, { status: 'draft' })
      );
    }
    
    // Activate selected tree
    await directus.request(
      updateItem('decision_trees', tree.id, { status: 'active' })
    );
    
    await loadTrees();
    await nextTick();
    emit('updated');
  } catch (err) {
    console.error('Error activating tree:', err);
    alert('Fehler beim Aktivieren: ' + err.message);
  }
}

// Centralized refresh function
async function refreshAllData() {
  console.log('Refreshing all data for measure:', props.measureId);
  await Promise.all([
    loadCriteriaDefinitions(),
    loadTrees()
  ]);
  await nextTick();
}

// Initialize
onMounted(async () => {
  console.log('StructuredMeasureEditor mounted for measure:', props.measureId);
  await refreshAllData();
});

// Watch for measure changes
watch(() => props.measureId, async (newId, oldId) => {
  if (newId !== oldId) {
    console.log('Measure ID changed from', oldId, 'to', newId);
    await refreshAllData();
  }
}, { immediate: false });
</script>

<style scoped>
.structured-measure-editor {
  max-width: 100%;
}
</style>

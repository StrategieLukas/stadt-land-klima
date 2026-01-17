<template>
  <div class="measure-rating-editor">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-xl font-bold text-gray-900">{{ $t('rating.editor.title') }}</h2>
        <p v-if="measure" class="text-sm text-gray-600">{{ measure.name }}</p>
      </div>
      
      <div class="flex items-center gap-3">
        <!-- Completion indicator -->
        <div class="flex items-center gap-2">
          <div class="text-sm text-gray-600">
            {{ completedCount }}/{{ totalCount }} {{ $t('rating.editor.criteria_completed') }}
          </div>
          <div class="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div 
              class="h-full bg-primary transition-all duration-300"
              :style="{ width: `${completionPercentage}%` }"
            />
          </div>
        </div>
        
        <!-- Save button -->
        <button 
          class="btn btn-primary btn-sm"
          :disabled="saving || !hasChanges"
          @click="handleSave"
        >
          <span v-if="saving" class="loading loading-spinner loading-xs" />
          {{ $t('common.save') }}
        </button>
      </div>
    </div>
    
    <!-- Error display -->
    <div v-if="error" class="alert alert-error mb-4">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 shrink-0 stroke-current" fill="none" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span>{{ error }}</span>
    </div>
    
    <!-- Loading state -->
    <div v-if="loading" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg text-primary" />
    </div>
    
    <!-- Main content -->
    <div v-else class="space-y-6">
      <!-- Rating overview card -->
      <div class="card bg-base-100 shadow">
        <div class="card-body">
          <div class="flex flex-wrap items-center gap-6">
            <!-- Computed Rating -->
            <div class="flex-1 min-w-[200px]">
              <h3 class="text-sm font-medium text-gray-500 mb-2">
                {{ $t('rating.editor.computed_rating') }}
              </h3>
              <RatingBadge :rating="computedRating" size="lg" />
            </div>
            
            <!-- Manual Override -->
            <div class="flex-1 min-w-[200px]">
              <h3 class="text-sm font-medium text-gray-500 mb-2">
                {{ $t('rating.editor.manual_override') }}
              </h3>
              <div class="flex items-center gap-3">
                <input 
                  type="checkbox" 
                  class="toggle toggle-primary"
                  :checked="ratingMeasure?.manual_override"
                  @change="handleOverrideToggle"
                />
                <span class="text-sm">
                  {{ ratingMeasure?.manual_override ? $t('common.active') : $t('common.inactive') }}
                </span>
              </div>
            </div>
            
            <!-- Final Rating -->
            <div class="flex-1 min-w-[200px]">
              <h3 class="text-sm font-medium text-gray-500 mb-2">
                {{ $t('rating.editor.final_rating') }}
              </h3>
              <RatingBadge :rating="effectiveRating" size="lg" showLabel />
            </div>
          </div>
          
          <!-- Manual override section -->
          <div v-if="ratingMeasure?.manual_override" class="mt-4 p-4 bg-warning/10 rounded-lg">
            <div class="flex flex-wrap gap-4">
              <div class="flex-1">
                <label class="label">
                  <span class="label-text">{{ $t('rating.editor.override_rating') }}</span>
                </label>
                <select 
                  class="select select-bordered w-full max-w-xs"
                  :value="ratingMeasure?.rating"
                  @change="handleOverrideRatingChange"
                >
                  <option value="dark_green">{{ $t('rating.levels.dark_green') }}</option>
                  <option value="light_green">{{ $t('rating.levels.light_green') }}</option>
                  <option value="yellow">{{ $t('rating.levels.yellow') }}</option>
                  <option value="orange">{{ $t('rating.levels.orange') }}</option>
                  <option value="red">{{ $t('rating.levels.red') }}</option>
                </select>
              </div>
              <div class="flex-[2]">
                <label class="label">
                  <span class="label-text">{{ $t('rating.editor.override_reason') }}</span>
                </label>
                <textarea 
                  class="textarea textarea-bordered w-full"
                  rows="2"
                  :value="ratingMeasure?.override_reason"
                  :placeholder="$t('rating.editor.override_reason_placeholder')"
                  @input="handleOverrideReasonChange"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Decision path visualization -->
      <div v-if="decisionPath.length > 0" class="card bg-base-100 shadow">
        <div class="card-body">
          <h3 class="card-title text-base">
            {{ $t('rating.editor.decision_path') }}
          </h3>
          <DecisionPathVisualizer :path="decisionPath" />
        </div>
      </div>
      
      <!-- Criteria inputs -->
      <div class="card bg-base-100 shadow">
        <div class="card-body">
          <h3 class="card-title text-base mb-4">
            {{ $t('rating.editor.criteria') }}
          </h3>
          
          <div class="space-y-6">
            <CriterionInput
              v-for="definition in sortedCriteriaDefinitions"
              :key="definition.id"
              :definition="definition"
              :value="getCriterionValue(definition.key)"
              :sources="getCriterionSources(definition.key)"
              @update:value="handleCriterionChange(definition, $event)"
              @add-source="handleAddSource(definition, $event)"
              @remove-source="handleRemoveSource(definition, $event)"
            />
          </div>
        </div>
      </div>
    </div>
    
    <!-- Source manager modal -->
    <SourceManagerModal
      v-model:visible="showSourceModal"
      :criterion-value-id="selectedCriterionValueId"
      @source-added="handleSourceAdded"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useMeasureRating } from '~/composables/useMeasureRating';
import RatingBadge from './RatingBadge.vue';
import CriterionInput from './CriterionInput.vue';
import DecisionPathVisualizer from './DecisionPathVisualizer.vue';
import SourceManagerModal from './SourceManagerModal.vue';

const props = defineProps({
  measureId: {
    type: String,
    required: true
  },
  localteamId: {
    type: String,
    default: null
  }
});

const emit = defineEmits(['saved', 'error']);

// Composable
const {
  measure,
  ratingMeasure,
  criteriaDefinitions,
  criteriaValues,
  decisionTree,
  loading,
  saving,
  error,
  criteriaMap,
  computedRating,
  decisionPath,
  effectiveRating,
  hasChanges,
  isComplete,
  load,
  updateCriterionValue,
  save,
  setManualOverride,
  clearManualOverride
} = useMeasureRating(props.measureId, props.localteamId);

// Local state
const showSourceModal = ref(false);
const selectedCriterionValueId = ref(null);

// Computed
const sortedCriteriaDefinitions = computed(() => {
  return [...criteriaDefinitions.value].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
});

const completedCount = computed(() => {
  return criteriaDefinitions.value.filter(def => {
    const value = criteriaMap.value[def.key];
    return value !== null && value !== undefined;
  }).length;
});

const totalCount = computed(() => {
  return criteriaDefinitions.value.filter(def => def.status === 'published').length;
});

const completionPercentage = computed(() => {
  if (totalCount.value === 0) return 0;
  return Math.round((completedCount.value / totalCount.value) * 100);
});

// Methods
function getCriterionValue(key) {
  const cv = criteriaValues.value.find(v => v.criterion_definition_id?.key === key);
  if (!cv) return null;
  
  const def = criteriaDefinitions.value.find(d => d.key === key);
  if (!def) return null;
  
  switch (def.type) {
    case 'quantitative': return cv.value_quantitative;
    case 'categorical': return cv.value_categorical;
    case 'logical': return cv.value_logical;
    default: return null;
  }
}

function getCriterionSources(key) {
  const cv = criteriaValues.value.find(v => v.criterion_definition_id?.key === key);
  return cv?.sources || [];
}

function handleCriterionChange(definition, value) {
  updateCriterionValue(definition.key, value);
}

async function handleSave() {
  try {
    await save();
    emit('saved', ratingMeasure.value);
  } catch (err) {
    emit('error', err);
  }
}

function handleOverrideToggle(event) {
  if (event.target.checked) {
    // Enable override - keep current computed rating as starting point
    setManualOverride(computedRating.value || 'yellow', '');
  } else {
    clearManualOverride();
  }
}

function handleOverrideRatingChange(event) {
  setManualOverride(event.target.value, ratingMeasure.value?.override_reason || '');
}

function handleOverrideReasonChange(event) {
  if (ratingMeasure.value) {
    ratingMeasure.value.override_reason = event.target.value;
  }
}

function handleAddSource(definition, event) {
  const cv = criteriaValues.value.find(v => v.criterion_definition_id?.key === definition.key);
  if (cv?.id) {
    selectedCriterionValueId.value = cv.id;
    showSourceModal.value = true;
  }
}

function handleRemoveSource(definition, junctionId) {
  const cv = criteriaValues.value.find(v => v.criterion_definition_id?.key === definition.key);
  if (cv) {
    cv.sources = cv.sources.filter(s => s.id !== junctionId);
  }
}

function handleSourceAdded(source) {
  showSourceModal.value = false;
  // Reload to get updated sources
  load();
}

// Lifecycle
onMounted(() => {
  load();
});

// Watch for prop changes
watch(() => [props.measureId, props.localteamId], () => {
  load();
});
</script>

<style scoped>
.measure-rating-editor {
  @apply max-w-4xl mx-auto;
}
</style>

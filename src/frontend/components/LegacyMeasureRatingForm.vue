<template>
  <div class="legacy-measure-rating-form">
    <!-- Measure Info -->
    <div class="mb-6 p-4 bg-gray-50 rounded-lg">
      <h4 class="font-medium text-gray-900 mb-2">{{ rating.measure?.name }}</h4>
      <p v-if="rating.measure?.description" class="text-sm text-gray-600">
        {{ rating.measure.description }}
      </p>
    </div>

    <!-- Description Fields -->
    <div v-if="rating.measure?.description_about" class="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
      <div class="flex items-center gap-2 mb-2">
        <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h5 class="font-semibold text-gray-900">{{ $t('measure.description_about_heading') || 'Über diese Maßnahme' }}</h5>
      </div>
      <div class="prose prose-sm max-w-none text-gray-700" v-html="rating.measure.description_about"></div>
    </div>

    <div v-if="rating.measure?.description_evaluation_criteria" class="mb-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
      <div class="flex items-center gap-2 mb-2">
        <svg class="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
        <h5 class="font-semibold text-gray-900">{{ $t('measure.evaluation_criteria_heading') || 'Bewertungskriterien' }}</h5>
      </div>
      <div class="prose prose-sm max-w-none text-gray-700" v-html="rating.measure.description_evaluation_criteria"></div>
    </div>

    <div v-if="rating.measure?.description_benefit" class="mb-4 p-4 bg-green-50 rounded-lg border border-green-200">
      <div class="flex items-center gap-2 mb-2">
        <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h5 class="font-semibold text-gray-900">Nutzen</h5>
      </div>
      <div class="prose prose-sm max-w-none text-gray-700" v-html="rating.measure.description_benefit"></div>
    </div>

    <div v-if="rating.measure?.description_implementation" class="mb-4 p-4 bg-indigo-50 rounded-lg border border-indigo-200">
      <div class="flex items-center gap-2 mb-2">
        <svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <h5 class="font-semibold text-gray-900">Umsetzung</h5>
      </div>
      <div class="prose prose-sm max-w-none text-gray-700" v-html="rating.measure.description_implementation"></div>
    </div>

    <div v-if="rating.measure?.description_contribution" class="mb-4 p-4 bg-teal-50 rounded-lg border border-teal-200">
      <div class="flex items-center gap-2 mb-2">
        <svg class="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
        <h5 class="font-semibold text-gray-900">Beitrag</h5>
      </div>
      <div class="prose prose-sm max-w-none text-gray-700" v-html="rating.measure.description_contribution"></div>
    </div>

    <div v-if="rating.measure?.description_legal" class="mb-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
      <div class="flex items-center gap-2 mb-2">
        <svg class="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
        </svg>
        <h5 class="font-semibold text-gray-900">Rechtliches</h5>
      </div>
      <div class="prose prose-sm max-w-none text-gray-700" v-html="rating.measure.description_legal"></div>
    </div>

    <div v-if="rating.measure?.description_funding" class="mb-4 p-4 bg-emerald-50 rounded-lg border border-emerald-200">
      <div class="flex items-center gap-2 mb-2">
        <svg class="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h5 class="font-semibold text-gray-900">Finanzierung</h5>
      </div>
      <div class="prose prose-sm max-w-none text-gray-700" v-html="rating.measure.description_funding"></div>
    </div>

    <div v-if="rating.measure?.description_verification" class="mb-4 p-4 bg-pink-50 rounded-lg border border-pink-200">
      <div class="flex items-center gap-2 mb-2">
        <svg class="w-5 h-5 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
        <h5 class="font-semibold text-gray-900">Verifizierung</h5>
      </div>
      <div class="prose prose-sm max-w-none text-gray-700" v-html="rating.measure.description_verification"></div>
    </div>

    <!-- Feasibility Indicators -->
    <div v-if="hasFeasibilityData" class="mb-6 p-4 bg-gray-100 rounded-lg border border-gray-300">
      <h5 class="font-semibold text-gray-900 mb-3">{{ $t('measure.feasibility_heading') || 'Machbarkeit' }}</h5>
      <div class="flex flex-row justify-around gap-4">
        <FeasibilityBarChart
          v-if="rating.measure?.impact"
          key="impact"
          icon="/assets/icons/icon_impact.svg"
          :label="$t('measure.impact_label') || 'Impact'"
          :value="Number(rating.measure.impact)"
        />
        <FeasibilityBarChart
          v-if="rating.measure?.feasibility_political"
          key="politics"
          icon="/assets/icons/icon_politics.svg"
          :label="$t('measure.feasibility_political_label') || 'Politisch'"
          :value="Number(rating.measure.feasibility_political)"
        />
        <FeasibilityBarChart
          v-if="rating.measure?.feasibility_economical"
          key="invest"
          icon="/assets/icons/icon_invest.svg"
          :label="$t('measure.feasibility_economical_label') || 'Kosten'"
          :value="Number(rating.measure.feasibility_economical)"
        />
      </div>
    </div>

    <!-- Applicable Toggle -->
    <div class="mb-6">
      <label class="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          v-model="formData.applicable"
          class="checkbox checkbox-primary"
        />
        <span class="font-medium">{{ $t('rating.legacy.applicable') }}</span>
      </label>
    </div>

    <!-- Not Applicable Reason -->
    <div v-if="!formData.applicable" class="mb-6">
      <label class="block text-sm font-medium text-gray-700 mb-2">
        {{ $t('rating.legacy.why_not_applicable') }}
      </label>
      <textarea
        v-model="formData.why_not_applicable"
        rows="3"
        class="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        :placeholder="$t('rating.legacy.why_not_applicable_placeholder')"
      ></textarea>
    </div>

    <!-- Rating Selection (if applicable) -->
    <div v-if="formData.applicable" class="mb-6">
      <label class="block text-sm font-medium text-gray-700 mb-2">
        {{ $t('rating.legacy.rating_label') }}
      </label>
      
      <!-- If measure has choices, show them -->
      <div v-if="ratingChoices.length > 0" class="space-y-2">
        <label
          v-for="choice in ratingChoices"
          :key="choice.value"
          class="flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors"
          :class="{
            'border-green-500 bg-green-50': formData.rating === choice.value,
            'border-gray-200 hover:border-gray-300': formData.rating !== choice.value
          }"
        >
          <input
            type="radio"
            v-model="formData.rating"
            :value="choice.value"
            class="radio radio-primary"
          />
          <div class="flex-1">
            <span class="font-medium">{{ choice.label }}</span>
            <RatingBadge
              v-if="choice.ratingLevel"
              :rating="choice.ratingLevel"
              size="small"
              class="ml-2"
            />
          </div>
        </label>
      </div>
      
      <!-- Simple rating slider if no choices -->
      <div v-else class="space-y-4">
        <div class="flex items-center gap-4">
          <input
            type="range"
            v-model.number="formData.rating"
            min="0"
            max="1"
            step="0.25"
            class="range range-primary flex-1"
          />
          <RatingBadge
            :rating="getCurrentRatingLevel()"
            size="small"
          />
        </div>
        <div class="flex justify-between text-xs text-gray-500">
          <span>{{ $t('rating.levels.red') }}</span>
          <span>{{ $t('rating.levels.dark_green') }}</span>
        </div>
      </div>
    </div>

    <!-- Source -->
    <div v-if="formData.applicable" class="mb-6">
      <label class="block text-sm font-medium text-gray-700 mb-2">
        {{ $t('rating.legacy.source') }}
      </label>
      <textarea
        v-model="formData.source"
        rows="4"
        class="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        :placeholder="$t('rating.legacy.source_placeholder')"
      ></textarea>
      <p class="text-xs text-gray-500 mt-1">
        {{ $t('rating.legacy.source_hint') }}
      </p>
    </div>

    <!-- Current Progress -->
    <div v-if="formData.applicable" class="mb-6">
      <label class="block text-sm font-medium text-gray-700 mb-2">
        {{ $t('rating.legacy.current_progress') }}
      </label>
      <textarea
        v-model="formData.current_progress"
        rows="3"
        class="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        :placeholder="$t('rating.legacy.current_progress_placeholder')"
      ></textarea>
    </div>

    <!-- Internal Note -->
    <div class="mb-6">
      <label class="block text-sm font-medium text-gray-700 mb-2">
        {{ $t('rating.legacy.internal_note') }}
      </label>
      <textarea
        v-model="formData.internal_note"
        rows="3"
        class="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        :placeholder="$t('rating.legacy.internal_note_placeholder')"
      ></textarea>
      <p class="text-xs text-gray-500 mt-1">
        {{ $t('rating.legacy.internal_note_hint') }}
      </p>
    </div>

    <!-- Actions -->
    <div class="flex justify-end gap-3 pt-4 border-t">
      <button
        @click="$emit('close')"
        class="px-4 py-2 border rounded-lg hover:bg-gray-50"
        :disabled="isSaving"
      >
        {{ $t('common.cancel') }}
      </button>
      <button
        @click="saveRating"
        class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        :disabled="isSaving || !hasChanges"
      >
        {{ isSaving ? $t('common.saving') : $t('common.save') }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useNuxtApp } from '#app';
import RatingBadge from '~/components/RatingBadge.vue';
import FeasibilityBarChart from '~/components/FeasibilityBarChart.client.vue';

const { $directus, $t } = useNuxtApp();

const props = defineProps({
  rating: {
    type: Object,
    required: true
  },
  localteamId: {
    type: String,
    default: null
  }
});

const emit = defineEmits(['saved', 'close']);

// Form data
const formData = ref({
  applicable: true,
  why_not_applicable: '',
  rating: null,
  source: '',
  current_progress: '',
  internal_note: ''
});

const isSaving = ref(false);
const originalData = ref(null);

// Computed
const ratingChoices = computed(() => {
  const choices = props.rating.measure?.choices_rating;
  if (!choices || !Array.isArray(choices)) return [];
  
  return choices.map(choice => ({
    value: choice.value,
    label: choice.text || choice.label,
    ratingLevel: getRatingLevelFromValue(choice.value)
  }));
});

const hasChanges = computed(() => {
  if (!originalData.value) return true;
  return JSON.stringify(formData.value) !== JSON.stringify(originalData.value);
});

const hasFeasibilityData = computed(() => {
  const measure = props.rating.measure;
  return measure?.impact || measure?.feasibility_political || measure?.feasibility_economical;
});

// Methods
function getRatingLevelFromValue(value) {
  if (value === null || value === undefined) return null;
  const numValue = parseFloat(value);
  if (numValue >= 0.875) return 'dark_green';
  if (numValue >= 0.625) return 'light_green';
  if (numValue >= 0.375) return 'yellow';
  if (numValue >= 0.125) return 'orange';
  return 'red';
}

function getCurrentRatingLevel() {
  return getRatingLevelFromValue(formData.value.rating);
}

async function saveRating() {
  isSaving.value = true;
  
  try {
    const { createItem, updateItem } = await import('@directus/sdk');
    
    const payload = {
      applicable: formData.value.applicable,
      rating: formData.value.applicable ? formData.value.rating : null,
      source: formData.value.source || null,
      current_progress: formData.value.current_progress || null,
      internal_note: formData.value.internal_note || null,
      why_not_applicable: !formData.value.applicable ? formData.value.why_not_applicable : null
    };
    
    let result;
    
    // Check if this is a temporary rating (not yet created)
    if (props.rating.id?.startsWith('temp-')) {
      // Create new rating - use localteamId from props or from the rating object
      const localteamId = props.localteamId || props.rating.localteam_id || props.rating.measure?.localteam_id;
      
      if (!localteamId) {
        throw new Error('Missing localteam_id for new rating');
      }
      
      result = await $directus.request(createItem('ratings_measures', {
        ...payload,
        measure_id: props.rating.measure_id,
        localteam_id: localteamId,
        status: 'draft'
      }));
    } else {
      // Update existing rating
      result = await $directus.request(updateItem('ratings_measures', props.rating.id, payload));
    }
    
    emit('saved', { ...props.rating, ...payload, id: result?.id || props.rating.id });
    originalData.value = { ...formData.value };
  } catch (err) {
    console.error('Failed to save rating:', err);
    alert($t('rating.legacy.save_error') || 'Fehler beim Speichern');
  } finally {
    isSaving.value = false;
  }
}

// Initialize form data from props
function initFormData() {
  formData.value = {
    applicable: props.rating.applicable !== false,
    why_not_applicable: props.rating.why_not_applicable || '',
    rating: props.rating.rating,
    source: props.rating.source || '',
    current_progress: props.rating.current_progress || '',
    internal_note: props.rating.internal_note || ''
  };
  originalData.value = { ...formData.value };
}

onMounted(() => {
  initFormData();
});

watch(() => props.rating.id, () => {
  initFormData();
});
</script>

<style scoped>
.legacy-measure-rating-form {
  max-width: 42rem;
}
</style>

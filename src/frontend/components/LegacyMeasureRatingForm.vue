<template>
  <div class="legacy-measure-rating-form">
    <!-- Measure Info -->
    <div class="mb-6 p-4 bg-gray-50 rounded-lg">
      <h4 class="font-medium text-gray-900 mb-2">{{ rating.measure?.name }}</h4>
      <p v-if="rating.measure?.description" class="text-sm text-gray-600">
        {{ rating.measure.description }}
      </p>
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

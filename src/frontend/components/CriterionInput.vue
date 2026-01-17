<template>
  <div class="criterion-input">
    <div class="flex items-start gap-4">
      <!-- Criterion info -->
      <div class="flex-1">
        <div class="flex items-center gap-2 mb-1">
          <h4 class="font-medium text-gray-900">{{ definition.display_name }}</h4>
          <span 
            class="badge badge-sm"
            :class="typeClasses"
          >
            {{ typeLabel }}
          </span>
        </div>
        
        <p v-if="definition.description" class="text-sm text-gray-600 mb-2">
          {{ definition.description }}
        </p>
        
        <!-- How to find hint -->
        <details v-if="definition.how_to_find" class="mb-3">
          <summary class="text-sm text-primary cursor-pointer hover:underline">
            {{ $t('rating.criterion.how_to_find') }}
          </summary>
          <div class="mt-2 p-3 bg-blue-50 rounded-lg text-sm text-gray-700">
            {{ definition.how_to_find }}
          </div>
        </details>
      </div>
      
      <!-- Input field -->
      <div class="w-64">
        <!-- Quantitative input -->
        <template v-if="definition.type === 'quantitative'">
          <div class="flex items-center gap-2">
            <input
              type="number"
              class="input input-bordered input-sm w-full"
              :value="localValue"
              :min="definition.min_value"
              :max="definition.max_value"
              :step="getStep()"
              :placeholder="definition.default_value?.toString() || ''"
              @input="handleInput"
            />
            <span v-if="definition.unit" class="text-sm text-gray-500">
              {{ definition.unit }}
            </span>
          </div>
          <div v-if="definition.min_value !== null || definition.max_value !== null" class="text-xs text-gray-400 mt-1">
            {{ formatRange() }}
          </div>
        </template>
        
        <!-- Categorical input -->
        <template v-else-if="definition.type === 'categorical'">
          <select
            class="select select-bordered select-sm w-full"
            :value="localValue"
            @change="handleSelect"
          >
            <option value="">{{ $t('rating.criterion.select_option') }}</option>
            <option 
              v-for="option in parsedOptions" 
              :key="option.value" 
              :value="option.value"
            >
              {{ option.label }}
            </option>
          </select>
        </template>
        
        <!-- Logical input -->
        <template v-else-if="definition.type === 'logical'">
          <div class="flex items-center gap-4">
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="logical-input"
                class="radio radio-primary radio-sm"
                :checked="localValue === true"
                @change="handleLogical(true)"
              />
              <span class="text-sm">{{ $t('common.yes') }}</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="logical-input"
                class="radio radio-primary radio-sm"
                :checked="localValue === false"
                @change="handleLogical(false)"
              />
              <span class="text-sm">{{ $t('common.no') }}</span>
            </label>
            <button 
              v-if="localValue !== null"
              class="btn btn-ghost btn-xs"
              @click="handleLogical(null)"
            >
              {{ $t('common.clear') }}
            </button>
          </div>
        </template>
      </div>
    </div>
    
    <!-- Sources section -->
    <div class="mt-3 pl-4 border-l-2 border-gray-200">
      <div class="flex items-center justify-between mb-2">
        <span class="text-sm font-medium text-gray-600">
          {{ $t('rating.criterion.sources') }} ({{ sources.length }})
        </span>
        <button 
          class="btn btn-ghost btn-xs gap-1"
          @click="emit('add-source')"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          {{ $t('rating.criterion.add_source') }}
        </button>
      </div>
      
      <!-- Source list -->
      <div v-if="sources.length > 0" class="space-y-2">
        <div 
          v-for="source in sources" 
          :key="source.id"
          class="flex items-start gap-2 p-2 bg-gray-50 rounded text-sm"
        >
          <div class="flex-1">
            <div class="font-medium">{{ source.source_id?.title }}</div>
            <div v-if="source.source_id?.url" class="text-xs text-gray-500 truncate">
              <a :href="source.source_id.url" target="_blank" class="hover:underline">
                {{ source.source_id.url }}
              </a>
            </div>
            <div v-if="source.page_reference" class="text-xs text-gray-500">
              {{ $t('rating.criterion.page') }}: {{ source.page_reference }}
            </div>
          </div>
          <button 
            class="btn btn-ghost btn-xs text-error"
            @click="emit('remove-source', source.id)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
      
      <div v-else class="text-sm text-gray-400 italic">
        {{ $t('rating.criterion.no_sources') }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';

const props = defineProps({
  definition: {
    type: Object,
    required: true
  },
  value: {
    type: [String, Number, Boolean],
    default: null
  },
  sources: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['update:value', 'add-source', 'remove-source']);

// Local state for immediate feedback
const localValue = ref(props.value);

// Sync with prop
watch(() => props.value, (newVal) => {
  localValue.value = newVal;
});

// Computed
const typeLabel = computed(() => {
  switch (props.definition.type) {
    case 'quantitative': return 'Zahl';
    case 'categorical': return 'Auswahl';
    case 'logical': return 'Ja/Nein';
    default: return props.definition.type;
  }
});

const typeClasses = computed(() => {
  switch (props.definition.type) {
    case 'quantitative': return 'badge-info';
    case 'categorical': return 'badge-secondary';
    case 'logical': return 'badge-accent';
    default: return 'badge-ghost';
  }
});

const parsedOptions = computed(() => {
  if (!props.definition.enum_options) return [];
  
  try {
    // Handle both JSON array and object formats
    const options = typeof props.definition.enum_options === 'string' 
      ? JSON.parse(props.definition.enum_options)
      : props.definition.enum_options;
    
    if (Array.isArray(options)) {
      return options.map(opt => {
        if (typeof opt === 'string') {
          return { value: opt, label: opt };
        }
        return { value: opt.value, label: opt.label || opt.value };
      });
    }
    
    // Object format: { value1: "Label 1", value2: "Label 2" }
    return Object.entries(options).map(([value, label]) => ({
      value,
      label: typeof label === 'string' ? label : value
    }));
  } catch {
    return [];
  }
});

// Methods
function getStep() {
  // Determine step based on unit or use 1 as default
  const unit = props.definition.unit?.toLowerCase() || '';
  if (unit.includes('%')) return 1;
  if (unit.includes('€') || unit.includes('euro')) return 0.01;
  if (unit === 'jahr' || unit === 'year') return 1;
  return 1;
}

function formatRange() {
  const min = props.definition.min_value;
  const max = props.definition.max_value;
  const unit = props.definition.unit || '';
  
  if (min !== null && max !== null) {
    return `${min} - ${max} ${unit}`.trim();
  }
  if (min !== null) {
    return `≥ ${min} ${unit}`.trim();
  }
  if (max !== null) {
    return `≤ ${max} ${unit}`.trim();
  }
  return '';
}

function handleInput(event) {
  const value = event.target.value === '' ? null : Number(event.target.value);
  localValue.value = value;
  emit('update:value', value);
}

function handleSelect(event) {
  const value = event.target.value || null;
  localValue.value = value;
  emit('update:value', value);
}

function handleLogical(value) {
  localValue.value = value;
  emit('update:value', value);
}
</script>

<style scoped>
.criterion-input {
  @apply p-4 bg-white border border-gray-200 rounded-lg;
}

.criterion-input:hover {
  @apply border-primary/30;
}
</style>

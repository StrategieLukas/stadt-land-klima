# UI Flows & Component Architecture

This document details the user interface design, component structure, and interaction flows for the StadtLandKlima frontend administration system.

---

## 1. Authentication UI Flow

### 1.1 Login Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     Header (any page)                           │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  [Logo]    [Nav Items...]              [Login Button]   │   │
│  └─────────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────────┘
                             │ Click "Login"
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Login Modal                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  ┌───────────────────────────────────────────────────┐  │   │
│  │  │  Email: [_________________________]               │  │   │
│  │  │  Password: [_________________________]            │  │   │
│  │  │                                                   │  │   │
│  │  │  [Forgot Password?]                               │  │   │
│  │  │                                                   │  │   │
│  │  │  [        Login / Einloggen        ]              │  │   │
│  │  │                                                   │  │   │
│  │  │  Error: Invalid credentials ❌                    │  │   │
│  │  └───────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                             │ Success
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Header (authenticated)                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  [Logo]    [Nav Items...]     [User Avatar ▼] [Directus]│   │
│  │                                    │                     │   │
│  │                              ┌─────▼─────┐               │   │
│  │                              │ Dashboard │               │   │
│  │                              │ My Teams  │               │   │
│  │                              │ ───────── │               │   │
│  │                              │ Logout    │               │   │
│  │                              └───────────┘               │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Component: `AuthLoginModal.vue`

```vue
<template>
  <Teleport to="body">
    <div v-if="isOpen" class="modal-overlay" @click.self="close">
      <div class="modal-content" role="dialog" aria-modal="true" aria-labelledby="login-title">
        <button @click="close" class="modal-close" aria-label="Close">×</button>
        
        <h2 id="login-title" class="text-h2 mb-6">{{ $t('auth.login_title') }}</h2>
        
        <form @submit.prevent="handleLogin" class="space-y-4">
          <div>
            <label for="email" class="block mb-1">{{ $t('auth.email') }}</label>
            <input
              id="email"
              v-model="email"
              type="email"
              required
              autocomplete="email"
              class="w-full p-2 border rounded"
            />
          </div>
          
          <div>
            <label for="password" class="block mb-1">{{ $t('auth.password') }}</label>
            <input
              id="password"
              v-model="password"
              type="password"
              required
              autocomplete="current-password"
              class="w-full p-2 border rounded"
            />
          </div>
          
          <p v-if="error" class="text-red-600 text-sm">{{ error }}</p>
          
          <button
            type="submit"
            :disabled="isLoading"
            class="w-full py-2 bg-primary text-white rounded"
          >
            <span v-if="isLoading">{{ $t('auth.logging_in') }}...</span>
            <span v-else>{{ $t('auth.login') }}</span>
          </button>
        </form>
        
        <p class="mt-4 text-sm text-gray-600">
          <NuxtLink to="/auth/forgot-password" class="underline">
            {{ $t('auth.forgot_password') }}
          </NuxtLink>
        </p>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref } from 'vue';
import { useAuth } from '~/composables/useAuth';

const props = defineProps({
  isOpen: { type: Boolean, default: false }
});

const emit = defineEmits(['close', 'success']);

const { login } = useAuth();

const email = ref('');
const password = ref('');
const error = ref('');
const isLoading = ref(false);

async function handleLogin() {
  error.value = '';
  isLoading.value = true;
  
  try {
    await login(email.value, password.value);
    emit('success');
    emit('close');
  } catch (e) {
    error.value = e.message || 'Login failed';
  } finally {
    isLoading.value = false;
  }
}

function close() {
  emit('close');
}
</script>
```

---

## 2. Contextual Municipality Editing

### 2.1 Municipality Page States

**Public View (not logged in)**
```
┌─────────────────────────────────────────────────────────────────┐
│  ← Back to list                                                  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  [Municipality Name]                    [Overall Score]   │  │
│  │  Population: X | State: Y                                 │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─ Sector: Energy ─────────────────────────────────────────┐  │
│  │                                                           │  │
│  │  ┌── EN_01 Klimaschutzplan ──────────────────────────┐   │  │
│  │  │  [🟢]  Status: Excellent                          │   │  │
│  │  │  Current Progress: Lorem ipsum dolor sit amet...   │   │  │
│  │  │  Source: Link to document                          │   │  │
│  │  │  Last updated: 2025-01-15                          │   │  │
│  │  └───────────────────────────────────────────────────┘   │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

**Edit Mode (logged in with permissions)**
```
┌─────────────────────────────────────────────────────────────────┐
│  ← Back to list                      [Editing: Munich]  [👤▼]   │
│                                                                  │
│  ┌─ EDIT MODE BANNER ───────────────────────────────────────┐  │
│  │  📝 You are editing this municipality                     │  │
│  │  [View Progress Dashboard]  [See Unrated Measures]        │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─ Sector: Energy ─────────────────────────────────────────┐  │
│  │                                                           │  │
│  │  ┌── EN_01 Klimaschutzplan ──────────────────[Edit ✏️]──┐│  │
│  │  │  [🟢]  Status: Excellent                              ││  │
│  │  │                                                        ││  │
│  │  │  ┌─ EDIT PANEL (expanded) ────────────────────────┐  ││  │
│  │  │  │                                                 │  ││  │
│  │  │  │  === Criteria ===                               │  ││  │
│  │  │  │  ☑ Climate action plan exists                   │  ││  │
│  │  │  │  Year: [2023    ] [📎 Add source]               │  ││  │
│  │  │  │  ☑ Contains GHG inventory                       │  ││  │
│  │  │  │  ☑ Has reduction targets                        │  ││  │
│  │  │  │  ☑ Implementation measures defined              │  ││  │
│  │  │  │  ☐ Has monitoring                               │  ││  │
│  │  │  │  ☑ Publicly available                           │  ││  │
│  │  │  │                                                 │  ││  │
│  │  │  │  === Computed Rating ===                        │  ││  │
│  │  │  │  [🟢 Dark Green] (4/5 quality criteria met)     │  ││  │
│  │  │  │                                                 │  ││  │
│  │  │  │  === Progress Notes ===                         │  ││  │
│  │  │  │  [Rich text editor with citation support    ]   │  ││  │
│  │  │  │  [                                          ]   │  ││  │
│  │  │  │                                                 │  ││  │
│  │  │  │  [Save Draft]  [Submit for Review]              │  ││  │
│  │  │  └─────────────────────────────────────────────────┘  ││  │
│  │  └────────────────────────────────────────────────────────┘│  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Component: `MeasureRatingEditor.vue`

```vue
<template>
  <div class="rating-editor" :class="{ 'is-expanded': isExpanded }">
    <!-- Header - always visible -->
    <div class="rating-header flex justify-between items-center p-4 bg-gray-50">
      <div class="flex items-center gap-3">
        <img :src="getRatingIcon(computedRating)" :alt="computedRating" class="w-6 h-6" />
        <span class="font-semibold">{{ measure.name }}</span>
        <span class="text-sm text-gray-500">{{ measure.measure_id }}</span>
      </div>
      
      <button
        v-if="canEdit"
        @click="toggleExpand"
        class="btn-edit flex items-center gap-2"
      >
        <span v-if="!isExpanded">{{ $t('rating.edit') }}</span>
        <span v-else>{{ $t('rating.collapse') }}</span>
        <svg :class="{ 'rotate-180': isExpanded }" class="w-4 h-4 transition-transform">
          <!-- chevron icon -->
        </svg>
      </button>
    </div>
    
    <!-- Expanded Editor Panel -->
    <transition name="slide">
      <div v-if="isExpanded" class="rating-body border-t p-4 space-y-6">
        
        <!-- Applicability Toggle -->
        <div class="applicability-section">
          <label class="flex items-center gap-2">
            <input type="checkbox" v-model="localRating.applicable" />
            <span>{{ $t('rating.is_applicable') }}</span>
          </label>
          
          <div v-if="!localRating.applicable" class="mt-2">
            <label class="block mb-1">{{ $t('rating.why_not_applicable') }}</label>
            <textarea
              v-model="localRating.why_not_applicable"
              class="w-full p-2 border rounded"
              rows="3"
            />
          </div>
        </div>
        
        <!-- Criteria Section (only if applicable) -->
        <div v-if="localRating.applicable" class="criteria-section">
          <h4 class="font-semibold mb-3">{{ $t('rating.criteria') }}</h4>
          
          <div v-for="criterion in criteriaDefinitions" :key="criterion.id" class="criterion-row mb-4">
            <CriterionInput
              :criterion="criterion"
              :value="criteriaValues[criterion.key]"
              @update="updateCriterionValue(criterion.key, $event)"
            />
            
            <!-- Sources for this criterion -->
            <div class="sources-section mt-2 pl-6">
              <SourceList
                :sources="getCriterionSources(criterion.id)"
                @remove="removeSource"
              />
              <button @click="openSourceModal(criterion.id)" class="text-sm text-blue-600">
                + {{ $t('rating.add_source') }}
              </button>
            </div>
          </div>
        </div>
        
        <!-- Computed Rating Display -->
        <div v-if="localRating.applicable" class="computed-rating-section bg-gray-50 p-4 rounded">
          <h4 class="font-semibold mb-2">{{ $t('rating.computed_result') }}</h4>
          
          <div class="flex items-center gap-4">
            <img :src="getRatingIcon(computedRating)" class="w-10 h-10" />
            <div>
              <span class="text-lg font-bold">{{ $t(`rating.levels.${computedRating}`) }}</span>
              <p class="text-sm text-gray-600">{{ ratingExplanation }}</p>
            </div>
          </div>
          
          <!-- Decision Path Visualization -->
          <DecisionPathViewer
            v-if="decisionPath.length > 0"
            :path="decisionPath"
            :tree="decisionTree"
            class="mt-4"
          />
        </div>
        
        <!-- Manual Override (Admin only) -->
        <div v-if="canOverride" class="override-section border-t pt-4">
          <label class="flex items-center gap-2">
            <input type="checkbox" v-model="useOverride" />
            <span>{{ $t('rating.manual_override') }}</span>
          </label>
          
          <div v-if="useOverride" class="mt-3 space-y-2">
            <RatingSelector v-model="localRating.manual_override" />
            <textarea
              v-model="localRating.override_reason"
              :placeholder="$t('rating.override_reason_placeholder')"
              class="w-full p-2 border rounded"
              rows="2"
              required
            />
          </div>
        </div>
        
        <!-- Progress Notes with Rich Text -->
        <div class="notes-section">
          <h4 class="font-semibold mb-2">{{ $t('rating.current_progress') }}</h4>
          <RichTextEditor
            v-model="localRating.current_progress"
            :citations="citations"
            @add-citation="openCitationModal"
          />
        </div>
        
        <!-- Action Buttons -->
        <div class="actions-section flex gap-3 pt-4 border-t">
          <button
            @click="saveDraft"
            :disabled="isSaving"
            class="btn btn-secondary"
          >
            {{ $t('rating.save_draft') }}
          </button>
          
          <button
            v-if="canSubmitForReview"
            @click="submitForReview"
            :disabled="!isValid || isSaving"
            class="btn btn-primary"
          >
            {{ $t('rating.submit_for_review') }}
          </button>
          
          <button
            v-if="canApprove"
            @click="approve"
            :disabled="!isValid || isSaving"
            class="btn btn-success"
          >
            {{ $t('rating.approve') }}
          </button>
          
          <span v-if="lastSaved" class="text-sm text-gray-500 self-center ml-auto">
            {{ $t('rating.last_saved') }}: {{ formatDate(lastSaved) }}
          </span>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useAuthStore } from '~/stores/auth';
import { RatingEngine } from '~/shared/ratingEngine';

const props = defineProps({
  rating: { type: Object, required: true },
  measure: { type: Object, required: true },
  criteriaDefinitions: { type: Array, required: true },
  decisionTree: { type: Object, required: true },
  canEdit: { type: Boolean, default: false }
});

const emit = defineEmits(['save', 'submit', 'approve']);

const authStore = useAuthStore();
const ratingEngine = new RatingEngine();

// Local state
const isExpanded = ref(false);
const isSaving = ref(false);
const lastSaved = ref(null);
const useOverride = ref(false);

// Local copy of rating data
const localRating = ref({ ...props.rating });
const criteriaValues = ref({});
const citations = ref([]);

// Computed permissions
const canOverride = computed(() => authStore.hasRole('Administrator'));
const canApprove = computed(() => authStore.hasRole('LocalTeamAdmin') || authStore.hasRole('Administrator'));
const canSubmitForReview = computed(() => !canApprove.value);

// Computed rating from criteria
const { computedRating, decisionPath, ratingExplanation } = computed(() => {
  if (!localRating.value.applicable) {
    return { computedRating: null, decisionPath: [], ratingExplanation: '' };
  }
  
  try {
    const result = ratingEngine.evaluate(props.decisionTree, criteriaValues.value);
    return {
      computedRating: result.rating,
      decisionPath: result.path,
      ratingExplanation: result.explanation.join(' → ')
    };
  } catch (e) {
    console.error('Rating computation failed:', e);
    return { computedRating: null, decisionPath: [], ratingExplanation: e.message };
  }
});

const isValid = computed(() => {
  if (!localRating.value.applicable) {
    return !!localRating.value.why_not_applicable;
  }
  return computedRating.value !== null;
});

// Methods
function toggleExpand() {
  isExpanded.value = !isExpanded.value;
}

function updateCriterionValue(key, value) {
  criteriaValues.value = {
    ...criteriaValues.value,
    [key]: value
  };
}

async function saveDraft() {
  isSaving.value = true;
  try {
    await emit('save', {
      ...localRating.value,
      computed_rating: computedRating.value,
      decision_path: decisionPath.value,
      criteria_values: criteriaValues.value
    });
    lastSaved.value = new Date();
  } finally {
    isSaving.value = false;
  }
}

async function submitForReview() {
  await saveDraft();
  emit('submit', localRating.value.id);
}

async function approve() {
  await saveDraft();
  emit('approve', localRating.value.id);
}

// Load existing criteria values on mount
onMounted(async () => {
  if (props.rating.id) {
    // Load criteria values from API
    // criteriaValues.value = await loadCriteriaValues(props.rating.id);
  }
});
</script>
```

### 2.3 Component: `CriterionInput.vue`

```vue
<template>
  <div class="criterion-input">
    <div class="flex items-start gap-3">
      <!-- Logical: Checkbox -->
      <template v-if="criterion.type === 'logical'">
        <input
          type="checkbox"
          :id="inputId"
          :checked="modelValue?.value_logical"
          @change="updateLogical($event.target.checked)"
          class="mt-1"
        />
      </template>
      
      <!-- Quantitative: Number input -->
      <template v-else-if="criterion.type === 'quantitative'">
        <input
          type="number"
          :id="inputId"
          :value="modelValue?.value_quantitative"
          :min="criterion.min_value"
          :max="criterion.max_value"
          :step="criterion.precision ? Math.pow(10, -criterion.precision) : 1"
          @input="updateQuantitative($event.target.value)"
          class="w-32 p-1 border rounded"
        />
        <span class="text-sm text-gray-500">{{ criterion.unit }}</span>
      </template>
      
      <!-- Categorical: Select/Radio -->
      <template v-else-if="criterion.type === 'categorical'">
        <select
          :id="inputId"
          :value="modelValue?.value_categorical"
          @change="updateCategorical($event.target.value)"
          class="p-1 border rounded"
        >
          <option value="">{{ $t('common.select') }}...</option>
          <option
            v-for="opt in criterion.enum_options"
            :key="opt.value"
            :value="opt.value"
          >
            {{ opt.label }}
          </option>
        </select>
      </template>
      
      <label :for="inputId" class="flex-1">
        <span class="font-medium">{{ criterion.display_name }}</span>
        <p v-if="criterion.description" class="text-sm text-gray-600">
          {{ criterion.description }}
        </p>
      </label>
      
      <!-- Confidence indicator -->
      <select
        v-model="confidence"
        class="text-xs p-1 border rounded"
        :title="$t('rating.confidence')"
      >
        <option value="verified">✓ {{ $t('rating.confidence.verified') }}</option>
        <option value="estimated">~ {{ $t('rating.confidence.estimated') }}</option>
        <option value="unknown">? {{ $t('rating.confidence.unknown') }}</option>
      </select>
    </div>
    
    <!-- How to find hint -->
    <details v-if="criterion.how_to_find" class="mt-1 ml-6">
      <summary class="text-xs text-blue-600 cursor-pointer">
        {{ $t('rating.how_to_find') }}
      </summary>
      <p class="text-xs text-gray-600 mt-1 pl-2 border-l-2 border-gray-200">
        {{ criterion.how_to_find }}
      </p>
    </details>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';

const props = defineProps({
  criterion: { type: Object, required: true },
  modelValue: { type: Object, default: null }
});

const emit = defineEmits(['update:modelValue']);

const inputId = computed(() => `criterion-${props.criterion.key}`);
const confidence = ref(props.modelValue?.confidence || 'unknown');

function createValue(type, value) {
  return {
    criterion_definition_id: props.criterion.id,
    value_quantitative: type === 'quantitative' ? value : null,
    value_categorical: type === 'categorical' ? value : null,
    value_logical: type === 'logical' ? value : null,
    confidence: confidence.value
  };
}

function updateLogical(checked) {
  emit('update:modelValue', createValue('logical', checked));
}

function updateQuantitative(value) {
  const num = value === '' ? null : parseFloat(value);
  emit('update:modelValue', createValue('quantitative', num));
}

function updateCategorical(value) {
  emit('update:modelValue', createValue('categorical', value || null));
}

watch(confidence, () => {
  if (props.modelValue) {
    emit('update:modelValue', { ...props.modelValue, confidence: confidence.value });
  }
});
</script>
```

---

## 3. Admin Dashboard Views

### 3.1 Progress Dashboard

Route: `/admin/municipalities/[slug]/progress`

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Back to Municipality                                          │
│                                                                  │
│  Progress Dashboard: Munich                                      │
│  ═══════════════════════════════════════════════════════════    │
│                                                                  │
│  Overall Progress                                                │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  ████████████████████████░░░░░░░░░░░░░░░  67% rated       │  │
│  │  38 of 57 measures                                        │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  By Sector                                                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Energy        ████████████████████████░░  85% (11/13)    │  │
│  │  Transport     ████████████████░░░░░░░░░░  60% (6/10)     │  │
│  │  Buildings     ████████████░░░░░░░░░░░░░░  50% (4/8)      │  │
│  │  Agriculture   ████████████████████████░░  80% (8/10)     │  │
│  │  Industry      ████████░░░░░░░░░░░░░░░░░░  35% (3/9)      │  │
│  │  Management    ██████████████████████████  100% (6/6)     │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Pending Actions                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  ⚠ 3 ratings need review                                  │  │
│  │  📝 19 measures unrated                                   │  │
│  │  📎 5 sources expiring soon                               │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Recent Activity                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Today                                                    │  │
│  │  • Maria K. rated EN_05 (Wind Power) → 🟢                 │  │
│  │  • Thomas S. updated sources for TR_03                    │  │
│  │                                                           │  │
│  │  Yesterday                                                │  │
│  │  • Maria K. rated EN_04 (Solar) → 🟡                      │  │
│  │  • Admin approved 4 ratings                               │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Unrated Measures View

Route: `/admin/municipalities/[slug]/ratings`

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Back to Municipality                                          │
│                                                                  │
│  Unrated Measures: Munich                                        │
│  ═══════════════════════════════════════════════════════════    │
│                                                                  │
│  Filter: [All Sectors ▼]  [Status: Unrated ▼]  🔍 Search...     │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  ⚪ IN_01 - Industrielle Abwärmenutzung                   │  │
│  │     Sector: Industry | Impact: High                       │  │
│  │     [Go to Rating →]                                      │  │
│  ├───────────────────────────────────────────────────────────┤  │
│  │  ⚪ IN_02 - Klimaneutrale Gewerbegebiete                  │  │
│  │     Sector: Industry | Impact: Medium                     │  │
│  │     [Go to Rating →]                                      │  │
│  ├───────────────────────────────────────────────────────────┤  │
│  │  ⚪ TR_07 - Ladeinfrastruktur                             │  │
│  │     Sector: Transport | Impact: High                      │  │
│  │     [Go to Rating →]                                      │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Partially Rated (needs review)                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  🟡 EN_03 - Kommunale Solarenergie            [Review]   │  │
│  │     Missing: 2 criteria, 1 source                         │  │
│  ├───────────────────────────────────────────────────────────┤  │
│  │  🟠 BU_05 - Energetische Sanierung            [Review]   │  │
│  │     Needs approval                                        │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Measure Editor UI

### 4.1 Measures Overview

Route: `/measures/sectors/[sector]`

```
┌─────────────────────────────────────────────────────────────────┐
│  Measures: Energy Sector                                         │
│  ═══════════════════════════════════════════════════════════    │
│                                                                  │
│  Catalog Version: [2025.1 (Active) ▼]     [+ New Draft Version] │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  EN_01 - Kommunaler Klimaschutzplan                       │  │
│  │  Status: Published | Weight: 3 | Impact: High             │  │
│  │                                                 [Edit ✏️]  │  │
│  ├───────────────────────────────────────────────────────────┤  │
│  │  EN_02 - Klimaneutralitätsziel                            │  │
│  │  Status: Published | Weight: 2 | Impact: High             │  │
│  │                                                 [Edit ✏️]  │  │
│  ├───────────────────────────────────────────────────────────┤  │
│  │  EN_03 - Kommunale Solarenergie                           │  │
│  │  Status: Draft | Weight: 2 | Impact: Medium               │  │
│  │  ⚠️ In draft catalog 2026.1                    [Edit ✏️]  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Measure Editor

Route: `/admin/measures/[measureId]/edit`

```
┌─────────────────────────────────────────────────────────────────┐
│  Edit Measure: EN_01 - Klimaschutzplan                           │
│  Catalog: 2026.1 (Draft)                                         │
│  ═══════════════════════════════════════════════════════════    │
│                                                                  │
│  [General] [Criteria] [Decision Tree] [Preview]                  │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  === Criteria Definitions ===                                    │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  1. has_climate_action_plan                    [✏️] [🗑️] │  │
│  │     Type: Logical                                         │  │
│  │     "Klimaschutzkonzept vorhanden"                        │  │
│  ├───────────────────────────────────────────────────────────┤  │
│  │  2. plan_year                                  [✏️] [🗑️] │  │
│  │     Type: Quantitative (year)                             │  │
│  │     Depends on: has_climate_action_plan                   │  │
│  ├───────────────────────────────────────────────────────────┤  │
│  │  3. has_ghg_inventory                          [✏️] [🗑️] │  │
│  │     Type: Logical                                         │  │
│  │     Depends on: has_climate_action_plan                   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  [+ Add Criterion]                                               │
│                                                                  │
│  === Decision Tree ===                                           │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                                                           │  │
│  │      ┌─────────────────────┐                              │  │
│  │      │ has_climate_action_ │                              │  │
│  │      │       plan?         │                              │  │
│  │      └──────────┬──────────┘                              │  │
│  │           Yes   │   No                                    │  │
│  │         ┌───────┴───────┐                                 │  │
│  │         ▼               ▼                                 │  │
│  │  ┌──────────┐    ┌──────────┐                             │  │
│  │  │check_age │    │  🔴 Red  │                             │  │
│  │  └────┬─────┘    └──────────┘                             │  │
│  │       │                                                   │  │
│  │      ...                                                  │  │
│  │                                                           │  │
│  │  [Open Visual Editor]                                     │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  [Save Draft]  [Preview Changes]                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.3 Decision Tree Visual Editor

```
┌─────────────────────────────────────────────────────────────────┐
│  Decision Tree Editor: EN_01                                     │
│  ═══════════════════════════════════════════════════════════    │
│                                                                  │
│  Tools: [+ Decision Node] [+ Leaf Node] [🔗 Connect] [🗑️ Delete]│
│                                                                  │
│  ┌─ Canvas ─────────────────────────────────────────────────┐   │
│  │                                                           │   │
│  │         ┌─────────────────────────┐                       │   │
│  │         │  ◆ has_climate_action_  │ ← Selected            │   │
│  │         │       plan?             │                       │   │
│  │         │  [Edit Node]            │                       │   │
│  │         └───────────┬─────────────┘                       │   │
│  │              ┌──────┴──────┐                              │   │
│  │              ▼             ▼                              │   │
│  │         ┌────────┐   ┌────────┐                           │   │
│  │         │  Yes   │   │   No   │                           │   │
│  │         └────┬───┘   └────┬───┘                           │   │
│  │              ▼            ▼                               │   │
│  │    ┌─────────────┐  ┌──────────┐                          │   │
│  │    │ ◆ plan_year │  │ ■ Rating │                          │   │
│  │    │    check    │  │   Red    │                          │   │
│  │    └──────┬──────┘  └──────────┘                          │   │
│  │           │                                               │   │
│  │    ┌──────┼──────┐                                        │   │
│  │    ▼      ▼      ▼                                        │   │
│  │  <2015  2015   >2019                                      │   │
│  │    │    -2019    │                                        │   │
│  │    ▼      ▼      ▼                                        │   │
│  │  ┌───┐ ┌────┐ ┌────┐                                      │   │
│  │  │🟠 │ │QF_1│ │QF_2│                                      │   │
│  │  └───┘ └────┘ └────┘                                      │   │
│  │                                                           │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                  │
│  === Node Properties (selected) ===                              │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Type: Decision Node                                      │  │
│  │  Criterion: [has_climate_action_plan ▼]                   │  │
│  │  Question: "Existiert ein Klimaschutzkonzept?"            │  │
│  │                                                           │  │
│  │  Branches:                                                │  │
│  │  • true → check_age                                       │  │
│  │  • false → no_plan (Red)                                  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  [Validate Tree]  [Save]  [Export JSON]                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Catalog Version Management

### 5.1 Versions Overview (Administrator)

Route: `/admin/catalog/versions`

```
┌─────────────────────────────────────────────────────────────────┐
│  Catalog Version Management                                      │
│  ═══════════════════════════════════════════════════════════    │
│                                                                  │
│  [+ Create New Draft]                                            │
│                                                                  │
│  Active Version                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  ★ 2025.1                                                 │  │
│  │    Activated: 2025-01-15 by Admin                         │  │
│  │    57 measures | 234 municipalities rated                 │  │
│  │                                          [Archive]        │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Draft Versions                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  📝 2026.1                                                │  │
│  │    Created: 2025-12-01 by MeasureEditor                   │  │
│  │    Based on: 2025.1                                       │  │
│  │    Changes: 3 new measures, 5 modified criteria           │  │
│  │                                                           │  │
│  │    [Edit] [Preview] [Activate] [Delete]                   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Archived Versions                                               │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  📦 2024.2    Archived: 2025-01-15    [View (read-only)]  │  │
│  │  📦 2024.1    Archived: 2024-07-01    [View (read-only)]  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Activation Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│  Activate Catalog Version: 2026.1                                │
│  ═══════════════════════════════════════════════════════════    │
│                                                                  │
│  ⚠️ This action will:                                           │
│  • Set 2026.1 as the active catalog                             │
│  • Archive the current version (2025.1)                         │
│  • Trigger migration for all municipalities                     │
│                                                                  │
│  === Pre-flight Check ===                                        │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  ✓ All measures have valid decision trees                 │  │
│  │  ✓ All criteria have proper types defined                 │  │
│  │  ⚠ 5 measures have modified criteria                      │  │
│  │  ⚠ 127 municipalities may need re-rating                  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  === Migration Preview ===                                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Auto-migrate:        187 ratings (unchanged criteria)    │  │
│  │  Needs review:        43 ratings (criteria changed)       │  │
│  │  New measures:        3 (require fresh rating)            │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  [Cancel]  [Activate & Start Migration]                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. Rich Text Editor with Citations

### 6.1 Component: `RichTextEditor.vue`

```vue
<template>
  <div class="rich-text-editor">
    <!-- Toolbar -->
    <div class="toolbar flex gap-2 p-2 border-b">
      <button @click="formatBold" title="Bold"><b>B</b></button>
      <button @click="formatItalic" title="Italic"><i>I</i></button>
      <button @click="formatLink" title="Link">🔗</button>
      <span class="divider">|</span>
      <button @click="insertCitation" title="Insert Citation" class="citation-btn">
        📎 {{ $t('editor.add_citation') }}
      </button>
    </div>
    
    <!-- Editor Area -->
    <div
      ref="editorRef"
      contenteditable="true"
      class="editor-content p-3 min-h-[150px] focus:outline-none"
      @input="handleInput"
      @mouseup="checkSelection"
      v-html="formattedContent"
    />
    
    <!-- Citation Popover -->
    <div
      v-if="showCitationPopover"
      class="citation-popover absolute bg-white shadow-lg rounded p-3"
      :style="popoverPosition"
    >
      <p class="text-sm mb-2">{{ $t('editor.cite_selection') }}</p>
      
      <div class="space-y-2">
        <button
          v-for="source in recentSources"
          :key="source.id"
          @click="applyCitation(source)"
          class="block w-full text-left p-2 hover:bg-gray-100 rounded"
        >
          {{ source.title }}
        </button>
      </div>
      
      <button @click="openSourceModal" class="mt-2 text-blue-600 text-sm">
        + {{ $t('editor.new_source') }}
      </button>
    </div>
    
    <!-- Citations Legend -->
    <div v-if="citations.length > 0" class="citations-legend mt-3 p-3 bg-gray-50 rounded">
      <h4 class="text-sm font-semibold mb-2">{{ $t('editor.sources') }}</h4>
      <ol class="text-sm space-y-1">
        <li v-for="(citation, index) in citations" :key="citation.id">
          <sup>[{{ index + 1 }}]</sup>
          <a v-if="citation.url" :href="citation.url" target="_blank" class="text-blue-600">
            {{ citation.title }}
          </a>
          <span v-else>{{ citation.title }}</span>
          <span v-if="citation.author"> - {{ citation.author }}</span>
          <span v-if="citation.publication_date"> ({{ formatDate(citation.publication_date) }})</span>
        </li>
      </ol>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import DOMPurify from 'dompurify';

const props = defineProps({
  modelValue: { type: String, default: '' },
  citations: { type: Array, default: () => [] }
});

const emit = defineEmits(['update:modelValue', 'add-citation']);

const editorRef = ref(null);
const showCitationPopover = ref(false);
const popoverPosition = ref({ top: '0px', left: '0px' });
const selectedRange = ref(null);
const recentSources = ref([]);

const formattedContent = computed(() => {
  // Process content to render citation markers
  let content = props.modelValue;
  
  // Replace citation markers with superscript numbers
  props.citations.forEach((citation, index) => {
    const marker = `[cite:${citation.id}]`;
    content = content.replace(
      new RegExp(marker, 'g'),
      `<sup class="citation-ref" data-citation-id="${citation.id}">[${index + 1}]</sup>`
    );
  });
  
  return DOMPurify.sanitize(content);
});

function handleInput(event) {
  const html = event.target.innerHTML;
  const plainText = convertToStorageFormat(html);
  emit('update:modelValue', plainText);
}

function checkSelection() {
  const selection = window.getSelection();
  if (selection.toString().length > 0) {
    selectedRange.value = selection.getRangeAt(0);
    positionCitationPopover(selection);
  } else {
    showCitationPopover.value = false;
  }
}

function insertCitation() {
  if (!selectedRange.value) return;
  showCitationPopover.value = true;
}

function applyCitation(source) {
  if (!selectedRange.value) return;
  
  // Insert citation marker at end of selection
  const marker = `[cite:${source.id}]`;
  selectedRange.value.collapse(false);
  selectedRange.value.insertNode(document.createTextNode(marker));
  
  showCitationPopover.value = false;
  
  // Emit to parent to track citation
  emit('add-citation', source);
  
  handleInput({ target: editorRef.value });
}

function convertToStorageFormat(html) {
  // Convert rendered citations back to markers
  // Strip unnecessary HTML, keep basic formatting
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'a', 'br', 'sup'],
    ALLOWED_ATTR: ['href', 'data-citation-id']
  });
}

function positionCitationPopover(selection) {
  const rect = selection.getRangeAt(0).getBoundingClientRect();
  popoverPosition.value = {
    top: `${rect.bottom + window.scrollY + 5}px`,
    left: `${rect.left + window.scrollX}px`
  };
}

onMounted(async () => {
  // Load recent sources for quick selection
  // recentSources.value = await fetchRecentSources();
});
</script>
```

---

## 7. Responsive Design Considerations

### Mobile Breakpoints

```css
/* Tailwind breakpoints used */
sm: 640px   /* Small tablets */
md: 768px   /* Tablets */
lg: 1024px  /* Small desktops */
xl: 1280px  /* Large desktops */
```

### Mobile Adaptations

1. **Rating Editor**: Full-width panels, stacked layout
2. **Decision Tree Editor**: Horizontal scroll, simplified view
3. **Progress Dashboard**: Single column, collapsible sections
4. **Catalog Management**: Hidden on mobile, desktop-only

### Component: Mobile Detection

```typescript
// ~/composables/useDevice.ts
export function useDevice() {
  const isMobile = computed(() => {
    if (process.server) return false;
    return window.innerWidth < 768;
  });
  
  const isDesktop = computed(() => !isMobile.value);
  
  return { isMobile, isDesktop };
}
```

---

*Document version: 1.0*

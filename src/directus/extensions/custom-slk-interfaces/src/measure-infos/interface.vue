<template>
  <div class="measure-preview">
    <p class="id-info">ID: {{ measureData.measure_id }}</p>

    <!-- Link to Frontend -->
    <div v-if="measureData.slug && measureData.sector" class="measure-link">
      <a
        :href="`https://stadt-land-klima.de/measures/sectors/${measureData.sector}#${measureData.measure_id}`"
        target="_blank"
        rel="noopener noreferrer"
      >
        {{ $t('directus.fields.view_measure_on_frontend') }}
      </a>
    </div>

    <div v-if="!resolvedMeasureId" class="v-notice info">
      <v-icon name="info" />
      <div class="content">
        <div class="title">{{ $t('directus.interfaces.no_measure_found_error') }}</div>
      </div>
    </div>

    <div v-else-if="loading" class="loading-container">
      <v-progress-circular indeterminate />
      <span class="loading-text">{{ $t('generic.loading') }}</span>
    </div>

    <div v-else-if="error" class="v-notice danger">
      <v-icon name="error" />
      <div class="content">
        <div class="title">{{ $t('error') }}</div>
        <div class="text">{{ error }}</div>
      </div>
    </div>

    <div v-else-if="hasMeasureData" class="measure-content">
      <div v-for="fieldKey in fieldsToDisplay" :key="fieldKey" class="field-preview">
        <div class="field-header">
          <v-icon name="info" small />
          <span class="field-label">{{ getFieldLabel(fieldKey) }}</span>
        </div>
        <!--
          v-html is intentional here to render rich-text (HTML) from Directus.
          Ensure measure content is authored in a trusted CMS context only.
          If untrusted users can author measures, pipe through DOMPurify first.
        -->
        <div v-if="measureData[fieldKey]" class="field-content" v-html="measureData[fieldKey]" />
        <div v-else class="field-content empty">{{ $t('no_content_available') }}</div>
      </div>
    </div>

    <div v-else class="v-notice warning">
      <v-icon name="warning" />
      <div class="content">
        <div class="title">{{ $t('no_measure_data_available') }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, inject, getCurrentInstance, type Ref } from 'vue';

type Api = {
  get: (
    path: string,
    config?: { params?: Record<string, string> },
  ) => Promise<{ data?: { data?: unknown } }>;
};

const props = defineProps<{
  value?: string | number | null;
  field: string;
  collection: string;
  primaryKey?: string | number | null;
  measure_field?: string;
  fields_to_display?: string[];
  options?: {
    measure_field?: string;
    fields_to_display?: string[];
  } | null;
}>();

const api = inject<Api>('api');

// ─── Derived config ───────────────────────────────────────────────────────────

/** The field on the parent item that holds the measure ID */
const measureField = computed(() =>
  props.options?.measure_field ?? props.measure_field ?? 'measure_id'
);

/** Fields from the measure record to render in the preview */
const fieldsToDisplay = computed(() =>
    props.options?.fields_to_display ??
    props.fields_to_display ?? [
      'description_about',
      'description_evaluation_criteria',
      'description_verification',
    ]
);

// ─── State ────────────────────────────────────────────────────────────────────

const resolvedMeasureId: Ref<string | number | null> = ref(null);
const measureData: Ref<Record<string, unknown>> = ref({});
const loading: Ref<boolean> = ref(false);
const error: Ref<string | null> = ref(null);

const hasMeasureData = computed(() => Object.keys(measureData.value).length > 0);

// ─── Watchers ─────────────────────────────────────────────────────────────────

// Debounce to avoid firing an API call on every keystroke when value is
// bound to a text field that the user is actively editing.
let fetchDebounce: ReturnType<typeof setTimeout> | null = null;

function scheduleFetch() {
  if (fetchDebounce) clearTimeout(fetchDebounce);
  fetchDebounce = setTimeout(() => ensureMeasureLoaded(), 300);
}

watch(() => props.primaryKey, scheduleFetch, { immediate: true });
watch(() => props.value, scheduleFetch);
watch(() => props.options, scheduleFetch, { deep: true });

// ─── Data loading ─────────────────────────────────────────────────────────────

async function ensureMeasureLoaded(): Promise<void> {
  const pk = props.primaryKey ?? null;
  const boundValue = props.value ?? null;

  if (pk && pk !== '+') {
    if (props.field === measureField.value) {
      // This field IS the measure_id field — use its current (possibly unsaved) value
      const id = boundValue;
      if (id) {
        resolvedMeasureId.value = id as string | number;
        await fetchMeasure(id as string | number);
      } else {
        measureData.value = {};
        resolvedMeasureId.value = null;
      }
    } else {
      // Fetch the parent record to resolve the measure_id from a sibling field
      try {
        const resp = await api?.get(`/items/${props.collection}/${pk}`);
        const item = (resp?.data?.data as Record<string, unknown>) ?? {};
        const id = item[measureField.value] ?? null;
        if (id) {
          resolvedMeasureId.value = id as string | number;
          await fetchMeasure(id as string | number);
        } else {
          measureData.value = {};
          resolvedMeasureId.value = null;
        }
      } catch (err) {
        console.error('[MeasurePreview] Error fetching parent item:', err);
        measureData.value = {};
        resolvedMeasureId.value = null;
      }
    }
    return;
  }

  // New record (pk is '+' or null) — only usable if this field is the measure_id field
  if (props.field === measureField.value && boundValue) {
    resolvedMeasureId.value = boundValue as string | number;
    await fetchMeasure(boundValue as string | number);
    return;
  }

  measureData.value = {};
  resolvedMeasureId.value = null;
}

async function fetchMeasure(id: string | number): Promise<void> {
  if (!id || !api) return;
  loading.value = true;
  error.value = null;
  try {
    const fields = [...fieldsToDisplay.value, 'sector', 'slug', 'measure_id'].join(',');
    const response = await api.get(`/items/measures/${id}`, { params: { fields } });
    measureData.value = (response?.data?.data as Record<string, unknown>) ?? {};
  } catch (err) {
    console.error('[MeasurePreview] Error fetching measure:', err);
    error.value = (err as Error)?.message || 'Failed to fetch measure';
    measureData.value = {};
  } finally {
    loading.value = false;
  }
}

// ─── Label resolution ─────────────────────────────────────────────────────────

function getFieldLabel(fieldKey: string): string {
  const translationKey = `ratings_measures.fields.${fieldKey}`;
  // $t is injected globally by Directus — not available in script setup directly,
  // so we use getCurrentInstance as a fallback-safe approach.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const $t = (getCurrentInstance() as any)?.appContext?.config?.globalProperties?.$t;
  if (typeof $t === 'function') {
    const translation = $t(translationKey);
    if (translation && translation !== translationKey) return translation;
  }
  return fieldKey.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

</script>

<style scoped>
.measure-preview {
  --v-notice-padding: 12px 16px;
}

.measure-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.field-preview {
  background-color: var(--theme--background-subdued);
  border: 1px solid var(--theme--border-color-subdued);
  border-radius: var(--theme--border-radius);
  padding: 12px 16px;
  transition: border-color var(--fast) var(--transition);
}

.field-preview:hover {
  border-color: var(--theme--border-color);
}

.field-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  color: var(--theme--foreground-subdued);
}

.field-header .v-icon {
  --v-icon-color: var(--theme--primary);
}

.field-label {
  font-weight: 600;
  font-size: 16px;
  color: var(--theme--foreground);
}

.field-content {
  color: var(--theme--foreground);
  font-size: 15px;
  line-height: 1.6;
}

.field-content.empty {
  color: var(--theme--foreground-subdued);
  font-style: italic;
}

.field-content :deep(p) {
  margin: 0 0 8px;
}

.field-content :deep(p:last-child) {
  margin-bottom: 0;
}

.field-content :deep(ul),
.field-content :deep(ol) {
  margin: 8px 0;
  padding-left: 20px;
}

.field-content :deep(li) {
  margin-bottom: 4px;
}

.loading-container {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  color: var(--theme--foreground-subdued);
}

.loading-text {
  font-size: 14px;
}

.v-notice {
  --v-notice-margin: 0;
}

.measure-link {
  margin-top: 4px;
  margin-bottom: 8px;
}

.measure-link a {
  color: var(--theme--primary);
  text-decoration: underline;
  font-weight: 500;
}

.id-info {
  font-size: 14px;
}
</style>

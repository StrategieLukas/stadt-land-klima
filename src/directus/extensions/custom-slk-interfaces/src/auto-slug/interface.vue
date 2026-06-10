<template>
  <input
    class="auto-slug-input"
    type="text"
    :value="localValue"
    :disabled="disabled"
    autocomplete="off"
    @input="onInput"
  />
</template>

<script setup lang="ts">
import { computed, inject, ref, unref, watch } from 'vue';
import type { Ref } from 'vue';
import slugify from 'slugify';

const slugifyConfig = {
  replacement: '-',
  remove: undefined,
  lower: true,
  strict: true,
  locale: 'de',
  trim: true,
} as const;

const props = defineProps<{
  value?: string | null;
  field?: string;
  disabled?: boolean;
  primaryKey?: string | number | null;
  values?: Record<string, unknown>;
  options?: {
    source_field?: string;
    sync_existing?: boolean;
  } | null;
  source_field?: string;
  sync_existing?: boolean;
}>();

const emit = defineEmits<{
  (e: 'input', value: string): void;
  (e: 'setFieldValue', payload: { field: string; value: string }): void;
}>();

const localValue = ref(props.value ?? '');
const lastGeneratedValue = ref('');
const injectedValues = inject<Ref<Record<string, unknown>> | Record<string, unknown>>('values', ref({}));

const sourceField = computed(() => props.options?.source_field ?? props.source_field ?? 'name');
const syncExisting = computed(() => props.options?.sync_existing ?? props.sync_existing ?? false);
const formValues = computed(() => props.values ?? unref(injectedValues) ?? {});
const sourceValue = computed(() => formValues.value[sourceField.value]);
const isNewItem = computed(() => props.primaryKey === '+' || props.primaryKey === null || props.primaryKey === undefined);

function buildSlug(value: unknown): string {
  return slugify(String(value ?? ''), slugifyConfig);
}

function canAutoSync(): boolean {
  if (syncExisting.value) return true;
  if (isNewItem.value && !localValue.value) return true;
  return !!lastGeneratedValue.value && localValue.value === lastGeneratedValue.value;
}

function setValue(value: string): void {
  localValue.value = value;
  emit('input', value);
  if (props.field) {
    emit('setFieldValue', { field: props.field, value });
  }
}

function syncFromSource(): void {
  if (!canAutoSync()) return;
  const nextValue = buildSlug(sourceValue.value);
  lastGeneratedValue.value = nextValue;
  if (nextValue !== localValue.value) {
    setValue(nextValue);
  }
}

function onInput(event: Event): void {
  const nextValue = (event.target as HTMLInputElement).value;
  localValue.value = nextValue;
  emit('input', nextValue);
}

watch(() => props.value, (value) => {
  localValue.value = value ?? '';
});

watch(sourceValue, syncFromSource, { immediate: true });
</script>

<style scoped>
.auto-slug-input {
  width: 100%;
  min-height: 44px;
  padding: 8px 12px;
  color: var(--theme--foreground);
  font-family: var(--theme--fonts--sans--font-family);
  font-size: 16px;
  line-height: 1.5;
  background: var(--theme--background);
  border: 1px solid var(--theme--border-color);
  border-radius: var(--theme--border-radius);
}

.auto-slug-input:focus {
  border-color: var(--theme--primary);
  outline: none;
}

.auto-slug-input:disabled {
  color: var(--theme--foreground-subdued);
  background: var(--theme--background-subdued);
  cursor: not-allowed;
}
</style>

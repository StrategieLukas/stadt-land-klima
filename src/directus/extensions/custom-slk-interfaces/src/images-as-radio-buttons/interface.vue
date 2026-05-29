<template>
  <div v-if="!choices" class="v-notice warning">No choices configured</div>
  <div
    v-else
    class="radio-icon-buttons"
    :style="containerStyle"
  >
    <input
      :value="value"
      :field="field"
      :collection="collection"
      type="hidden"
      @input="handleChange(($event.target as HTMLInputElement).value, field)"
    />
    <button
      v-for="item in choices"
      :key="item.value"
      class="v-icon-radio block"
      type="button"
      :aria-pressed="isChecked(value, item.value) ? 'true' : 'false'"
      :disabled="disabled"
      :class="[
        { checked: isChecked(value, item.value), block },
        valueToClass(item.value)
      ]"
      @click="selectOption(item.value, field)"
    >
      <span class="label type-text">
        <!-- Prefer SVG icon; fall back to a Directus file asset -->
        <span
          v-if="item.svg_icon"
          class="v-icon"
          v-html="item.svg_icon"
        />
        <img
          v-else-if="item.file_id"
          :src="renderImage(item.file_id, item.modified_on) ?? undefined"
          :alt="item.text"
          class="v-icon img-icon"
        />
        <slot name="label">{{ item.text }}</slot>
      </span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { inject, nextTick, computed } from 'vue';
import useDirectusToken from './use-directus-token';

interface Choice {
  value: string;
  text: string;
  svg_icon?: string;
  /** Directus file UUID — used when svg_icon is absent */
  file_id?: string | null;
  modified_on?: string;
}

const props = defineProps<{
  field?: string;
  collection?: string;
  value?: string;
  disabled?: boolean;
  choices?: Choice[] | null;
  /**
   * Number of columns in the grid. Defaults to the number of choices.
   * Pass a value to override the auto-fit behaviour.
   */
  width?: string | null;
  /**
   * The field whose value should be set to 'published'/'draft' as a side-effect
   * of selecting an option. Defaults to 'status'. Pass an empty string to disable.
   */
  statusField?: string;
}>();

const emit = defineEmits<{
  (e: 'input', value: string): void;
  (e: 'setFieldValue', payload: { field: string; value: string }): void;
}>();

const api = inject<unknown>('api');

const containerStyle = computed(() => ({
  '--v-radio-color': 'var(--theme--primary)',
  '--columns': props.choices?.length || 1,
}));

function selectOption(value: string, field?: string): void {
  if (field !== props.field) return;
  emit('input', value);

  const targetField = props.statusField !== undefined ? props.statusField : 'status';
  if (!targetField) return;

  nextTick().then(() => {
    emit('setFieldValue', {
      field: targetField,
      value: value == null ? 'draft' : 'published',
    });
  });
}

function isChecked(input: string | undefined, value: string): boolean {
  return input === value;
}

function renderImage(file_id: string | null | undefined, modified_on: string = new Date().toISOString()): string | undefined {
  if (!file_id) return undefined;
  const { addTokenToURL } = useDirectusToken(api as never);
  return addTokenToURL(
    `/assets/${file_id}?width=42&height=42&fit=cover&cache-buster=${modified_on}`
  );
}

function handleChange(value: string, field?: string): void {
  if (field === props.field) {
    emit('input', value);
  }
}

function valueToClass(val: string | null | undefined): string {
  // Explicit null/undefined/empty → not-applicable; must come before Number() conversion
  // because Number(null) === 0 which would incorrectly match rating-0
  if (val === null || val === undefined || val === '') return 'rating-na';
  const num = Number(val);
  if (isNaN(num)) return 'rating-na';
  switch (num) {
    case 0:    return 'rating-0';
    case 0.25: return 'rating-1';
    case 0.5:  return 'rating-2';
    case 0.75: return 'rating-3';
    case 1:    return 'rating-4';
    default:   return 'rating-na';
  }
}
</script>

<style scoped>
.radio-icon-buttons {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(var(--columns, 6), 1fr);
}

@media (max-width: 600px) {
  .radio-icon-buttons {
    grid-template-columns: repeat(3, 1fr);
  }
}

.v-icon-radio {
  display: flex;
  font-size: 0;
  text-align: center;
  background-color: transparent;
  border: none;
  border-radius: 0;
  appearance: none;
}

.v-icon-radio .v-icon {
  --v-icon-color: var(--theme--foreground-subdued);
}

.v-icon-radio .v-icon svg {
  width: 100%;
  height: 100%;
  fill: var(--theme--foreground-subdued);
}

.v-icon-radio > .v-icon {
  position: absolute;
  display: none;
}

.v-icon-radio .label {
  display: block;
  width: 100%;
}

.v-icon-radio .label .v-icon {
  display: block;
  margin: 0 auto 3px;
  width: 42px;
  height: 42px;
  border: 2px solid transparent;
  border-radius: 50%;
  padding: 7px;
}

/* img-based icon — same sizing as svg icon */
.v-icon-radio .label .img-icon {
  display: block;
  margin: 0 auto 3px;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid transparent;
}

.v-icon-radio:disabled {
  cursor: not-allowed;
}

.v-icon-radio:disabled .label {
  color: var(--theme--foreground-subdued);
}

.v-icon-radio:disabled .v-icon {
  --v-icon-color: var(--theme--foreground-subdued);
}

.v-icon-radio.block {
  position: relative;
  width: 100%;
  height: auto;
  padding: 10px;
  border: 2px solid var(--border-normal);
  border-radius: var(--theme--border-radius);
}

.v-icon-radio.block:hover {
  border-color: var(--border-normal-alt);
}

.v-icon-radio.block::before {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: var(--background-subdued);
  border-radius: var(--theme--border-radius);
  content: "";
}

.v-icon-radio.block .label {
  z-index: 1;
}

.v-icon-radio:not(:disabled):hover .v-icon {
  --v-icon-color: var(--theme--foreground-subdued);
}

.v-icon-radio:not(:disabled).checked .v-icon {
  --v-icon-color: var(--theme--primary);
}

.v-icon-radio:not(:disabled).checked .v-icon svg {
  fill: var(--theme--primary);
}

.v-icon-radio:not(:disabled).checked.block {
  border-color: var(--theme--primary);
}

.v-icon-radio:not(:disabled).checked.block .label {
  color: black;
}

.v-icon-radio:not(:disabled).checked.block::before {
  background-color: var(--theme--primary);
  opacity: 0.1;
}

/* Rating colour states — using CSS variables where Directus provides them,
   falling back to fixed values for colours Directus doesn't expose */
.v-icon-radio.checked.rating-0  { background-color: var(--theme--danger-background,  #fad3d0); }
.v-icon-radio.checked.rating-1  { background-color: var(--theme--warning-background, #fbdeb2); }
.v-icon-radio.checked.rating-2  { background-color: #fff4cd; }
.v-icon-radio.checked.rating-3  { background-color: #e7efb5; }
.v-icon-radio.checked.rating-4  { background-color: var(--theme--success-background, #d2eddb); }
.v-icon-radio.checked.rating-na { background-color: var(--theme--background-subdued, #d0d0d0); }
</style>

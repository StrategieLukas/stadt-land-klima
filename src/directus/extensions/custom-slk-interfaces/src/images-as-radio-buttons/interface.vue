<template>
  <v-notice v-if="!choices" type="warning">No choices configured</v-notice>
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
      @input="handleChange($event.target.value, field)"
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
        <span
          v-if="item.svg_icon"
          class="v-icon"
          v-html="item.svg_icon"
        ></span>
        <slot name="label">{{ item.text }}</slot>
      </span>
    </button>
  </div>
</template>

<script setup lang="ts">
import useDirectusToken from './use-directus-token';
import { nextTick, computed } from 'vue';

interface Choice {
  value: string;
  text: string;
  svg_icon?: string;
}

const props = defineProps<{
  field?: string;
  collection?: string;
  value?: string;
  disabled?: boolean;
  choices?: Choice[] | null;
  width?: string | null;
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
  if (field === props.field) {
    emit('input', value);
    nextTick().then(() => {
      emit('setFieldValue', {
        field: 'status',
        value: value == null ? 'draft' : 'published',
      });
    });
  }
}

function isChecked(input: string | undefined, value: string): boolean {
  return input === value;
}

function renderImage(file_id: string | null, modified_on: string = new Date().toISOString()): string | void {
  if (file_id === null) return;
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

function valueToClass(val: string): string {
  const num = val === '' || val === undefined ? null : val === null ? null : Number(val);
  switch (num) {
    case 0:
      return 'rating-0';
    case 0.25:
      return 'rating-1';
    case 0.5:
      return 'rating-2';
    case 0.75:
      return 'rating-3';
    case 1:
      return 'rating-4';
    default:
      return 'rating-na';
  }
}
</script>

<style lang="scss" scoped>
.radio-icon-buttons {
  display: grid;
  grid-gap: 12px 12px;

  grid-template-columns: repeat(var(--columns, 6), 1fr);

  /* force 3 columns on mobile regardless of inline var */
  @media (max-width: 600px) {
    grid-template-columns: repeat(3, 1fr) !important;
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
  & .v-icon {
    --v-icon-color: var(--theme--foreground-subdued);
    svg {
      width: 100%;
      height: 100%;
      fill: var(--theme--foreground-subdued);
    }
  }
  & > .v-icon {
    position: absolute;
    display: none;
  }
  & .label {
    display: block;
    width: 100%;
    & .v-icon {
      display: block;
      margin: 0 auto 3px;
      width: 42px;
      height: 42px;
      border: 2px solid transparent;
      border-radius: 50%;
      padding: 7px;
    }
  }
  &:not(.checked) {
    & .label {
      & .v-icon {
        border-color: transparent;
      }
    }
  }
  &:disabled {
    cursor: not-allowed;
    .label {
      color: var(--theme--foreground-subdued);
    }
    .v-icon {
      --v-icon-color: var(--theme--foreground-subdued);
    }
  }
  &.block {
    position: relative;
    width: 100%;
    height: auto;
    padding: 10px;
    border: 2px solid var(--border-normal);
    border-radius: var(--theme--border-radius);
    &:hover {
      border-color: var(--border-normal-alt);
    }
    &::before {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: var(--background-subdued);
      border-radius: var(--theme--border-radius);
      content: "";
    }
    .label {
      z-index: 1;
    }
  }
  &:not(:disabled):hover {
    .v-icon {
      --v-icon-color: var(--theme--foreground-subdued);
    }
  }
  &:not(:disabled).checked {
    .v-icon {
      --v-icon-color: var(--theme--primary);
      svg {
        fill: var(--theme--primary);
      }
    }
    &.block {
      border-color: var(--theme--primary);
      .label {
        color: black;
      }
      &::before {
        background-color: var(--theme--primary);
        opacity: 0.1;
      }
    }
  }
}
.v-icon-radio.checked.rating-0  { background-color: #fad3d0; }
.v-icon-radio.checked.rating-1  { background-color: #fbdeb2; }
.v-icon-radio.checked.rating-2  { background-color: #fff4cd; }
.v-icon-radio.checked.rating-3  { background-color: #e7efb5; }
.v-icon-radio.checked.rating-4  { background-color: #d2eddb; }
.v-icon-radio.checked.rating-na { background-color: #d0d0d0; }

</style>

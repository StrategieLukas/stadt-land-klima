<template>
  <interface-select-multiple-checkbox
    :value="selected"
    :choices="choices"
    :disabled="disabled"
    :non-editable="nonEditable"
    :width="width"
    @input="emit('input', $event)"
  />
</template>

<script setup lang="ts">
import { computed } from "vue";
import { mergeThesisCategories } from "../../../../../frontend/shared/thesisCategories";

const props = defineProps<{
  value?: unknown;
  choices?: { text: string; value: string }[];
  disabled?: boolean;
  nonEditable?: boolean;
  width?: string;
}>();
const emit = defineEmits<{ input: [value: string[]] }>();

// Show earlier choices as their current equivalents. Only a checkbox edit emits a new value.
const selected = computed(() => {
  const categories = Array.isArray(props.value) ? mergeThesisCategories(props.value) : [];
  return categories.filter(
    (value): value is string => props.choices?.some((choice) => choice.value === value) ?? false,
  );
});
</script>

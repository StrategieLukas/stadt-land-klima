<template>
  <button type="button" class="slk-filter-pill" :class="modelValue ? 'slk-filter-pill--active' : ''" @click="toggle">
    {{ label }}
  </button>
</template>

<script setup lang="ts">
const props = defineProps({
  label: { type: String, required: true },
  modelValue: { type: Boolean, default: false },
});

const emit = defineEmits<{ "update:modelValue": [value: boolean] }>();

function toggle() {
  emit("update:modelValue", !props.modelValue);
}
</script>

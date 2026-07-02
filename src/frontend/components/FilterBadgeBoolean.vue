<template>
  <button type="button" @click="toggle" class="slk-filter-pill" :class="modelValue ? 'slk-filter-pill--active' : ''">
    {{ label }}
  </button>
</template>

<script setup>
const props = defineProps({
  label: { type: String, required: true },
  modelValue: { type: Boolean, default: false },
});

const emit = defineEmits(["update:modelValue"]);

function toggle() {
  emit("update:modelValue", !props.modelValue);
}
</script>

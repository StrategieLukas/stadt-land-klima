<template>
  <button
    type="button"
    @click="toggle"
    :class="[
      'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border transition-colors whitespace-nowrap',
      modelValue
        ? 'bg-[#16BAE7] text-white border-[#16BAE7]'
        : 'bg-white text-[#16BAE7] border-[#16BAE7] hover:bg-[#E8F7FD]'
    ]"
  >
    {{ label }}
  </button>
</template>

<script setup>
const props = defineProps({
  label: { type: String, required: true },
  modelValue: { type: Boolean, default: false },
});

const emit = defineEmits(['update:modelValue']);

function toggle() {
  emit('update:modelValue', !props.modelValue);
}
</script>

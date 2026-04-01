<template>
  <div ref="containerRef" class="relative inline-block">
    <button
      type="button"
      @click="toggle"
      :class="[
        'inline-flex items-center justify-between gap-2 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors whitespace-nowrap',
        width,
        modelValue !== null
          ? 'bg-[#16BAE7] text-white border-[#16BAE7]'
          : 'bg-white text-[#16BAE7] border-[#16BAE7] hover:bg-[#E8F7FD]'
      ]"
    >
      <span>{{ selectedLabel }}</span>
      <svg
        :class="['w-3 h-3 transition-transform', open ? 'rotate-180' : '']"
        fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"
      >
        <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    <div
      v-if="open"
      class="absolute z-50 mt-1 min-w-full bg-white border border-gray-200 rounded shadow-lg overflow-hidden"
    >
      <!-- "All" / reset option -->
      <button
        type="button"
        @click="select(null)"
        :class="[
          'w-full text-left px-4 py-2 text-sm transition-colors',
          modelValue === null
            ? 'bg-[#16BAE7] text-white'
            : 'text-gray-700 hover:bg-[#E8F7FD]'
        ]"
      >
        {{ label }}
      </button>
      <button
        v-for="opt in options"
        :key="opt.value"
        type="button"
        @click="select(opt.value)"
        :class="[
          'w-full text-left px-4 py-2 text-sm transition-colors',
          modelValue === opt.value
            ? 'bg-[#16BAE7] text-white'
            : 'text-gray-700 hover:bg-[#E8F7FD]'
        ]"
      >
        {{ opt.label }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';

const props = defineProps({
  label: { type: String, required: true },       // default/reset text e.g. "Alle Bundesländer"
  options: { type: Array, required: true },       // [{ label: String, value: String }]
  modelValue: { type: String, default: null },
  width: { type: String, default: 'min-w-[10rem]' }, // fixed width to prevent layout shift
});

const emit = defineEmits(['update:modelValue']);

const open = ref(false);
const containerRef = ref(null);

const selectedLabel = computed(() => {
  if (props.modelValue === null) return props.label;
  return props.options.find(o => o.value === props.modelValue)?.label ?? props.label;
});

function toggle() {
  open.value = !open.value;
}

function select(value) {
  emit('update:modelValue', value);
  open.value = false;
}

function onClickOutside(event) {
  if (containerRef.value && !containerRef.value.contains(event.target)) {
    open.value = false;
  }
}

onMounted(() => document.addEventListener('click', onClickOutside));
onBeforeUnmount(() => document.removeEventListener('click', onClickOutside));
</script>

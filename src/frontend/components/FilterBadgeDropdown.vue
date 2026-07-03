<template>
  <div ref="containerRef" class="relative inline-block">
    <button
      type="button"
      @click="toggle"
      class="slk-filter-pill justify-between"
      :class="[width, modelValue !== null ? 'slk-filter-pill--active' : '']"
      :style="customColorStyle"
    >
      <span>{{ selectedLabel }}</span>
      <svg
        :class="['h-3 w-3 transition-transform', open ? 'rotate-180' : '']"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="3"
      >
        <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    <div v-if="open" class="slk-filter-menu absolute z-50 mt-1 min-w-full max-w-full overflow-hidden rounded shadow-lg">
      <button
        type="button"
        @click="select(null)"
        class="slk-filter-menu-item w-full whitespace-normal break-words px-4 py-2 text-left text-sm transition-colors"
        :class="modelValue === null ? 'slk-filter-menu-item--active' : ''"
        :style="customColorStyle"
      >
        {{ label }}
      </button>
      <button
        v-for="opt in options"
        :key="opt.value"
        type="button"
        @click="select(opt.value)"
        class="slk-filter-menu-item w-full whitespace-normal break-words px-4 py-2 text-left text-sm transition-colors"
        :class="modelValue === opt.value ? 'slk-filter-menu-item--active' : ''"
        :style="customColorStyle"
      >
        {{ opt.label }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from "vue";

const props = defineProps({
  label: { type: String, required: true }, // default/reset text e.g. "Alle Bundesländer"
  options: { type: Array, required: true }, // [{ label: String, value: String }]
  modelValue: { type: String, default: null },
  width: { type: String, default: "min-w-[10rem]" }, // fixed width to prevent layout shift
  activeColor: { type: String, default: "#16BAE7" }, // active state color
  dark: { type: Boolean, default: false }, // kept for existing callers
});

const emit = defineEmits(["update:modelValue"]);

const open = ref(false);
const containerRef = ref(null);

const customColorStyle = computed(() => {
  if (!props.activeColor || props.activeColor.toLowerCase() === "#16bae7") {
    return null;
  }

  return {
    "--slk-filter-active-bg": props.activeColor,
    "--slk-filter-inactive-border": props.activeColor,
    "--slk-filter-inactive-text": props.activeColor,
  };
});

const selectedLabel = computed(() => {
  if (props.modelValue === null) return props.label;
  return props.options.find((o) => o.value === props.modelValue)?.label ?? props.label;
});

function toggle() {
  open.value = !open.value;
}

function select(value) {
  emit("update:modelValue", value);
  open.value = false;
}

function onClickOutside(event) {
  if (containerRef.value && !containerRef.value.contains(event.target)) {
    open.value = false;
  }
}

onMounted(() => document.addEventListener("click", onClickOutside));
onBeforeUnmount(() => document.removeEventListener("click", onClickOutside));
</script>

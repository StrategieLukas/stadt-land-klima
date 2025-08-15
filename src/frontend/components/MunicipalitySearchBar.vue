<template>
  <div class="relative w-full max-w-md">
    <label class="label" for="search-input">{{ label }}</label>
    <div class="relative">
      <input
        id="search-input"
        v-model="q"
        type="text"
        autocomplete="off"
        class="input input-bordered input-primary w-full bg-white pr-12"
        @input="onInput"
        @focus="focused = true"
        @keydown.down.prevent="moveFocus(1)"
        @keydown.up.prevent="moveFocus(-1)"
        @keydown.enter.prevent="goToFocused()"
      />
      <button
        v-if="q"
        class="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-80"
        @click="clear"
      >
        ✖️
      </button>
    </div>

    <!-- Suggestions Dropdown -->
    <ul
      v-if="visibleSuggestions.length && focused"
      class="absolute z-50 mt-1 w-full rounded-md border bg-base-100 p-2 shadow"
      @mouseleave="focusedIndex = -1"
    >
      <li
        v-for="(s, i) in visibleSuggestions"
        :key="s.slug"
        :class="[
          'cursor-pointer rounded p-2 hover:bg-base-200',
          focusedIndex === i ? 'bg-base-200' : ''
        ]"
        @mousedown.prevent="goTo(s.url)"
        @mouseenter="focusedIndex = i"
      >
        {{ s.label }}
      </li>
    </ul>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useRouter } from 'vue-router';

const props = defineProps({
  municipalities: {
    type: Array,
    required: true,
  },
  label: {
    type: String,
    required: true,
  },
  basePath: {
    type: String,
    required: true,
  },
});

const q = ref('');
const focused = ref(false);
const focusedIndex = ref(-1);
const router = useRouter();

const visibleSuggestions = computed(() => {
  const term = q.value.trim().toLowerCase();
  if (!term) return [];
  return props.municipalities
    .filter((m) => m.name.toLowerCase().includes(term))
    .slice(0, 5)
    .map((m) => ({
      label: m.name,
      url: `${props.basePath}/${m.slug}`,
    }));
});

function onInput() {
  focusedIndex.value = -1;
}

function clear() {
  q.value = '';
  focusedIndex.value = -1;
}

function goTo(url) {
  q.value = '';
  focusedIndex.value = -1;
  focused.value = false;
  router.push(url);
}

function moveFocus(direction) {
  const max = visibleSuggestions.value.length - 1;
  focusedIndex.value = Math.min(max, Math.max(0, focusedIndex.value + direction));
}

function goToFocused() {
  const suggestion = visibleSuggestions.value[focusedIndex.value];
  if (suggestion) goTo(suggestion.url);
}

watch(() => document.activeElement, (el) => {
  if (!el || el.id !== 'search-input') focused.value = false;
});
</script>

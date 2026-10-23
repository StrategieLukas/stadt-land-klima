<template>
  <!-- Search Bar and map toggle-->
  <div class="z-[9999] flex items-end space-x-4">
    <!-- Search Bar -->
    <form class="relative overflow-visible" @submit.prevent>
      <div class="form-control">
        <label for="search-input" class="label">{{ $t("municipalities_search.label") }}</label>
        <input
          id="search-input"
          v-model="q"
          class="input input-bordered input-primary w-64 max-w-full rounded-full bg-white pr-12 sm:w-96"
          name="q"
          type="text"
          autocomplete="off"
          @input="onInput"
          @focus="searchFocused = true"
          @keydown.down.prevent="moveFocus(1)"
          @keydown.up.prevent="moveFocus(-1)"
          @keydown.enter.prevent="goToFocused()"
        />
      </div>

      <div
        v-if="visibleSuggestions.length && searchFocused"
        ref="dropdown"
        class="absolute left-0 right-0 top-24 z-50 w-full"
      >
        <ul class="menu dropdown-content w-full rounded-box bg-base-100 p-2 shadow">
          <NuxtLink
            v-for="(suggestion, index) in visibleSuggestions"
            :key="index"
            :to="suggestion.url"
            class="block w-full cursor-pointer rounded p-2 hover:bg-solid-light-green-20"
            @click="handleSuggestionClick"
          >
            {{ suggestion.label }}
          </NuxtLink>
        </ul>
      </div>
    </form>

    <!-- Map/List toggle -->
    <button
      :class="{ invisible: route.path !== '/municipalities' }"
      :aria-hidden="route.path !== '/municipalities'"
      class="hover:bg-gray-100 flex h-12 w-12 items-center justify-center rounded-md text-base-100"
      @click="toggleView"
    >
      <!-- eslint-disable vue/no-v-html -- SVG is imported from checked-in assets. -->
      <span class="h-12 w-12 flex-none" v-html="isMapView ? listViewIcon : mapViewIcon"></span>
      <!-- eslint-enable vue/no-v-html -->
    </button>
  </div>
</template>

<script setup lang="ts">
import type { PropType } from "vue";
import type { Municipality } from "~/types/components/municipality";

// Search bar logic
import { computed, ref, onMounted, onBeforeUnmount, watch } from "vue";
import { useRouter } from "vue-router";

// Map toggle logic
import mapViewIcon from "~/assets/icons/icon_map_view.svg?raw";
import listViewIcon from "~/assets/icons/icon_list_view.svg?raw";

const { $t } = useNuxtApp();

const props = defineProps({
  municipalities: {
    type: Array as PropType<Municipality[]>,
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

const dropdown = ref<HTMLElement | null>(null);
const q = ref("");
const searchFocused = ref(false);
const focusedIndex = ref(-1);
const router = useRouter();
const route = useRoute();

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

function goTo(url: string) {
  q.value = "";
  focusedIndex.value = -1;
  searchFocused.value = false;
  void router.push(url);
}

function moveFocus(direction: number) {
  const max = visibleSuggestions.value.length - 1;
  focusedIndex.value = Math.min(max, Math.max(0, focusedIndex.value + direction));
}

function goToFocused() {
  const suggestion = visibleSuggestions.value[focusedIndex.value];
  if (suggestion) goTo(suggestion.url);
}

watch(
  () => document.activeElement,
  (el) => {
    if (!el || el.id !== "search-input") searchFocused.value = false;
  },
);

function handleSuggestionClick() {
  q.value = "";
  searchFocused.value = false;
  focusedIndex.value = -1;
}

function handleClickOutside(event: MouseEvent) {
  if (!(event.target instanceof Element)) return;
  if (dropdown.value && !dropdown.value.contains(event.target) && !event.target.closest("form")) {
    searchFocused.value = false;
  }
}

onMounted(() => {
  document.addEventListener("click", handleClickOutside);
});

onBeforeUnmount(() => {
  document.removeEventListener("click", handleClickOutside);
});

const isMapView = computed(() => route.query.view === "map");

const toggleView = () => {
  const newView = isMapView.value ? "list" : "map";

  if (route.path !== "/municipalities") {
    // If not on the municipalities page, navigate there with the view query
    void router.push({ path: "/municipalities", query: { ...route.query, view: newView } });
  } else {
    // If already on the municipalities page, just update the query param
    void router.push({ query: { ...route.query, view: newView } });
  }
};
</script>

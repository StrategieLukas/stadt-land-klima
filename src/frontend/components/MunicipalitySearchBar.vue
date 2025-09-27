<template>
  <!-- Search Bar and map toggle-->
  <div class="flex items-end space-x-4">
    <!-- Search Bar -->
    <form class="relative overflow-visible" @submit.prevent>
      <div class="form-control">
        <label for="search-input" class="label">{{ $t("municipalities_search.label") }}</label>
        <input
          id="search-input"
          v-model="q"
          class="input input-bordered input-primary w-64 max-w-full bg-white pr-12 sm:w-96"
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
        class="absolute left-0 right-0 top-24 w-full z-50"
        ref="dropdown"
      >
        <ul class="menu dropdown-content rounded-box w-full bg-base-100 p-2 shadow">
          <NuxtLink
            v-for="(suggestion, index) in visibleSuggestions"
            :key="index"
            :to="suggestion.url"
            class="block w-full p-2 hover:bg-primary/20 rounded cursor-pointer"
            @click="handleSuggestionClick"
          >
            {{ suggestion.label }}
          </NuxtLink>
        </ul>
      </div>
    </form>

    <!-- Map/List toggle -->
    <button
      :class="{'invisible': route.path !== '/municipalities'}"
      :aria-hidden="route.path !== '/municipalities'"
      @click="toggleView"
      class="flex items-center justify-center w-12 h-12 rounded-md hover:bg-gray-100"
    >
      <span v-html="isMapView ? listViewIcon : mapViewIcon" class="w-12 h-12 flex-none"></span>
    </button>
  </div>
</template>

<script setup>

// Search bar logic
import { computed, ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRouter } from 'vue-router';

const { $t } = useNuxtApp();

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


if(!props.municipalities) {
  console.error('Municipalities are required');
}
console.log("municipality props",props.municipalities);

const dropdown = ref(null)
const q = ref('');
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


function goTo(url) {
  q.value = '';
  focusedIndex.value = -1;
  searchFocused.value = false;
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
  if (!el || el.id !== 'search-input') searchFocused.value = false;
});


function handleSuggestionClick() {
  q.value = '';
  searchFocused.value = false
  focusedIndex.value = -1;
}

function handleClickOutside(event) {
  if (
    dropdown.value &&
    !dropdown.value.contains(event.target) &&
    !event.target.closest('form')
  ) {
    searchFocused.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
})



// Map toggle logic
import mapViewIcon from '~/assets/icons/icon_map_view.svg?raw';
import listViewIcon from '~/assets/icons/icon_list_view.svg?raw';


const isMapView = computed(() => route.query.view === 'map');

const toggleView = () => {
  const newView = isMapView.value ? 'list' : 'map';

  if (route.path !== '/municipalities') {
    // If not on the municipalities page, navigate there with the view query
    router.push({ path: '/municipalities', query: { ...route.query, view: newView } });
  } else {
    // If already on the municipalities page, just update the query param
    router.push({ query: { ...route.query, view: newView } });
  }
};
</script>

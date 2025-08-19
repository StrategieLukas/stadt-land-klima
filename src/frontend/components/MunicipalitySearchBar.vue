<template>
  <!-- Search Bar and map toggle-->
  <div class="flex items-end space-x-4">
    <!-- Search Bar -->
    <form class="relative overflow-visible" action="javascript:;">
      <div class="form-control">
        <label for="search-input" class="label">{{ $t("municipalities_search.label") }}</label>
        <input
          id="search-input"
          v-model="q"
          class="input input-bordered input-primary w-64 max-w-full bg-white pr-12 sm:w-96"
          name="q"
          type="text"
          autocomplete="off"
          @focus="handleSearchFocus()"
          @blur="handleSearchBlur()"
        />
        <button
          class="absolute right-4 top-12 py-1 opacity-50 hover:opacity-60 focus:opacity-60"
          @click="handleResetSearchClick()"
        >
          ✖️
        </button>
      </div>

      <div
        v-if="suggestions.length && searchFocused"
        class="dropdown-open dropdown absolute left-0 right-0 top-24 w-full"
      >
        <label tabindex="0"></label>
        <ul tabindex="0" class="menu dropdown-content rounded-box z-50 w-full bg-base-100 p-2 shadow">
          <div v-for="(suggestion, index) in suggestions" :key="index">
            <NuxtLink :to="suggestion.url" class="p-0" @click="handleSuggestionClick">
              <li>
                <div>{{ suggestion.label }}</div>
              </li>
            </NuxtLink>
          </div>
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
import { computed, ref } from "vue";
const { $t, $directus, $readItems } = useNuxtApp();
const q = ref("");
const searchFocused = ref(false);
const { data: municipalities } = await useAsyncData("municipalities", () => {
  return $directus.request(
    $readItems("municipalities", {
      fields: ["slug", "name"],
      sort: "name",
      filter: {
        status: {
          _eq: "published",
        },
      },
      limit: -1,
    }),
  );
});

function handleSearchFocus() {
  searchFocused.value = true;
}

function handleSearchBlur() {
  setTimeout(() => {
    searchFocused.value = false;
  }, 100);
}

function handleSuggestionClick(event) {
  q.value = "";
  return false;
}

function handleResetSearchClick() {
  q.value = "";
}

const suggestions = computed(() => {
  const _q = q.value.trim().toLowerCase();

  if (!_q.length || !municipalities.value || !municipalities.value.length) {
    return [];
  }

  return municipalities.value
    .filter((municipality) => {
      return municipality.name.toLowerCase().indexOf(_q) !== -1;
    })
    .map((municipality) => {
      return {
        url: `/municipalities/${municipality.slug}`,
        label: municipality.name,
      };
    })
    .slice(0, 5);
});



// Map toggle logic
const route = useRoute();
const router = useRouter();

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
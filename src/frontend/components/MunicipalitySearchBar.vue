<template>
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
</template>

<script setup>
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
</script>
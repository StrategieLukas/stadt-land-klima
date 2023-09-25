<template lang="">
  <header class="mb-3 bg-white px-2 py-4 shadow">
    <div class="mx-auto flex w-full max-w-screen-xl flex-col items-center gap-x-8 lg:flex-row lg:items-end">
      <NuxtLink to="/">
        <img src="~/assets/images/StadtLandKlima-Logo.svg" class="h-32 w-auto" :alt="$t('logo.alt')" />
      </NuxtLink>
      <form class="mb-1 relative overflow-visible" action="javascript:;">
        <div class="form-control">
          <label for="search-input" class="label">{{ $t('municipalities_search.label') }}</label>
          <input
            id="search-input"
            class="input input-bordered input-primary w-64 sm:w-96 max-w-full bg-white pr-12"
            name="q"
            type="text"
            v-model="q"
            autocomplete="off"
            @focus="handleSearchFocus()"
            @blur="handleSearchBlur()"
          />
          <button
            class="absolute top-12 right-4 py-1 opacity-50 hover:opacity-60 focus:opacity-60"
            @click="handleResetSearchClick()"
          >
            ✖️
          </button>
        </div>

        <div
          v-if="suggestions.length && searchFocused"
          class="absolute top-24 left-0 right-0 dropdown dropdown-open w-full"
        >
          <label tabindex="0"></label>
          <ul tabindex="0" class="dropdown-content z-50 menu p-2 shadow bg-base-100 rounded-box w-full">
            <li v-for="suggestion in suggestions">
              <NuxtLink
                :to="suggestion.url"
                @click="handleSuggestionClick()"
              >
                {{ suggestion.label }}
              </NuxtLink>
            </li>
          </ul>
        </div>
      </form>
    </div>
  </header>
</template>
<script setup>
import { computed, ref } from 'vue';
const { $t, $directus, $readItems } = useNuxtApp();
const q = ref('');
const searchFocused = ref(false);
const { data: municipalities } = await useAsyncData("municipalities", () => {
  return $directus.request(
    $readItems("municipalities", {
      fields: ["slug", "name"],
      sort: 'name',
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

function handleSuggestionClick() {
  q.value = '';
}

function handleResetSearchClick() {
  q.value = '';
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
<style lang=""></style>

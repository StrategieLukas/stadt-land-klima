<template>
  <!-- Search Bar -->
  <div class="flex items-end space-x-4">
    <form class="relative overflow-visible" @submit.prevent>
      <div class="form-control">
        <label for="admin-search-input" class="label">{{ label }}</label>
        <input
          id="admin-search-input"
          v-model="q"
          class="input input-bordered input-primary w-64 max-w-full bg-white pr-12 sm:w-96"
          name="q"
          type="text"
          autocomplete="off"
          :placeholder="$t('administrative_areas.search.placeholder')"
          @input="onInput"
          @focus="searchFocused = true"
          @keydown.down.prevent="moveFocus(1)"
          @keydown.up.prevent="moveFocus(-1)"
          @keydown.enter.prevent="goToFocused()"
        />
      </div>

      <div
        v-if="visibleSuggestions.length && searchFocused"
        class="absolute left-0 right-0 top-24 w-full z-[9999]"
        ref="dropdown"
      >
        <div class="bg-white shadow-lg rounded-md border border-gray-200 max-h-60 overflow-y-auto">
          <div
            v-for="(suggestion, index) in visibleSuggestions"
            :key="suggestion.ars"
            class="px-4 py-3 cursor-pointer hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
            :class="{ 'bg-blue-50': index === focusedIndex }"
            @click="goTo(suggestion.url); handleSuggestionClick()"
          >
            <div class="flex items-center justify-between">
              <div class="flex-1">
                <div class="text-xs font-medium uppercase text-gray-500">
                  {{ suggestion.prefix }}
                </div>
                <div class="text-md font-semibold text-gray-900">
                  {{ suggestion.name }}
                </div>
              </div>
              <div class="flex flex-col items-end space-y-1">
                <div v-if="suggestion.hasRating" class="flex space-x-2">
                  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    {{ suggestion.scoreDisplay }}
                  </span>
                  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {{ suggestion.percentageDisplay }}
                  </span>
                </div>
                <div v-else class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                  {{ $t('administrative_areas.not_rated_yet') }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </form>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRouter } from 'vue-router'
import { debounce } from 'lodash'

const { $t, $stadtlandzahlAPI } = useNuxtApp()

const props = defineProps({
  label: {
    type: String,
    required: true,
  },
  basePath: {
    type: String,
    required: true,
  },
})

const dropdown = ref(null)
const q = ref('')
const searchFocused = ref(false)
const focusedIndex = ref(-1)
const router = useRouter()
const searchResults = ref([])
const isLoading = ref(false)

// Debounced search function
const debouncedSearch = debounce(async (searchTerm) => {
  if (!searchTerm.trim()) {
    searchResults.value = []
    return
  }

  isLoading.value = true
  try {
    const result = await $stadtlandzahlAPI.searchThroughAdministrativeAreasByName(searchTerm.trim())
    if (result?.allAdministrativeAreas?.edges) {
      searchResults.value = result.allAdministrativeAreas.edges.map(edge => edge.node)
    } else {
      searchResults.value = []
    }
  } catch (error) {
    console.error('Search failed:', error)
    searchResults.value = []
  } finally {
    isLoading.value = false
  }
}, 300)

const visibleSuggestions = computed(() => {
  if (!searchResults.value.length) return []
  
  return searchResults.value.slice(0, 5).map((area) => {
    const hasRating = area.stadtlandklimaData && area.stadtlandklimaData.slug
    let url = `${props.basePath}/${area.ars}`

    return {
      ars: area.ars,
      prefix: area.prefix,
      name: area.name,
      url,
      hasRating,
      scoreDisplay: hasRating ? `${Math.round(area.stadtlandklimaData.scoreTotal * 10) / 10}%` : null,
      percentageDisplay: hasRating ? `${area.stadtlandklimaData.percentageRated}% bewertet` : null,
    }
  })
})

function onInput() {
  focusedIndex.value = -1
  debouncedSearch(q.value)
}

function goTo(url) {
  q.value = ''
  focusedIndex.value = -1
  searchFocused.value = false
  router.push(url)
}

function moveFocus(direction) {
  const max = visibleSuggestions.value.length - 1
  focusedIndex.value = Math.min(max, Math.max(0, focusedIndex.value + direction))
}

function goToFocused() {
  const suggestion = visibleSuggestions.value[focusedIndex.value]
  if (suggestion) goTo(suggestion.url)
}

watch(() => document.activeElement, (el) => {
  if (!el || el.id !== 'admin-search-input') searchFocused.value = false
})

function handleSuggestionClick() {
  q.value = ''
  searchFocused.value = false
  focusedIndex.value = -1
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
</script>
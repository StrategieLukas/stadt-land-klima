<template>
  <!-- Search Bar -->
  <div class="flex flex-col lg:flex-row lg:items-end gap-4 lg:gap-6">
    <form class="relative overflow-visible flex-1" @submit.prevent>
      <div class="form-control w-full">
        <label for="admin-search-input" class="label">{{ translatedLabel }}</label>
        <input
          id="admin-search-input"
          v-model="q"
          class="input input-bordered w-full bg-white pr-12 border-stats-dark focus:border-stats-dark focus:ring-1 focus:ring-stats-dark"
          name="q"
          type="text"
          autocomplete="off"
          :placeholder="translatedPlaceholder"
          @input="onInput"
          @focus="searchFocused = true"
          @keydown.down.prevent="moveFocus(1)"
          @keydown.up.prevent="moveFocus(-1)"
          @keydown.enter.prevent="goToFocused()"
        />
      </div>

      <div
        v-if="(visibleSuggestions.length || isLoading || (searchFocused && q.trim() && !isLoading && !searchResults.length)) && searchFocused"
        class="absolute left-0 right-0 top-20 sm:top-24 w-full z-[9999]"
        ref="dropdown"
      >
        <div class="bg-white shadow-lg rounded-md border border-gray-200 max-h-60 overflow-y-auto">
          <div v-if="isLoading">
            <div class="text-gray-500 italic text-sm px-4 py-3">
              {{ $t('generic.loading') }}
            </div>
          </div>

          <!-- No results message -->
          <div v-else-if="searchFocused && q.trim() && !isLoading && !searchResults.length" class="px-4 py-3">
            <div class="text-gray-500 italic text-sm">
              {{ $t('administrative_areas.search.no_results') }}
            </div>
          </div>

          <!-- Search results -->
          <div v-else>
            <div
              v-for="(suggestion, index) in visibleSuggestions"
              :key="suggestion.ars"
              class="px-3 sm:px-4 py-3 cursor-pointer hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
              :class="{ 'bg-stats-light': index === focusedIndex }"
              @click="goTo(suggestion.url); handleSuggestionClick()"
            >
              <div class="flex items-start sm:items-center justify-between gap-2">
                <div class="flex-1 min-w-0">
                  <div class="text-xs font-medium uppercase text-gray-500 truncate">
                    {{ suggestion.prefix }}
                  </div>
                  <div class="text-sm sm:text-base font-semibold text-gray-900 break-words">
                    {{ suggestion.name }}
                  </div>
                </div>
                <div class="flex flex-col items-end space-y-1 flex-shrink-0">
                  <div v-if="suggestion.hasRating" class="flex flex-col sm:flex-row gap-1 sm:gap-2">
                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 whitespace-nowrap">
                      {{ suggestion.scoreDisplay }}
                    </span>
                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 whitespace-nowrap">
                      {{ suggestion.percentageDisplay }}
                    </span>
                  </div>
                  <div v-else class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 whitespace-nowrap">
                    {{ $t('administrative_areas.not_rated_yet') }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </form>

    <!-- Filter Radio Group -->
    <div class="form-control flex-shrink-0 lg:min-w-0" ref="radioGroup">
      <label class="label">
        <span class="label-text">{{ $t('administrative_areas.search.filter_settings') }}</span>
      </label>
      <div class="flex flex-col gap-1.5 space-y-2 lg:space-y-0">
        <label class="flex items-center space-x-2 cursor-pointer whitespace-nowrap">
          <input
            type="radio"
            value="reasonable"
            v-model="filterType"
            class="radio radio-sm bg-white checked:bg-blue-800 flex-shrink-0"
            @change="handleFilterChange"
          />
          <span class="text-sm">{{ $t('administrative_areas.search.reasonable_rate_able_municipalities') }}</span>
        </label>
        
        <label class="flex items-center space-x-2 cursor-pointer whitespace-nowrap">
          <input
            type="radio"
            value="all"
            v-model="filterType"
            class="radio radio-sm bg-white checked:bg-blue-800 flex-shrink-0"
            @change="handleFilterChange"
          />
          <span class="text-sm">{{ $t('all_administrative_areas') }}</span>
        </label>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRouter } from 'vue-router'
import lodash from 'lodash'
const { debounce } = lodash

const { $t, $stadtlandzahlAPI } = useNuxtApp()

const props = defineProps({
  basePath: {
    type: String,
    required: true,
  },
})

const dropdown = ref(null)
const radioGroup = ref(null)
const q = ref('')
const searchFocused = ref(false)
const focusedIndex = ref(-1)
const filterType = ref('reasonable')
const router = useRouter()
const searchResults = ref([])
const isLoading = ref(false)

// Computed property to convert filterType to boolean for API call
const filterReasonable = computed(() => filterType.value === 'reasonable')

// Debounced search function
const debouncedSearch = debounce(async (searchTerm) => {
  if (!searchTerm.trim()) {
    searchResults.value = []
    isLoading.value = false
    return
  }

  isLoading.value = true
  try {
    const result = await $stadtlandzahlAPI.searchThroughAdministrativeAreasByName(
      searchTerm.trim(),
      filterReasonable.value ? { isReasonableForMunicipalRating: true } : {}
    )
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

// Show different placeholder and label depending on the optoin selected
const translatedLabel = computed(() =>
  filterType.value === 'reasonable'
    ? $t('administrative_areas.search.reasonable_municipality.label')
    : $t('administrative_areas.search.all_administrative_areas.label')
)

const translatedPlaceholder = computed(() =>
  filterType.value === 'reasonable'
    ? $t('administrative_areas.search.reasonable_municipality.placeholder')
    : $t('administrative_areas.search.all_administrative_areas.placeholder')
)

function onInput() {
  focusedIndex.value = -1
  if (q.value.trim()) {
    isLoading.value = true
  }
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

function handleFilterChange() {
  console.log('Filter changed to:', filterType.value)
  if (q.value.trim()) {
    isLoading.value = true
    debouncedSearch(q.value)
  }
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
  // Only close dropdown if click is outside both dropdown and radio group
  if (
    dropdown.value &&
    !dropdown.value.contains(event.target) &&
    !event.target.closest('form') &&
    radioGroup.value &&
    !radioGroup.value.contains(event.target)
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
<template>
  <!-- Search Bar -->
  <div class="flex flex-col lg:flex-row lg:items-end gap-4 lg:gap-6">
    <form class="relative overflow-visible flex-1" @submit.prevent>
      <div class="form-control w-full">
        <label for="admin-search-input" class="label">{{ translatedLabel }}</label>
        <input
          id="admin-search-input"
          ref="inputRef"
          v-model="q"
          class="input input-bordered w-full bg-white pr-12 border-stats-dark focus:border-stats-dark focus:ring-1 focus:ring-stats-dark"
          name="q"
          type="text"
          autocomplete="off"
          :placeholder="translatedPlaceholder"
          @input="onInput"
          @focus="handleFocus"
          @keydown.down.prevent="moveFocus(1)"
          @keydown.up.prevent="moveFocus(-1)"
          @keydown.enter.prevent="goToFocused()"
        />
      </div>

      <!-- Teleport dropdown to body to escape stacking context -->      
      <Teleport to="body">
        <div
          v-if="(visibleSuggestions.length || isLoading || (searchFocused && q.trim() && !isLoading && !visibleSuggestions.length)) && searchFocused && dropdownPosition.show"
          class="fixed z-[99999] bg-white shadow-lg rounded-md border border-gray-200 max-h-60 overflow-y-auto"
          :style="{
            top: dropdownPosition.top + 'px',
            left: dropdownPosition.left + 'px',
            width: dropdownPosition.width + 'px'
          }"
          ref="dropdown"
        >
          <div v-if="isLoading">
            <div class="text-gray-500 italic text-sm px-4 py-3">
              {{ $t('generic.loading') }}
            </div>
          </div>

          <!-- No results message -->
          <div v-else-if="searchFocused && q.trim() && !isLoading && !visibleSuggestions.length" class="px-4 py-3">
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
              :class="{ 'bg-stats-light': index === focusedIndex, 'opacity-60 cursor-default': !suggestion.url }"
              @click="suggestion.url ? (goTo(suggestion.url), handleSuggestionClick()) : null"
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
                  <!-- Published: score -->
                  <div v-if="suggestion.ctaType === 'complete'" class="flex flex-col sm:flex-row gap-1 sm:gap-2">
                    <span
                      class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap text-white"
                      :class="`bg-${suggestion.scoreTotalColorClass}`"
                    >
                      {{ suggestion.scoreDisplay }}
                    </span>
                  </div>
                  <!-- Localteam active, rating in progress -->
                  <div v-else-if="suggestion.ctaType === 'in-progress'" class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 whitespace-nowrap">
                    Bewertung läuft
                  </div>
                  <!-- No localteam yet -->
                  <div v-else class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 whitespace-nowrap">
                    {{ $t('administrative_areas.not_rated_yet') }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Teleport>
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
import { useRoute } from 'vue-router'
import { useRouter } from 'vue-router'
import { useAreaSearch } from '~/composables/useAreaSearch.js'
import { getCatalogVersion } from '~/composables/getCatalogVersion.js'

const { $t, $directus, $readItems } = useNuxtApp()

// Get the current catalog version
const route = useRoute()
const selectedCatalogVersion = ref(await getCatalogVersion($directus, $readItems, route))

// Published municipalities from the layout \u2014 used to gate slug-based navigation
const { data: publishedMunicipalities } = useNuxtData('municipalities')
const publishedSlugs = computed(() => new Set((publishedMunicipalities.value ?? []).map(m => m.slug)))

const props = defineProps({
  basePath: {
    type: String,
    required: true,
  },
  // 'ars'  (default) → navigates to `${basePath}/${area.ars}` (used by /stats pages)
  // 'slug' → navigates to `/municipalities/${slug}` for rated areas (used by hero search)
  linkMode: {
    type: String,
    default: 'ars',
  },
})

const dropdown = ref(null)
const radioGroup = ref(null)
const inputRef = ref(null)
const q = ref('')
const searchFocused = ref(false)
const focusedIndex = ref(-1)
const filterType = ref('reasonable')
const router = useRouter()

// Dynamic dropdown positioning
const dropdownPosition = ref({ top: 0, left: 0, width: 0, show: false })

// Mode derived from filter toggle
const modeForSearch = computed(() => filterType.value === 'all' ? 'all' : 'reasonable')
const catalogVersionName = computed(() => selectedCatalogVersion.value?.name ?? null)

const { results: rawResults, isLoading, search, clear } = useAreaSearch({
  mode: modeForSearch,
  publishedSlugs,
  catalogVersionName,
})

/** Compute navigation URL for a result based on linkMode and basePath */
function getResultUrl(result) {
  if (result.isMunicipality) {
    if (props.linkMode === 'slug' && result.ctaType === 'complete' && result._slug) {
      return `/municipalities/${result._slug}`
    }
    return `${props.basePath}/${result.ars}`
  }
  // Level 1-3: use basePath (e.g. /stats/{ars})
  return `${props.basePath}/${result.ars}`
}

const visibleSuggestions = computed(() =>
  rawResults.value.slice(0, 5).map(r => ({ ...r, url: getResultUrl(r) }))
)

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
    search(q.value)
  } else {
    clear()
  }
}

function calculateDropdownPosition() {
  if (!inputRef.value) return
  
  const inputRect = inputRef.value.getBoundingClientRect()
  dropdownPosition.value = {
    // The dropdown uses position:fixed, so coordinates are viewport-relative.
    // getBoundingClientRect() already returns viewport coordinates - do NOT add scrollY/scrollX.
    top: inputRect.bottom + 4,
    left: inputRect.left,
    width: inputRect.width,
    show: true
  }
}

function handleFocus() {
  searchFocused.value = true
  calculateDropdownPosition()
}

function goTo(url) {
  q.value = ''
  focusedIndex.value = -1
  searchFocused.value = false
  dropdownPosition.value.show = false
  router.push(url)
}

function moveFocus(direction) {
  const max = visibleSuggestions.value.length - 1
  focusedIndex.value = Math.min(max, Math.max(0, focusedIndex.value + direction))
}

function goToFocused() {
  const suggestion = visibleSuggestions.value[focusedIndex.value]
  if (suggestion && suggestion.url) goTo(suggestion.url)
}

function handleFilterChange() {
  if (q.value.trim()) search(q.value)
}

// Only watch document.activeElement on client side to avoid SSR issues
if (process.client) {
  watch(() => document.activeElement, (el) => {
    if (!el || el.id !== 'admin-search-input') {
      searchFocused.value = false
      dropdownPosition.value.show = false
    }
  })
}

function handleSuggestionClick() {
  q.value = ''
  searchFocused.value = false
  focusedIndex.value = -1
  dropdownPosition.value.show = false
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
    dropdownPosition.value.show = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>
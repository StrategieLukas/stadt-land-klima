<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-[10001] bg-black/50 flex items-start justify-center pt-12 px-4"
      @click.self="close"
    >
      <div
        class="bg-white w-full max-w-xl rounded-lg shadow-2xl overflow-hidden flex flex-col"
        style="max-height: 80vh"
        role="dialog"
        aria-modal="true"
        aria-label="Suche"
      >
        <!-- Input row -->
        <div class="flex items-center border-b border-gray-200 px-4 gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            ref="inputRef"
            v-model="query"
            class="flex-1 py-4 text-base outline-none placeholder-gray-400"
            :placeholder="tabs[activeTab].placeholder"
            @input="onQueryInput"
            @keydown.up.prevent="moveFocus(-1)"
            @keydown.down.prevent="moveFocus(1)"
            @keydown.enter.prevent="navigateToFocused"
            @keydown.escape="close"
          />
          <kbd class="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded hidden sm:block">ESC</kbd>
        </div>

        <!-- Tab bar -->
        <div class="flex border-b border-gray-100 overflow-x-auto">
          <button
            v-for="(tab, key) in tabs"
            :key="key"
            class="px-4 py-2.5 text-sm font-medium whitespace-nowrap flex-shrink-0 border-b-2 transition-colors"
            :class="activeTab === key
              ? 'border-light-green text-light-green'
              : 'border-transparent text-gray-500 hover:text-gray-700'"
            @click="switchTab(key)"
          >
            {{ tab.label }}
          </button>
        </div>

        <!-- Results -->
        <div class="overflow-y-auto flex-1">
          <!-- Loading -->
          <div v-if="isLoading" class="flex items-center justify-center py-10 text-gray-400 text-sm">
            <svg class="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24" fill="none">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            Suche...
          </div>

          <!-- No query yet -->
          <div v-else-if="!query.trim()" class="py-10 text-center text-gray-400 text-sm">
            {{ tabs[activeTab].hint }}
          </div>

          <!-- No results -->
          <div v-else-if="!results.length" class="py-10 text-center text-gray-400 text-sm">
            Keine Ergebnisse für „{{ query }}"
          </div>

          <!-- Results list -->
          <ul v-else>
            <li
              v-for="(result, i) in results"
              :key="result._key ?? i"
              class="flex items-start gap-3 px-4 py-3 cursor-pointer border-b border-gray-50 last:border-b-0 transition-colors"
              :class="focusedIndex === i ? 'bg-mild-white' : 'hover:bg-mild-white'"
              @click="navigate(result)"
              @mouseenter="focusedIndex = i"
            >
              <!-- Gemeinden result -->
              <template v-if="activeTab === 'municipalities'">
                <div class="flex-1 min-w-0">
                  <div class="text-xs font-medium uppercase text-gray-400">{{ result.prefix }}</div>
                  <div class="font-semibold text-gray-900">{{ result.name }}</div>
                </div>
                <span v-if="result.hasRating" class="text-xs bg-light-blue/20 text-light-blue px-2 py-0.5 rounded-full whitespace-nowrap self-center">
                  {{ result.scoreDisplay }}
                </span>
              </template>

              <!-- Seiten result -->
              <template v-else-if="activeTab === 'pages'">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <div class="flex-1 min-w-0">
                  <div class="font-semibold text-gray-900">{{ result.name }}</div>
                  <div class="text-xs text-gray-400">/{{ result.slug }}</div>
                </div>
              </template>

              <!-- Kalender result -->
              <template v-else-if="activeTab === 'events'">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <div class="flex-1 min-w-0">
                  <div class="font-semibold text-gray-900">{{ result.title }}</div>
                  <div class="text-xs text-gray-400">
                    {{ formatDate(result.start_date) }}
                    <span v-if="result.location"> · {{ result.location }}</span>
                  </div>
                </div>
                <span class="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full self-center whitespace-nowrap">
                  {{ eventTypeLabel(result.event_type) }}
                </span>
              </template>

              <!-- Themen result -->
              <template v-else-if="activeTab === 'concepts'">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <div class="flex-1 min-w-0">
                  <div class="font-semibold text-gray-900">{{ result.name }}</div>
                  <div v-if="result.sector" class="text-xs text-gray-400">{{ result.sector }}</div>
                </div>
              </template>
            </li>
          </ul>
        </div>

        <!-- Footer hint -->
        <div class="border-t border-gray-100 px-4 py-2 flex items-center gap-4 text-xs text-gray-400">
          <span><kbd class="bg-gray-100 px-1.5 py-0.5 rounded">↑↓</kbd> navigieren</span>
          <span><kbd class="bg-gray-100 px-1.5 py-0.5 rounded">↵</kbd> öffnen</span>
          <span><kbd class="bg-gray-100 px-1.5 py-0.5 rounded">ESC</kbd> schließen</span>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from '#imports'
import { useSearchPalette } from '~/composables/useSearchPalette.js'
import { useAdministrativeAreaSearch } from '~/composables/useAdministrativeAreaSearch.js'
import lodash from 'lodash'
const { debounce } = lodash

const { isOpen, close } = useSearchPalette()
const { $directus, $readItems } = useNuxtApp()
const router = useRouter()

const inputRef = ref(null)
const query = ref('')
const activeTab = ref('municipalities')
const results = ref([])
const isLoading = ref(false)
const focusedIndex = ref(-1)

const tabs = {
  municipalities: {
    label: 'Gemeinden',
    placeholder: 'Gemeinde oder Landkreis suchen...',
    hint: 'Tippen Sie einen Gemeindenamen ein.',
  },
  pages: {
    label: 'Seiten',
    placeholder: 'Seiteninhalt durchsuchen...',
    hint: 'Tippen Sie einen Suchbegriff ein.',
  },
  events: {
    label: 'Kalender',
    placeholder: 'Veranstaltungen suchen...',
    hint: 'Tippen Sie einen Suchbegriff ein.',
  },
  concepts: {
    label: 'Themen',
    placeholder: 'Maßnahmen und Themen suchen...',
    hint: 'Tippen Sie einen Suchbegriff ein.',
  },
}

// Administrative area search composable
const adminSearch = useAdministrativeAreaSearch()

// Watch open state → focus input
watch(isOpen, async (val) => {
  if (val) {
    query.value = ''
    results.value = []
    focusedIndex.value = -1
    await nextTick()
    inputRef.value?.focus()
  } else {
    adminSearch.clear()
  }
})

function switchTab(key) {
  activeTab.value = key
  focusedIndex.value = -1
  results.value = []
  if (query.value.trim()) {
    runSearch(query.value)
  }
}

function onQueryInput() {
  focusedIndex.value = -1
  debouncedSearch(query.value)
}

const debouncedSearch = debounce((q) => runSearch(q), 300)

async function runSearch(q) {
  if (!q.trim()) {
    results.value = []
    isLoading.value = false
    return
  }

  isLoading.value = true
  results.value = []

  try {
    if (activeTab.value === 'municipalities') {
      adminSearch.search(q)
      // Watch adminSearch.results reactively
      const stop = watch(adminSearch.results, (r) => {
        results.value = r.map(area => ({
          _key: area.ars,
          ...area,
          hasRating: !!(area.stadtlandklimaDataAll?.[0]?.slug),
          scoreDisplay: area.stadtlandklimaDataAll?.[0]?.scoreTotal
            ? `${Math.round(area.stadtlandklimaDataAll[0].scoreTotal * 10) / 10}%`
            : null,
        }))
        isLoading.value = adminSearch.isLoading.value
        stop()
      }, { immediate: true })
      // Also stop loading when adminSearch finishes
      watch(adminSearch.isLoading, (loading) => {
        isLoading.value = loading
      })
      return
    }

    if (activeTab.value === 'pages') {
      const data = await $directus.request($readItems('pages', {
        search: q,
        filter: { status: { _eq: 'published' } },
        fields: ['name', 'slug'],
        limit: 8,
      }))
      results.value = (data || []).map(r => ({ _key: r.slug, ...r }))
    }

    if (activeTab.value === 'events') {
      const data = await $directus.request($readItems('events', {
        search: q,
        filter: { status: { _eq: 'published' } },
        fields: ['id', 'title', 'slug', 'start_date', 'location', 'event_type'],
        limit: 8,
        sort: ['start_date'],
      }))
      results.value = (data || []).map(r => ({ _key: r.slug ?? r.id, ...r }))
    }

    if (activeTab.value === 'concepts') {
      const data = await $directus.request($readItems('measures', {
        search: q,
        fields: ['name', 'slug', 'sector'],
        limit: 8,
      }))
      results.value = (data || []).map(r => ({ _key: r.slug, ...r }))
    }
  } catch (e) {
    results.value = []
  } finally {
    if (activeTab.value !== 'municipalities') {
      isLoading.value = false
    }
  }
}

function navigate(result) {
  close()
  query.value = ''
  results.value = []

  if (activeTab.value === 'municipalities') {
    router.push(`/municipalities/${result.ars}`)
  } else if (activeTab.value === 'pages') {
    router.push(`/${result.slug}`)
  } else if (activeTab.value === 'events') {
    router.push(`/events/${result.slug}`)
  } else if (activeTab.value === 'concepts') {
    router.push(`/measures/${result.slug}`)
  }
}

function moveFocus(dir) {
  const max = results.value.length - 1
  if (max < 0) return
  focusedIndex.value = Math.min(max, Math.max(0, focusedIndex.value + dir))
}

function navigateToFocused() {
  if (focusedIndex.value >= 0 && results.value[focusedIndex.value]) {
    navigate(results.value[focusedIndex.value])
  }
}

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })
}

const eventTypeLabels = { conference: 'Konferenz', workshop: 'Workshop', webinar: 'Webinar', other: 'Sonstiges' }
function eventTypeLabel(type) {
  return eventTypeLabels[type] ?? type ?? ''
}

// Global Cmd+K / Ctrl+K shortcut
function handleKeydown(e) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault()
    isOpen.value = !isOpen.value
  }
}

onMounted(() => document.addEventListener('keydown', handleKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', handleKeydown))
</script>

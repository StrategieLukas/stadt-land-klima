<template>
  <Teleport to="body">
    <Transition name="palette-fade">
      <div
        v-if="isOpen"
        class="fixed inset-0 z-[10002]"
        @click.self="close"
      >
        <!-- Dark backdrop — starts below header in embedded mode so the white bar stays unobscured -->
        <div
          class="absolute inset-x-0 bottom-0 bg-black/50"
          :style="embeddedInput ? `top: ${headerHeight}px` : 'top: 0'"
          @click="close"
        />

        <!-- Panel: drops below header when embedded, centred floating otherwise -->
        <div
          class="absolute z-10"
          :style="embeddedInput && navInputRect.left !== null
            ? `left: ${navInputRect.left}px; width: ${navInputRect.width}px; top: ${headerHeight}px`
            : `left: 50%; transform: translateX(-50%); width: 100%; max-width: 36rem; padding: 0 1rem; top: 80px`"
        >
          <div
            class="bg-white overflow-hidden flex flex-col"
            :class="embeddedInput ? 'rounded-2xl border border-gray-200 shadow-xl' : 'rounded-2xl shadow-2xl'"
            style="max-height: 76vh"
            role="dialog"
            aria-modal="true"
            aria-label="Suche"
            @click.stop
          >
            <!-- Input row — hidden when the header's embedded input is active -->
            <div v-if="!embeddedInput" class="flex items-center border-b border-gray-200 px-4 gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
              <input
                ref="inputRef"
                v-model="query"
                class="flex-1 py-4 text-base outline-none placeholder-gray-400"
                placeholder="Gemeinde oder Inhalt suchen…"
                @keydown.up.prevent="moveFocus(-1)"
                @keydown.down.prevent="moveFocus(1)"
                @keydown.enter.prevent="navigateToFocused"
                @keydown.escape="close"
              />
              <kbd class="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded hidden sm:block">ESC</kbd>
              <button
                type="button"
                class="sm:hidden flex-shrink-0 p-1 text-gray-400 hover:text-gray-600"
                aria-label="Schließen"
                @click="close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <!-- Results -->
            <div class="overflow-y-auto flex-1">
              <!-- Loading -->
              <div v-if="isLoading" class="flex items-center justify-center gap-2 py-10 text-gray-400 text-sm">
                <SlkFlowerSpinner :size="20" />
                Suche...
              </div>

              <!-- No query yet -->
              <div v-else-if="!query.trim()" class="py-10 text-center text-gray-400 text-sm">
                Tippen Sie einen Suchbegriff ein.
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
                  <template v-if="result._type === 'municipality'">
                    <div class="flex-1 min-w-0">
                      <div class="text-xs font-medium uppercase text-gray-400">{{ result.prefix }}</div>
                      <div class="font-semibold text-gray-900 leading-tight">{{ result.name }}</div>
                    </div>
                    <!-- Published: show score -->
                    <span v-if="result.ctaType === 'complete'" class="text-xs px-2 py-0.5 rounded-full whitespace-nowrap self-center text-white" :class="`bg-${result.scoreTotalColorClass}`">
                      {{ result.scoreDisplay }}
                    </span>
                    <!-- Localteam active but not published -->
                    <span v-else-if="result.ctaType === 'in-progress'" class="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full whitespace-nowrap self-center">
                      Bewertung läuft
                    </span>
                  </template>

                  <!-- Inhalte result -->
                  <template v-else-if="result._type === 'content'">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                    </svg>
                    <div class="flex-1 min-w-0">
                      <!-- eslint-disable-next-line vue/no-v-html -->
                      <div class="font-semibold text-gray-900 leading-tight" v-html="result.title" />
                      <!-- eslint-disable-next-line vue/no-v-html -->
                      <div v-if="result.excerpt" class="text-xs text-gray-500 mt-0.5 line-clamp-2" v-html="result.excerpt" />
                    </div>
                    <span class="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full self-center whitespace-nowrap ml-2 flex-shrink-0 inline-flex items-center gap-1">
                      {{ contentTypeLabel(result.type) }}
                      <template v-if="result.meta">
                        <span class="text-gray-400">·</span>
                        <img
                          v-if="sectorImages[result.meta]"
                          :src="sectorImages[result.meta]"
                          :title="sectorLabels[result.meta] ?? result.meta"
                          class="h-8 w-8 flex-shrink-0 invert grayscale mix-blend-multiply"
                          :alt="sectorLabels[result.meta] ?? result.meta"
                        />
                        <span v-else>{{ result.meta }}</span>
                      </template>
                    </span>
                  </template>
                </li>
              </ul>
            </div>

            <!-- Footer hint -->
            <div class="border-t border-gray-100 px-4 py-2 flex items-center gap-4 text-xs text-gray-400">
              <span class="hidden sm:inline"><kbd class="bg-gray-100 px-1.5 py-0.5 rounded">↑↓</kbd> navigieren</span>
              <span class="hidden sm:inline"><kbd class="bg-gray-100 px-1.5 py-0.5 rounded">↵</kbd> öffnen</span>
              <span class="hidden sm:inline"><kbd class="bg-gray-100 px-1.5 py-0.5 rounded">ESC</kbd> schließen</span>
              <button
                type="button"
                class="sm:hidden ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded bg-gray-100 text-gray-600 text-xs font-medium hover:bg-gray-200"
                @click="close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Schließen
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, watch, watchEffect, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from '#imports'
import { useSearchPalette } from '~/composables/useSearchPalette.js'
import { useEmbeddedSearchBridge } from '~/composables/useEmbeddedSearchBridge.js'
import { useAdministrativeAreaSearch } from '~/composables/useAdministrativeAreaSearch.js'
import { useContentSearch } from '~/composables/useContentSearch.js'
import { useHeaderHeight } from '~/composables/useHeaderHeight.js'
import { useNavInputRect } from '~/composables/useHeaderHeight.js'
import { getScorePercentageColor } from '~/shared/utils.js'
import sectorImages from '~/shared/sectorImages.js'
import lodash from 'lodash'
const { debounce } = lodash

const { isOpen, query, embeddedInput, open, close } = useSearchPalette()
const bridge = useEmbeddedSearchBridge()
const router = useRouter()
const headerHeight = useHeaderHeight()
const navInputRect = useNavInputRect()

const inputRef = ref(null)
const results = ref([])
const isLoading = ref(false)
const focusedIndex = ref(-1)

// Published municipalities from the layout — used to gate slug-based navigation
const { data: publishedMunicipalities } = useNuxtData('municipalities')
const publishedSlugs = computed(() => new Set((publishedMunicipalities.value ?? []).map(m => m.slug)))

// Administrative area search composable
const adminSearch = useAdministrativeAreaSearch()
// Full-text content search composable (Meilisearch)
const contentSearch = useContentSearch()

// Register keyboard nav functions with the bridge so the header can call them
bridge.register(moveFocus, navigateToFocused)

// Merge both result sets reactively into a single list
watchEffect(() => {
  const muniResults = (adminSearch.results.value || []).map(area => {
    // Use the first entry that has a slug (= rated in any catalog version)
    const ratingData = area.stadtlandklimaDataAll?.find(d => d.slug)
    const isPublished = !!(ratingData?.slug && publishedSlugs.value.has(ratingData.slug))
    // 'complete'    → published
    // 'in-progress' → has a slug but not yet published
    // 'none'        → no slug at all
    const ctaType = isPublished ? 'complete' : ratingData?.slug ? 'in-progress' : 'none'
    return {
      _type: 'municipality',
      _key: area.ars,
      ...area,
      ctaType,
      hasRating: isPublished,
      _slug: isPublished ? ratingData.slug : null,
      scoreDisplay: isPublished && ratingData?.scoreTotal
        ? `${Math.round(Number(ratingData.scoreTotal) * 10) / 10}%`
        : null,
      scoreTotalColorClass: isPublished && ratingData?.scoreTotal
        ? getScorePercentageColor(parseFloat(ratingData.scoreTotal))
        : null,
    }
  })
  const contentResults = (contentSearch.results.value || []).map(h => ({
    _type: 'content',
    _key: h.id,
    ...h,
  }))
  results.value = [...muniResults, ...contentResults]
})

watchEffect(() => {
  isLoading.value = adminSearch.isLoading.value || contentSearch.isLoading.value
})

// Watch open state → focus input (only when not embedded — header owns focus then)
watch(isOpen, async (val) => {
  if (val) {
    focusedIndex.value = -1
    if (!embeddedInput.value) {
      await nextTick()
      inputRef.value?.focus()
    }
  } else {
    adminSearch.clear()
    contentSearch.clear()
  }
})

// Drive search from the shared query ref (works for both embedded and palette inputs)
const debouncedSearch = debounce((q) => runSearch(q), 300)
watch(query, (q) => {
  focusedIndex.value = -1
  debouncedSearch(q)
})

function runSearch(q) {
  if (!q.trim()) {
    adminSearch.clear()
    contentSearch.clear()
    return
  }
  adminSearch.search(q)
  contentSearch.search(q)
}

function navigate(result) {
  close()
  if (result._type === 'municipality') {
    // Only route to slug-based page for published municipalities.
    // Published slugs are loaded by the layout; anything else gets the ARS details page.
    const slug = result._slug && publishedSlugs.value.has(result._slug) ? result._slug : null
    router.push(slug ? `/municipalities/${slug}` : `/municipalities/${result.ars}`)
  } else if (result._type === 'content') {
    router.push(result.url)
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

const contentTypeLabels = { block: 'Block', page: 'Seite', event: 'Veranstaltung', article: 'Projekt', measure: 'Maßnahme', static_page: 'Seite', news_item: 'Neuigkeit' }
function contentTypeLabel(type) {
  return contentTypeLabels[type] ?? type ?? ''
}

const sectorLabels = {
  energy: 'Energie',
  transport: 'Verkehr',
  buildings: 'Gebäude & Wärme',
  industry: 'Industrie, Wirtschaft & Konsum',
  agriculture: 'Landwirtschaft, Natur & Ernährung',
  management: 'Klimaschutzmanagement & Verwaltung',
}

// Global Cmd+K / Ctrl+K shortcut + ESC to close from anywhere
function handleKeydown(e) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault()
    if (isOpen.value) { close() } else { open() }
  } else if (e.key === 'Escape' && isOpen.value) {
    close()
  }
}

onMounted(() => document.addEventListener('keydown', handleKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', handleKeydown))
</script>

<style scoped>
.palette-fade-enter-active,
.palette-fade-leave-active {
  transition: opacity 180ms ease;
}
.palette-fade-enter-from,
.palette-fade-leave-to {
  opacity: 0;
}
</style>

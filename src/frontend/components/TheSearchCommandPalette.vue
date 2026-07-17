<template>
  <Teleport to="body">
    <Transition name="palette-fade">
      <div v-if="isOpen" class="pointer-events-none fixed inset-0 z-[10004] font-sans">
        <!-- Dark backdrop — starts below header in embedded mode so the white bar stays unobscured -->
        <div
          class="slk-modal-backdrop pointer-events-auto absolute inset-x-0 bottom-0 bg-black/50"
          :style="embeddedInput ? `top: ${headerHeight}px` : 'top: 0'"
          @click="close"
        />

        <!-- Panel: drops below the header input when embedded, centred floating otherwise -->
        <div
          class="pointer-events-auto absolute z-10"
          :style="
            embeddedInput && navInputRect.left !== null && navInputRect.bottom !== null
              ? `left: ${navInputRect.left}px; width: ${navInputRect.width}px; top: ${navInputRect.bottom + 8}px`
              : `left: 50%; transform: translateX(-50%); width: 100%; max-width: 36rem; padding: 0 1rem; top: 80px`
          "
        >
          <div
            class="flex flex-col overflow-hidden bg-white"
            :class="embeddedInput ? 'border-gray-200 rounded-2xl border shadow-xl' : 'rounded-2xl shadow-2xl'"
            style="max-height: 76vh"
            role="dialog"
            aria-modal="true"
            :aria-label="$t('generic.search')"
            @click.stop
          >
            <!-- Input row — hidden when the header's embedded input is active -->
            <div v-if="!embeddedInput" class="border-gray-200 flex items-center gap-3 border-b px-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="text-gray-400 h-5 w-5 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
                />
              </svg>
              <input
                ref="inputRef"
                v-model="query"
                class="text-gray-900 placeholder-gray-400 flex-1 bg-white py-4 text-base outline-none"
                :placeholder="$t('search.palette.placeholder')"
                @keydown.up.prevent="moveFocus(-1)"
                @keydown.down.prevent="moveFocus(1)"
                @keydown.enter.prevent="navigateToFocused"
                @keydown.escape="close"
              />
              <kbd class="text-gray-400 bg-gray-100 hidden rounded px-2 py-1 text-xs sm:block">ESC</kbd>
              <button
                type="button"
                class="text-gray-400 hover:text-gray-600 flex-shrink-0 p-1 sm:hidden"
                :aria-label="$t('generic.close')"
                @click="close"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <!-- Results -->
            <div class="flex-1 overflow-y-auto">
              <!-- Loading -->
              <div v-if="isLoading" class="text-gray-400 flex items-center justify-center gap-2 py-10 text-sm">
                <SlkFlowerSpinner :size="20" />
                {{ $t("generic.search") }}
              </div>

              <!-- No query yet -->
              <div v-else-if="!query.trim()" class="text-gray-400 py-10 text-center text-sm">
                {{ $t("search.prompt") }}
              </div>

              <!-- No results -->
              <div v-else-if="!results.length" class="text-gray-400 py-10 text-center text-sm">
                {{ $t("search.no_results_for", { ":query": query }) }}
              </div>

              <!-- Results list -->
              <ul v-else>
                <li
                  v-for="(result, i) in results"
                  :key="result._key ?? i"
                  class="palette-result border-gray-50 cursor-pointer border-b px-4 py-3 transition-colors last:border-b-0"
                  :class="focusedIndex === i ? 'palette-result--focused' : ''"
                  @click="navigate(result)"
                  @mouseenter="focusedIndex = i"
                >
                  <!-- Administrative area result (municipalities + level 1-3 regions) -->
                  <template v-if="result._type === 'area'">
                    <AreaSearchResult :result="result" @chip-action="onChipAction" />
                  </template>

                  <!-- Inhalte result -->
                  <template v-else-if="result._type === 'content'">
                    <div class="flex w-full items-start gap-3">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="text-gray-400 mt-0.5 h-4 w-4 flex-shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
                        />
                      </svg>
                      <div class="min-w-0 flex-1">
                        <!-- eslint-disable-next-line vue/no-v-html -->
                        <div class="text-gray-900 font-semibold leading-tight" v-html="result.title" />
                        <!-- eslint-disable-next-line vue/no-v-html -->
                        <div
                          v-if="result.excerpt"
                          class="text-gray-500 mt-0.5 line-clamp-2 text-xs"
                          v-html="result.excerpt"
                        />
                      </div>
                      <span
                        class="bg-gray-100 text-gray-600 ml-2 inline-flex flex-shrink-0 items-center gap-1 self-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs"
                      >
                        {{ contentTypeLabel(result.type) }}
                        <template v-if="result.meta">
                          <span class="text-gray-400">·</span>
                          <img
                            v-if="sectorImages[result.meta]"
                            :src="sectorImages[result.meta]"
                            :title="sectorLabels[result.meta] ?? result.meta"
                            class="slk-filter-sector-icon h-8 w-8 flex-shrink-0 mix-blend-multiply grayscale invert"
                            :alt="sectorLabels[result.meta] ?? result.meta"
                          />
                          <span v-else>{{ result.meta }}</span>
                        </template>
                      </span>
                    </div>
                  </template>
                </li>
              </ul>
            </div>

            <!-- Footer hint -->
            <div class="border-gray-100 text-gray-400 flex items-center gap-4 border-t px-4 py-2 text-xs">
              <span class="hidden sm:inline"
                ><kbd class="bg-gray-100 rounded px-1.5 py-0.5">↑↓</kbd> {{ $t("search.hint.navigate") }}</span
              >
              <span class="hidden sm:inline"
                ><kbd class="bg-gray-100 rounded px-1.5 py-0.5">↵</kbd> {{ $t("search.hint.open") }}</span
              >
              <span class="hidden sm:inline"
                ><kbd class="bg-gray-100 rounded px-1.5 py-0.5">ESC</kbd> {{ $t("search.hint.close") }}</span
              >
              <button
                type="button"
                class="bg-gray-100 text-gray-600 hover:bg-gray-200 ml-auto flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium sm:hidden"
                @click="close"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2.5"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                {{ $t("generic.close") }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, watch, watchEffect, nextTick, onMounted, onBeforeUnmount } from "vue";
import { useRouter } from "#imports";
import { useSearchPalette } from "~/composables/useSearchPalette.js";
import { useEmbeddedSearchBridge } from "~/composables/useEmbeddedSearchBridge.js";
import { useAreaSearch } from "~/composables/useAreaSearch.js";
import { useContentSearch } from "~/composables/useContentSearch.js";
import { useHeaderHeight } from "~/composables/useHeaderHeight.js";
import { useNavInputRect } from "~/composables/useHeaderHeight.js";
import sectorImages from "~/shared/sectorImages.js";
import lodash from "lodash";
const { debounce } = lodash;
const { $t } = useNuxtApp();

const { isOpen, query, embeddedInput, open, close } = useSearchPalette();
const bridge = useEmbeddedSearchBridge();
const router = useRouter();
const { closeDrawer } = useDrawer();
const headerHeight = useHeaderHeight();
const navInputRect = useNavInputRect();

const inputRef = ref(null);
const results = ref([]);
const isLoading = ref(false);
const focusedIndex = ref(-1);

// Published municipalities from the layout — used to gate slug-based navigation
const { data: publishedMunicipalities } = useNuxtData("municipalities");
const publishedSlugs = computed(() => new Set((publishedMunicipalities.value ?? []).map((m) => m.slug)));

// Unified area search (level 1-3 + reasonable municipalities)
const adminSearch = useAreaSearch({ mode: "normal", publishedSlugs });
// Full-text content search composable (Meilisearch)
const contentSearch = useContentSearch();

// Register keyboard nav functions with the bridge so the header can call them
bridge.register(moveFocus, navigateToFocused);

// Merge area results (already enriched by useAreaSearch) with content results
watchEffect(() => {
  const areaResults = (adminSearch.results.value || []).map((area) => ({
    _type: "area",
    _key: area.ars,
    ...area,
  }));
  const contentResults = (contentSearch.results.value || []).map((h) => ({
    _type: "content",
    _key: h.id,
    ...h,
  }));
  results.value = [...areaResults, ...contentResults];
});

watchEffect(() => {
  isLoading.value = adminSearch.isLoading.value || contentSearch.isLoading.value;
});

// Watch open state → focus input (only when not embedded — header owns focus then)
watch(isOpen, async (val) => {
  if (val) {
    focusedIndex.value = -1;
    if (!embeddedInput.value) {
      await nextTick();
      inputRef.value?.focus();
    }
  } else {
    adminSearch.clear();
    contentSearch.clear();
  }
});

// Drive search from the shared query ref (works for both embedded and palette inputs)
const debouncedSearch = debounce((q) => runSearch(q), 300);
watch(query, (q) => {
  focusedIndex.value = -1;
  debouncedSearch(q);
});

function runSearch(q) {
  if (!q.trim()) {
    adminSearch.clear();
    contentSearch.clear();
    return;
  }
  adminSearch.search(q);
  contentSearch.search(q);
}

function navigate(result) {
  close();
  closeDrawer();
  if (result._type === "area") {
    if (result.isMunicipality) {
      // Use slug only for published municipalities (ctaType='complete')
      router.push(
        result.ctaType === "complete" && result._slug
          ? `/municipalities/${result._slug}`
          : `/municipalities/${result.ars}`,
      );
    } else {
      router.push(`/regions/${result.ars}`);
    }
  } else if (result._type === "content") {
    router.push(result.url);
  }
}

/** Called when a CTA chip inside AreaSearchResult is clicked */
function onChipAction({ ars }) {
  close();
  closeDrawer();
  router.push(`/register_localteam?ars=${ars}`);
}

function moveFocus(dir) {
  const max = results.value.length - 1;
  if (max < 0) return;
  focusedIndex.value = Math.min(max, Math.max(0, focusedIndex.value + dir));
}

function navigateToFocused() {
  if (focusedIndex.value >= 0 && results.value[focusedIndex.value]) {
    navigate(results.value[focusedIndex.value]);
  }
}

const contentTypeLabelKeys = {
  block: "content_type.block",
  page: "content_type.page",
  event: "content_type.event",
  article: "content_type.article",
  measure: "content_type.measure",
  static_page: "content_type.page",
  news_item: "content_type.news_item",
};
function contentTypeLabel(type) {
  return contentTypeLabelKeys[type] ? $t(contentTypeLabelKeys[type]) : (type ?? "");
}

const sectorLabels = {
  energy: $t("measure_sectors.energy.title"),
  transport: $t("measure_sectors.transport.title"),
  buildings: $t("measure_sectors.buildings.title"),
  industry: $t("measure_sectors.industry.title"),
  agriculture: $t("measure_sectors.agriculture.title"),
  management: $t("measure_sectors.management.title"),
};

// Global Cmd+K / Ctrl+K shortcut — always route to the embedded header search
// (falls back to opening standalone palette when no header input is registered, e.g. mobile)
function handleKeydown(e) {
  if ((e.metaKey || e.ctrlKey) && e.key === "k") {
    e.preventDefault();
    if (isOpen.value && !embeddedInput.value) {
      close();
      return;
    }
    if (bridge.hasHeaderInput) {
      bridge.focusHeaderInput();
    } else {
      if (isOpen.value) {
        close();
      } else {
        open();
      }
    }
  } else if (e.key === "Escape" && isOpen.value) {
    close();
  }
}

onMounted(() => document.addEventListener("keydown", handleKeydown));
onBeforeUnmount(() => document.removeEventListener("keydown", handleKeydown));
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
.palette-result:hover,
.palette-result--focused {
  background-color: var(--slk-surface-muted);
}
</style>

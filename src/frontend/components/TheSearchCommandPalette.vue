<template>
  <Teleport to="body">
    <Transition name="palette-fade">
      <div v-if="isOpen" class="pointer-events-none fixed inset-0 z-10004 font-sans">
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
            embeddedInput && navInputRect.left !== null
              ? `left: ${navInputRect.left}px; width: ${navInputRect.width}px; top: ${headerHeight + 8}px`
              : `left: 50%; transform: translateX(-50%); width: 100%; max-width: 36rem; padding: 0 1rem; top: 80px`
          "
        >
          <div
            class="palette-panel flex flex-col overflow-hidden"
            :class="embeddedInput ? 'rounded-2xl border border-gray-200 shadow-xl' : 'rounded-2xl shadow-2xl'"
            style="max-height: 76vh"
            role="dialog"
            aria-modal="true"
            :aria-label="$t('generic.search')"
            @click.stop
          >
            <!-- Input row — hidden when the header's embedded input is active -->
            <div v-if="!embeddedInput" class="palette-input-row flex items-center gap-3 border-b px-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5 shrink-0 text-gray-400"
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
                class="flex-1 py-4 text-base placeholder-gray-400 outline-hidden"
                :placeholder="$t('search.palette.placeholder')"
                @keydown.up.prevent="moveFocus(-1)"
                @keydown.down.prevent="moveFocus(1)"
                @keydown.enter.prevent="navigateToFocused"
                @keydown.escape="close"
              />
              <kbd class="hidden rounded-sm bg-gray-100 px-2 py-1 text-xs text-gray-400 sm:block">ESC</kbd>
              <button
                type="button"
                class="shrink-0 p-1 text-gray-400 hover:text-gray-600 sm:hidden"
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
            <div class="palette-results-scroll flex-1 overflow-y-auto">
              <!-- Loading -->
              <div
                v-if="isLoading && !flatResults.length"
                class="flex items-center justify-center gap-2 py-10 text-sm text-gray-400"
              >
                <SlkFlowerSpinner :size="20" />
                {{ $t("generic.search") }}
              </div>

              <!-- No query yet -->
              <div v-else-if="!query.trim()" class="py-10 text-center text-sm text-gray-400">
                {{ $t("search.prompt") }}
              </div>

              <!-- No results -->
              <div v-else-if="!flatResults.length" class="py-10 text-center text-sm text-gray-400">
                {{ $t("search.no_results_for", { ":query": query }) }}
              </div>

              <!-- Results list with group headers -->
              <ul v-else>
                <template v-for="group in groupsWithIndex" :key="group.id">
                  <!-- Group header — only shown when the group has results -->
                  <li
                    v-if="group.results.length"
                    class="palette-group-header pointer-events-none sticky top-0 z-10 px-4 py-1.5 text-xs font-semibold tracking-wide uppercase select-none"
                  >
                    {{ group.label }}
                  </li>

                  <li
                    v-for="result in group.results"
                    :key="result._key ?? result._flatIndex"
                    class="palette-result cursor-pointer border-b px-4 py-3 transition-colors last:border-b-0"
                    :class="focusedIndex === result._flatIndex ? 'palette-result--focused' : ''"
                    @click="navigate(result)"
                    @mouseenter="focusedIndex = result._flatIndex"
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
                          class="mt-0.5 h-4 w-4 shrink-0 text-gray-400"
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
                          <div class="leading-tight font-semibold text-gray-900" v-html="sanitizeHtml(result.title)" />
                          <div
                            v-if="result.excerpt"
                            class="mt-0.5 line-clamp-2 text-xs text-gray-500"
                            v-html="sanitizeHtml(result.excerpt)"
                          />
                        </div>
                        <span
                          class="palette-content-badge ml-2 inline-flex shrink-0 items-center gap-1 self-center rounded-full bg-gray-100 px-2 py-0.5 text-xs whitespace-nowrap text-gray-600"
                        >
                          {{ contentTypeLabel(result.type) }}
                          <template v-if="result.meta">
                            <span class="text-gray-400">·</span>
                            <img
                              v-if="sectorImages[result.meta as keyof typeof sectorImages]"
                              :src="sectorImages[result.meta as keyof typeof sectorImages]"
                              :title="sectorLabels[result.meta] ?? result.meta"
                              class="palette-sector-icon h-8 w-8 shrink-0 mix-blend-multiply grayscale invert"
                              :alt="sectorLabels[result.meta] ?? result.meta"
                            />
                            <span v-else>{{ result.meta }}</span>
                          </template>
                        </span>
                      </div>
                    </template>
                  </li>
                </template>
              </ul>
            </div>

            <!-- Footer hint -->
            <div class="palette-footer flex items-center gap-4 border-t px-4 py-2 text-xs text-gray-400">
              <span class="hidden sm:inline"
                ><kbd class="rounded-sm bg-gray-100 px-1.5 py-0.5">↑↓</kbd> {{ $t("search.hint.navigate") }}</span
              >
              <span class="hidden sm:inline"
                ><kbd class="rounded-sm bg-gray-100 px-1.5 py-0.5">↵</kbd> {{ $t("search.hint.open") }}</span
              >
              <span class="hidden sm:inline"
                ><kbd class="rounded-sm bg-gray-100 px-1.5 py-0.5">ESC</kbd> {{ $t("search.hint.close") }}</span
              >
              <button
                type="button"
                class="ml-auto flex items-center gap-1.5 rounded-sm bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200 sm:hidden"
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

<script setup lang="ts">
import { sanitizeHtml } from "~/utils/sanitizeHtml";
import type { AreaChipAction } from "~/types/components/navigation";

import { ref, watch, watchEffect, nextTick, onMounted, onBeforeUnmount } from "vue";
import { useRouter } from "#imports";
import { useSearchPalette } from "~/composables/useSearchPalette";
import { useEmbeddedSearchBridge } from "~/composables/useEmbeddedSearchBridge";
import { useUnifiedSearch } from "~/composables/useUnifiedSearch";
import { getCurrentFrontendCatalogVersion } from "~/composables/getCatalogVersion";
import { useHeaderHeight, useNavInputRect } from "~/composables/useHeaderHeight";
import sectorImages from "~/shared/sectorImages";

const { $t } = useNuxtApp();
const { isOpen, query, embeddedInput, open, close } = useSearchPalette();
const bridge = useEmbeddedSearchBridge();
const router = useRouter();
const { closeDrawer } = useDrawer();
const headerHeight = useHeaderHeight();
const navInputRect = useNavInputRect();

const inputRef = ref<HTMLInputElement | null>(null);
const isLoading = ref(false);
const focusedIndex = ref(-1);

// Current frontend catalog version — used to distinguish outdated vs current ratings

const { data: currentCatalog } = useAsyncData("current-frontend-catalog", () =>
  getCurrentFrontendCatalogVersion().catch(() => null),
);
const catalogVersionName = computed(() => currentCatalog.value?.name ?? null);

// Unified search: Directus municipalities + StadtLandZahl areas + Meilisearch content
const unifiedSearch = useUnifiedSearch({ catalogVersionName });
const { groupsWithIndex, flatResults } = unifiedSearch;

// Register keyboard nav functions with the bridge so the header can call them
bridge.register(moveFocus, navigateToFocused);

watchEffect(() => {
  isLoading.value = unifiedSearch.isLoading.value;
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
    unifiedSearch.clear();
  }
});

// Drive search from the shared query ref (works for both embedded and palette inputs)
watch(query, (q) => {
  focusedIndex.value = -1;
  runSearch(q);
});

function runSearch(q: string) {
  if (!q.trim()) {
    unifiedSearch.clear();
    return;
  }
  unifiedSearch.search(q);
}

function navigate(result: (typeof flatResults.value)[number] | undefined) {
  if (!result) return;
  close();
  closeDrawer();
  if (result._type === "area") {
    if (result.isMunicipality) {
      if ((result.ctaType === "complete" || result.ctaType === "outdated") && result._slug) {
        const query =
          result.ctaType === "outdated" && result._oldCatalogName
            ? `?v=${encodeURIComponent(result._oldCatalogName)}`
            : "";
        void router.push(`/municipalities/${result._slug}${query}`);
      } else {
        void router.push(`/municipalities/${result.ars}`);
      }
    } else {
      void router.push(`/regions/${result.ars}`);
    }
  } else if (result._type === "content") {
    void router.push(result.url);
  }
}

/** Called when a CTA chip inside AreaSearchResult is clicked */
function onChipAction({ ars }: AreaChipAction) {
  close();
  closeDrawer();
  void router.push(`/register_localteam?ars=${ars}`);
}

function moveFocus(dir: number) {
  const max = flatResults.value.length - 1;
  if (max < 0) return;
  focusedIndex.value = Math.min(max, Math.max(0, focusedIndex.value + dir));
}

function navigateToFocused() {
  if (focusedIndex.value >= 0 && flatResults.value[focusedIndex.value]) {
    navigate(flatResults.value[focusedIndex.value]);
  }
}

const contentTypeKeys = [
  "block",
  "page",
  "event",
  "article",
  "measure",
  "static_page",
  "news_item",
  "member",
  "team",
] as const;
function contentTypeLabel(type: string) {
  if (!type) return "";
  const key = contentTypeKeys.find((key) => key === type);
  return key ? $t(`search.content_type.${key}`) : type;
}

const sectorLabels = Object.fromEntries(
  (["energy", "transport", "buildings", "industry", "agriculture", "management"] as const).map((sector) => [
    sector,
    $t(`measure_sectors.${sector}.title`),
  ]),
);

// Global Cmd+K / Ctrl+K shortcut — always route to the embedded header search
// (falls back to opening standalone palette when no header input is registered, e.g. mobile)
function handleKeydown(e: KeyboardEvent) {
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

onMounted(() => {
  document.addEventListener("keydown", handleKeydown);
});
onBeforeUnmount(() => {
  document.removeEventListener("keydown", handleKeydown);
});
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
.palette-panel {
  background-color: var(--slk-surface);
  border-color: var(--slk-border);
  color: var(--slk-text);
}
.palette-input-row,
.palette-footer,
.palette-result {
  border-color: var(--slk-border);
}
.palette-group-header {
  background-color: var(--slk-surface-subdued);
  border-bottom: 1px solid var(--slk-border);
  color: var(--slk-text-muted);
}
.palette-result:hover {
  background-color: var(--slk-surface-muted);
}
.palette-result--focused {
  background-color: var(--slk-blue-tint);
}
:global(html[data-theme="staedteChallengeDark"] .palette-content-badge) {
  background-color: var(--slk-surface-muted) !important;
  color: var(--slk-text-strong) !important;
}
:global(html[data-theme="staedteChallengeDark"] .palette-sector-icon) {
  filter: none;
  mix-blend-mode: screen;
}
.palette-results-scroll {
  scrollbar-width: none;
}
.palette-results-scroll::-webkit-scrollbar {
  display: none;
}
</style>

<template>
  <Teleport to="body">
    <!-- Keep the search tint below navigation dropdowns while their panels replace results. -->
    <Transition name="palette-fade">
      <div
        v-if="isOpen"
        class="slk-modal-backdrop fixed inset-x-0 bottom-0 bg-black/50"
        :class="embeddedInput ? 'z-10000' : 'z-10004'"
        :style="embeddedInput ? `top: ${headerHeight}px` : 'top: 0'"
        aria-hidden="true"
        @click="close"
      />
    </Transition>
    <Transition name="palette-fade">
      <div
        v-if="isOpen"
        v-show="isVisible"
        :inert="!isVisible"
        :aria-hidden="!isVisible"
        class="pointer-events-none fixed inset-0 z-10004 font-sans"
      >
        <!-- Panel: drops below the header input when embedded, centred floating otherwise -->
        <div
          class="palette-positioner pointer-events-auto absolute z-10"
          :style="
            embeddedInput && navInputRect.left !== null
              ? `left: ${navInputRect.left}px; width: ${navInputRect.width}px; top: ${headerHeight + 8}px`
              : `left: 50%; transform: translateX(-50%); width: 100%; max-width: 36rem; padding: 0 1rem; top: 80px`
          "
        >
          <div
            id="search-palette-panel"
            ref="panelRef"
            class="palette-panel flex flex-col overflow-hidden"
            :class="embeddedInput ? 'rounded-2xl border border-gray-200 shadow-xl' : 'rounded-2xl shadow-2xl'"
            style="max-height: 76vh"
            role="dialog"
            :aria-modal="!embeddedInput"
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
                :aria-label="$t('generic.search')"
                @keydown="onInputKeydown"
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
                    class="palette-result relative cursor-pointer border-b px-4 py-3 transition-colors last:border-b-0"
                    :class="focusedIndex === result._flatIndex ? 'palette-result--focused' : ''"
                    :data-search-result-index="result._flatIndex"
                    @mouseenter="selection.select(result)"
                  >
                    <!-- Administrative area result (municipalities + level 1-3 regions) -->
                    <template v-if="result._type === 'area'">
                      <AreaSearchResult
                        :result="result"
                        :href="resultUrl(result)"
                        @navigate="onResultClick"
                        @chip-action="onChipAction"
                      />
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
                        <NuxtLink
                          :to="result.url"
                          class="min-w-0 flex-1 after:absolute after:inset-0"
                          @click="onResultClick"
                        >
                          <div class="leading-tight font-semibold text-gray-900" v-html="sanitizeHtml(result.title)" />
                          <div
                            v-if="result.excerpt"
                            class="mt-0.5 line-clamp-2 text-xs text-gray-500"
                            v-html="sanitizeHtml(result.excerpt)"
                          />
                        </NuxtLink>
                        <span
                          class="slk-badge ml-2 inline-flex shrink-0 items-center gap-1 self-center rounded-full px-2 py-0.5 text-xs whitespace-nowrap"
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

import { ref, watch, nextTick, onMounted, onBeforeUnmount } from "vue";
import { useRouter } from "#imports";
import { useSearchPalette } from "~/composables/useSearchPalette";
import { useEmbeddedSearchBridge } from "~/composables/useEmbeddedSearchBridge";
import { useSearchSelection } from "~/composables/useSearchSelection";
import { useUnifiedSearch } from "~/composables/useUnifiedSearch";
import { getCurrentFrontendCatalogVersion } from "~/composables/getCatalogVersion";
import { useHeaderHeight, useNavInputRect } from "~/composables/useHeaderHeight";
import sectorImages from "~/shared/sectorImages";

const { $t } = useNuxtApp();
const { isOpen, isVisible, query, embeddedInput, navigationDropdownOpen, open, close, clearQuery } = useSearchPalette();
const bridge = useEmbeddedSearchBridge();
const router = useRouter();
const { closeDrawer } = useDrawer();
const headerHeight = useHeaderHeight();
const navInputRect = useNavInputRect();

const inputRef = ref<HTMLInputElement | null>(null);
const panelRef = ref<HTMLElement | null>(null);
let opener: HTMLElement | null = null;

// Current frontend catalog version — used to distinguish outdated vs current ratings

const { data: currentCatalog } = useAsyncData("current-frontend-catalog", () =>
  getCurrentFrontendCatalogVersion().catch(() => null),
);
const catalogVersionName = computed(() => currentCatalog.value?.name ?? null);

// Unified search: Directus municipalities + StadtLandZahl areas + Meilisearch content
const unifiedSearch = useUnifiedSearch({ catalogVersionName });
const { groupsWithIndex, flatResults } = unifiedSearch;

const isLoading = unifiedSearch.isLoading;
const selection = useSearchSelection(flatResults, (result) => `${result._type}:${result._key}`);
const focusedIndex = selection.index;
const unregisterNavigation = bridge.register(moveFocus, navigateToFocused);

watch(
  [isOpen, query],
  ([open, term]) => {
    selection.clear();
    if (open && term.trim()) unifiedSearch.search(term);
    else unifiedSearch.clear();
  },
  { flush: "sync", immediate: true },
);

watch(
  [isOpen, embeddedInput],
  async ([open, embedded], [wasOpen]) => {
    if (open) {
      if (!wasOpen) opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      await nextTick();
      if (isOpen.value && !embeddedInput.value && !embedded) inputRef.value?.focus();
    } else if (!embedded && opener?.isConnected) {
      opener.focus();
    }
  },
  { flush: "post" },
);

// Header registration changes after hydration and on either side of the mobile breakpoint.
watch(
  () => bridge.hasHeaderInput,
  async (available) => {
    if (!isOpen.value) return;
    await nextTick();
    if (!isOpen.value) return;
    if (available && bridge.focusHeaderInput()) return;
    open();
    await nextTick();
    inputRef.value?.focus();
  },
);

watch(focusedIndex, async (index) => {
  if (index < 0) return;
  await nextTick();
  panelRef.value?.querySelector(`[data-search-result-index="${index}"]`)?.scrollIntoView({ block: "nearest" });
});

function finishSelection() {
  clearQuery();
  close();
  closeDrawer();
}

function onResultClick(event: MouseEvent) {
  if (!isVisible.value) {
    event.preventDefault();
    return;
  }
  if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) finishSelection();
}

function resultUrl(result: (typeof flatResults.value)[number]) {
  if (result._type === "content") return result.url;
  if (result.areaKind === "administrative-area") return `/data/${encodeURIComponent(result.ars)}`;
  if (!result.isMunicipality) return `/regions/${result.ars}`;
  if ((result.ctaType === "complete" || result.ctaType === "outdated") && result._slug) {
    const query =
      result.ctaType === "outdated" && result._oldCatalogName ? `?v=${encodeURIComponent(result._oldCatalogName)}` : "";
    return `/municipalities/${result._slug}${query}`;
  }
  return `/municipalities/${result.ars}`;
}

function navigate(result: (typeof flatResults.value)[number] | undefined) {
  if (!isVisible.value || !result) return;
  const url = resultUrl(result);
  finishSelection();
  void router.push(url);
}

/** Called when a CTA chip inside AreaSearchResult is clicked */
function onChipAction({ action, ars, result }: AreaChipAction) {
  if (!isVisible.value) return;
  finishSelection();
  if (action === "gruenden") {
    void router.push({ path: "/register_localteam", query: { ars, name: result.name } });
    return;
  }
  const name = { ":name": result.name };
  void router.push({
    path: "/contact",
    query: {
      type: "cooperation",
      title: $t(action === "update" ? "search.rating.update_contact_title" : "localteam.contact_title", name),
      content: $t(action === "update" ? "search.rating.update_contact_content" : "localteam.contact_content", name),
    },
  });
}

function moveFocus(dir: number) {
  if (isVisible.value) selection.move(dir);
}

function navigateToFocused() {
  if (isVisible.value) navigate(selection.selected.value);
}

function onInputKeydown(event: KeyboardEvent) {
  if (event.isComposing) return;
  if (["ArrowUp", "ArrowDown", "Enter"].includes(event.key)) {
    event.preventDefault();
    if (event.key === "Enter") navigateToFocused();
    else moveFocus(event.key === "ArrowDown" ? 1 : -1);
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
  "job",
  "climate_tool",
  "event_series",
  "tour",
  "tour_stop",
  "election",
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
  if (e.isComposing) return;
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    if (isOpen.value && !embeddedInput.value) close();
    else if (!bridge.focusHeaderInput()) open();
  } else if (e.key === "Escape" && isOpen.value) {
    if (navigationDropdownOpen.value) navigationDropdownOpen.value = false;
    else close();
  } else if (e.key === "Tab" && isOpen.value && !embeddedInput.value) {
    const controls = Array.from(
      panelRef.value?.querySelectorAll<HTMLElement>('input, button, a[href], [tabindex="0"]') ?? [],
    ).filter((element) => element.checkVisibility() && !element.hasAttribute("disabled"));
    const first = controls[0];
    const last = controls.at(-1);
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first?.focus();
    }
  }
}

function handleFocusOutside(event: FocusEvent) {
  if (!isOpen.value) return;
  if (!(event.target instanceof Element) || panelRef.value?.contains(event.target)) return;
  if (!embeddedInput.value) {
    inputRef.value?.focus();
    return;
  }
  if (!event.target.closest("[data-search-header], [data-nav-trigger], .navigation-panel")) close();
}

watch(
  () => router.currentRoute.value.fullPath,
  () => {
    close();
  },
);

onMounted(() => {
  document.addEventListener("keydown", handleKeydown);
  document.addEventListener("focusin", handleFocusOutside);
});
onBeforeUnmount(() => {
  document.removeEventListener("keydown", handleKeydown);
  document.removeEventListener("focusin", handleFocusOutside);
  unregisterNavigation();
  unifiedSearch.clear();
});
</script>

<style scoped>
.palette-fade-enter-active,
.palette-fade-leave-active {
  transition: opacity 160ms ease;
}
.palette-fade-enter-from,
.palette-fade-leave-to {
  opacity: 0;
}
.palette-positioner {
  transition:
    left 220ms cubic-bezier(0.22, 1, 0.36, 1),
    top 220ms cubic-bezier(0.22, 1, 0.36, 1),
    width 220ms cubic-bezier(0.22, 1, 0.36, 1);
}
.palette-panel {
  transform-origin: top center;
  transition: transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
}
.palette-fade-enter-from .palette-panel,
.palette-fade-leave-to .palette-panel {
  transform: translateY(-6px) scale(0.98);
}
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    transition: none !important;
  }
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
.palette-result:hover,
.palette-result:focus-within {
  background-color: var(--slk-surface-muted);
}
.palette-result--focused {
  background-color: var(--slk-blue-tint);
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

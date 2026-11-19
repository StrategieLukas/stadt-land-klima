<template>
  <!-- Search Bar: stacked on mobile (filter below), side-by-side on sm+ (filter right) -->
  <div ref="searchRoot" class="flex w-full flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-3">
    <!-- Input + label -->
    <form class="relative min-w-0 flex-1 overflow-visible" @submit.prevent>
      <div class="flex w-full flex-col">
        <label :for="inputId" :class="compact ? 'sr-only' : 'flex items-center justify-between px-1 py-2'">{{
          translatedLabel
        }}</label>
        <input
          :id="inputId"
          ref="inputRef"
          v-model="q"
          data-area-search-input
          :aria-controls="resultsId"
          :aria-expanded="dropdownOpen"
          aria-haspopup="dialog"
          class="input w-full border-stats-dark bg-white pr-12 text-base focus:border-stats-dark focus:ring-1 focus:ring-stats-dark"
          name="q"
          type="text"
          autocomplete="off"
          :placeholder="translatedPlaceholder"
          @input="onInput"
          @focus="handleFocus"
          @click="handleFocus"
          @keydown="handleKeydown"
        />
      </div>

      <!-- Escape page stacking contexts while staying below the fixed header (z-50). -->
      <Teleport to="body">
        <div
          v-if="dropdownOpen"
          :id="resultsId"
          ref="dropdown"
          role="dialog"
          :aria-label="translatedLabel"
          class="slk-area-search-dropdown fixed z-40 max-h-60 overflow-y-auto rounded-md border border-gray-200 bg-white font-sans shadow-lg"
          :style="{
            top: dropdownPosition.top + 'px',
            left: dropdownPosition.left + 'px',
            width: dropdownPosition.width + 'px',
          }"
        >
          <div v-if="isLoading">
            <div class="px-4 py-3 text-sm text-gray-500 italic">
              {{ $t("generic.loading") }}
            </div>
          </div>

          <!-- No results message -->
          <div v-else-if="searchFocused && q.trim() && !isLoading && !visibleSuggestions.length" class="px-4 py-3">
            <div class="text-sm text-gray-500 italic">
              {{ $t("administrative_areas.search.no_results") }}
            </div>
          </div>

          <!-- Search results -->
          <div v-else>
            <component
              :is="props.routeBuilder ? 'button' : NuxtLink"
              v-for="(suggestion, index) in visibleSuggestions"
              :key="suggestion.ars"
              :type="props.routeBuilder ? 'button' : undefined"
              :to="props.routeBuilder ? undefined : suggestion.url"
              class="slk-area-search-result block w-full cursor-pointer border-b border-gray-100 px-3 py-3 text-left last:border-b-0 sm:px-4"
              :class="{
                'slk-area-search-result--focused': index === focusedIndex,
                'cursor-default opacity-60': !props.routeBuilder && !suggestion.url,
              }"
              @click="selectSuggestion($event, suggestion)"
              @focus="focusedIndex = index"
            >
              <div class="flex items-start justify-between gap-2 sm:items-center">
                <div class="min-w-0 flex-1">
                  <div class="truncate text-xs font-medium text-gray-500 uppercase">
                    {{ suggestion.prefix }}
                  </div>
                  <div class="text-sm font-semibold wrap-break-word text-gray-900 sm:text-base">
                    {{ suggestion.name }}
                  </div>
                </div>
                <div class="flex shrink-0 flex-col items-end space-y-1">
                  <!-- Published: score -->
                  <div v-if="suggestion.ctaType === 'complete'" class="flex flex-col gap-1 sm:flex-row sm:gap-2">
                    <span
                      class="slk-rating-chip inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap"
                      :class="`bg-${suggestion.scoreTotalColorClass}`"
                    >
                      {{ suggestion.scoreDisplay }}
                    </span>
                  </div>
                  <!-- Localteam active, rating in progress -->
                  <div
                    v-else-if="suggestion.ctaType === 'in-progress'"
                    class="slk-badge slk-badge--warning inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap"
                  >
                    {{ $t("rating.in_progress") }}
                  </div>
                  <!-- No localteam yet -->
                  <div
                    v-else
                    class="slk-badge inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap"
                  >
                    {{ $t("administrative_areas.not_rated_yet") }}
                  </div>
                </div>
              </div>
            </component>
          </div>
        </div>
      </Teleport>
    </form>

    <!-- Filter tabs: horizontal row on mobile, vertical column on sm+ -->
    <div
      v-if="showFilterToggle"
      ref="radioGroup"
      class="slk-area-search-tabs flex w-full shrink-0 flex-row overflow-hidden rounded-sm border text-xs font-semibold sm:w-auto sm:flex-col sm:self-end"
    >
      <button
        class="slk-area-search-tab flex-1 border-r px-3 py-2 leading-tight transition-colors sm:flex-none sm:border-r-0 sm:border-b"
        :class="{ 'slk-area-search-tab--active': filterType === 'reasonable' }"
        @click="
          filterType = 'reasonable';
          handleFilterChange();
        "
      >
        {{ $t("administrative_areas.search.reasonable_rate_able_municipalities") }}
      </button>
      <button
        class="slk-area-search-tab flex-1 px-3 py-2 leading-tight transition-colors sm:flex-none"
        :class="{ 'slk-area-search-tab--active': filterType === 'all' }"
        @click="
          filterType = 'all';
          handleFilterChange();
        "
      >
        {{ $t("all_administrative_areas") }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AreaResult, AreaRouteBuilder } from "~/types/components/navigation";
import type { RouteLocationRaw } from "vue-router";

import type { PropType } from "vue";

import { computed, ref, useId, nextTick, onMounted, onBeforeUnmount } from "vue";
import { NuxtLink } from "#components";
import { useRoute, useRouter } from "vue-router";
import { useAreaSearch } from "~/composables/useAreaSearch";
import { getCatalogVersion } from "~/composables/getCatalogVersion";

const { $t } = useNuxtApp();

// Get the current catalog version — wrapped in try/catch so a Directus failure
// (e.g. CLIENT_DIRECTUS_URL unreachable from mobile) does not crash component setup.
const route = useRoute();
defineExpose({ focus: () => inputRef.value?.focus() });
let selectedCatalogVersion: import("vue").Ref<Awaited<ReturnType<typeof getCatalogVersion>> | null>;
try {
  selectedCatalogVersion = ref(await getCatalogVersion(route));
} catch {
  selectedCatalogVersion = ref(null);
}

const props = defineProps({
  compact: { type: Boolean, default: false },
  placeholder: { type: String, default: undefined },
  basePath: {
    type: String as PropType<string | undefined>,
    default: "",
  },
  // 'ars'  (default) → navigates to `${basePath}/${area.ars}` (used by /stats pages)
  // 'slug' → navigates to `/municipalities/${slug}` for rated areas (used by hero search)
  linkMode: {
    type: String as PropType<"ars" | "slug" | undefined>,
    default: "ars",
  },
  // Controls whether the "reasonable municipalities to rate" filter is applied:
  // 'include' → always use reasonable mode, hide toggle
  // 'exclude' → always use all-areas mode, hide toggle
  // 'switch'  → show toggle so user can switch (default)
  reasonableMunipsToRate: {
    type: String as PropType<"include" | "exclude" | "switch" | undefined>,
    default: "switch",
  },
  // Optional callback: (area) => route | null
  // When provided, called on selection. Return a route string/object to navigate,
  // or null/undefined to skip navigation (caller handles side effects in the callback).
  routeBuilder: {
    type: Function as PropType<AreaRouteBuilder | null | undefined>,
    default: null,
  },
});

const inputId = useId();
const resultsId = useId();
const searchRoot = ref<HTMLElement | null>(null);
const dropdown = ref<HTMLElement | null>(null);
const radioGroup = ref<HTMLElement | null>(null);
const inputRef = ref<HTMLInputElement | null>(null);
const q = ref("");
const searchFocused = ref(false);
const focusedIndex = ref(-1);
const filterType = ref(props.reasonableMunipsToRate === "exclude" ? "all" : "reasonable");
const router = useRouter();

const showFilterToggle = computed(() => props.reasonableMunipsToRate === "switch");

// Dynamic dropdown positioning
const dropdownPosition = ref({ top: 0, left: 0, width: 0, show: false });

// Mode derived from filter toggle
const modeForSearch = computed(() => (filterType.value === "all" ? "all" : "reasonable"));
const catalogVersionName = computed(() => selectedCatalogVersion.value?.name ?? null);

const {
  results: rawResults,
  isLoading,
  search,
  clear,
} = useAreaSearch({
  mode: modeForSearch,
  catalogVersionName,
  statusCatalogVersionId: computed(() => selectedCatalogVersion.value?.id ?? null),
});

/** Compute navigation URL for a result based on linkMode and basePath */
function getResultUrl(result: AreaResult) {
  if (result.isMunicipality) {
    if (props.linkMode === "slug" && result.ctaType === "complete" && result._slug) {
      const catalogName = selectedCatalogVersion.value?.name;
      return `/municipalities/${result._slug}${catalogName ? `?v=${encodeURIComponent(catalogName)}` : ""}`;
    }
    return `${props.basePath}/${result.ars}`;
  }
  // Level 1-3: use basePath (e.g. /stats/{ars})
  return `${props.basePath}/${result.ars}`;
}

const visibleSuggestions = computed(() => rawResults.value.slice(0, 5).map((r) => ({ ...r, url: getResultUrl(r) })));

const dropdownOpen = computed(
  () =>
    searchFocused.value &&
    dropdownPosition.value.show &&
    (visibleSuggestions.value.length > 0 || isLoading.value || q.value.trim().length > 0),
);

// Show different placeholder and label depending on the optoin selected
const translatedLabel = computed(() =>
  filterType.value === "reasonable"
    ? $t("administrative_areas.search.reasonable_municipality.label")
    : $t("administrative_areas.search.all_administrative_areas.label"),
);

const translatedPlaceholder = computed(
  () =>
    props.placeholder ||
    (filterType.value === "reasonable"
      ? $t("administrative_areas.search.reasonable_municipality.placeholder")
      : $t("administrative_areas.search.all_administrative_areas.placeholder")),
);

function onInput() {
  searchFocused.value = true;
  calculateDropdownPosition();
  focusedIndex.value = -1;
  if (q.value.trim()) {
    search(q.value);
  } else {
    clear();
  }
}

function calculateDropdownPosition() {
  if (!inputRef.value || !searchFocused.value) return;

  const inputRect = inputRef.value.getBoundingClientRect();
  dropdownPosition.value = {
    // The dropdown uses position:fixed, so coordinates are viewport-relative.
    // getBoundingClientRect() already returns viewport coordinates - do NOT add scrollY/scrollX.
    top: inputRect.bottom + 4,
    left: inputRect.left,
    width: inputRect.width,
    show: true,
  };
}

function handleFocus() {
  const reopening = !searchFocused.value;
  searchFocused.value = true;
  calculateDropdownPosition();
  if (reopening && q.value.trim()) search(q.value);
}

function dismiss() {
  searchFocused.value = false;
  focusedIndex.value = -1;
  dropdownPosition.value.show = false;
  clear();
}

function handleKeydown(event: KeyboardEvent) {
  if (event.isComposing) return;
  if (event.key === "Escape") {
    event.stopPropagation();
    dismiss();
  } else if (["ArrowDown", "ArrowUp", "Enter"].includes(event.key)) {
    event.preventDefault();
    if (event.key === "Enter") goToFocused();
    else moveFocus(event.key === "ArrowDown" ? 1 : -1);
  }
}

function selectSuggestion(event: MouseEvent, suggestion: (typeof visibleSuggestions.value)[number]) {
  if (!searchFocused.value || isLoading.value) {
    event.preventDefault();
    return;
  }
  if (event.button || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
  event.preventDefault();
  goTo(suggestion.url, suggestion);
}

function goTo(url: RouteLocationRaw | null | undefined, area: AreaResult | null = null) {
  if (!searchFocused.value || isLoading.value) return;
  q.value = "";
  dismiss();
  if (props.routeBuilder && area) {
    const target = props.routeBuilder(area);
    if (target != null) if (target) void router.push(target);
  } else {
    if (url) void router.push(url);
  }
}

function moveFocus(direction: number) {
  if (!searchFocused.value || isLoading.value) return;
  const max = visibleSuggestions.value.length - 1;
  focusedIndex.value = Math.min(max, Math.max(0, focusedIndex.value + direction));
  void nextTick(() =>
    dropdown.value?.querySelector(".slk-area-search-result--focused")?.scrollIntoView({ block: "nearest" }),
  );
}

function goToFocused() {
  if (!searchFocused.value || isLoading.value) return;
  const suggestion = visibleSuggestions.value[focusedIndex.value];
  if (!suggestion) return;
  if (props.routeBuilder || suggestion.url) goTo(suggestion.url, suggestion);
}

function handleFilterChange() {
  focusedIndex.value = -1;
  searchFocused.value = true;
  calculateDropdownPosition();
  if (q.value.trim()) search(q.value);
  else clear();
}

// Close dropdown when iOS virtual keyboard is dismissed (visual viewport grows back).
// We track the last known keyboard height; if the viewport grows, the keyboard closed.
let _lastVVHeight = 0;
function onVisualViewportResize() {
  const vv = window.visualViewport;
  if (!vv) return;
  if (vv.height > _lastVVHeight + 100) {
    // Keyboard closed — close the dropdown if the input is no longer focused
    if (!containsTarget(document.activeElement)) dismiss();
  }
  _lastVVHeight = vv.height;
  // Also keep the dropdown position in sync with the visual viewport
  calculateDropdownPosition();
}

function containsTarget(target: EventTarget | null) {
  return target instanceof Node && (searchRoot.value?.contains(target) || dropdown.value?.contains(target));
}

function handleOutside(event: Event) {
  if (!containsTarget(event.target)) dismiss();
}

onMounted(() => {
  document.addEventListener("pointerdown", handleOutside);
  document.addEventListener("focusin", handleOutside);
  window.addEventListener("blur", dismiss);
  window.addEventListener("scroll", calculateDropdownPosition, true);
  window.addEventListener("resize", calculateDropdownPosition);
  window.visualViewport?.addEventListener("resize", onVisualViewportResize);
  window.visualViewport?.addEventListener("scroll", calculateDropdownPosition);
  _lastVVHeight = window.visualViewport?.height ?? window.innerHeight;
});

onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", handleOutside);
  document.removeEventListener("focusin", handleOutside);
  window.removeEventListener("blur", dismiss);
  window.removeEventListener("scroll", calculateDropdownPosition, true);
  clear();
  window.removeEventListener("resize", calculateDropdownPosition);
  window.visualViewport?.removeEventListener("resize", onVisualViewportResize);
  window.visualViewport?.removeEventListener("scroll", calculateDropdownPosition);
});
</script>

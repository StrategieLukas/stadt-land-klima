<template>
  <div :id="'block-' + uuid" class="blokkli-block-projects-carousel bg-localzero-yellow">
    <!-- Section header -->
    <div class="px-6 pt-10 pb-6">
      <p
        v-blokkli-editable:label
        class="mb-3 text-xs font-semibold tracking-widest uppercase"
        v-text="props.label || 'Erfolgsprojekte'"
      />
      <h2
        v-blokkli-editable:heading
        class="text-3xl leading-tight font-bold md:text-5xl"
        v-text="props.heading || 'Überschrift'"
      />
    </div>

    <!-- Editor fallback -->
    <div v-if="isEditing" class="px-6 pb-10 text-sm text-solid-black-50 italic">
      [Projektkarussell – {{ projects?.length ?? 0 }} Einträge geladen]
    </div>

    <!-- Carousel track (only in preview/production) -->
    <template v-else>
      <!-- Full-bleed wrapper: breaks out of any container's max-width -->
      <div class="carousel-bleed">
        <div
          ref="scrollEl"
          class="scrollbar-hide snap-x snap-mandatory overflow-x-auto"
          :style="trackStyle"
          @scroll.passive="onScrollHandler"
        >
          <div class="flex gap-4" style="width: max-content">
            <!--
              Infinite loop: render [copy, real, copy] (3× the items).
              We start scrolled to the middle copy. When we drift into
              either clone zone we silently teleport back to the middle.
            -->
            <div
              v-for="(project, i) in infiniteItems"
              :key="i"
              class="shrink-0 snap-center"
              :style="{ width: slideWidthPx + 'px' }"
            >
              <div class="w-full overflow-hidden bg-gray-300" style="aspect-ratio: 4/3">
                <SmartImg
                  v-if="project.image?.id"
                  :asset-id="project.image.id"
                  :is-raster="isRasterImage(project.image.type)"
                  :width="600"
                  :height="450"
                  fit="cover"
                  img-class="object-cover w-full h-full"
                />
              </div>
              <p class="mt-2 text-sm leading-snug font-semibold">{{ project.title }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Navigation row: ← dots → (arrows always active — endless scroll) -->
      <div v-if="projects && projects.length > 1" class="mt-6 flex items-center justify-center gap-4 px-6">
        <button
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black text-white"
          :aria-label="$t('generic.back')"
          @click="scrollBy(-1)"
        >
          <Icon icon="mdi:arrow-left" class="h-5 w-5" />
        </button>

        <div class="flex flex-wrap items-center justify-center gap-1.5">
          <button
            v-for="(project, i) in projects"
            :key="i"
            class="rounded-full transition-all duration-200"
            :class="currentIndex === i ? 'h-3 w-3 bg-black' : 'h-2 w-2 bg-solid-black-40'"
            :aria-label="`Projekt ${i + 1}`"
            @click="scrollToIndex(i)"
          />
        </div>

        <button
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black text-white"
          aria-label="Weiter"
          @click="scrollBy(1)"
        >
          <Icon icon="mdi:arrow-right" class="h-5 w-5" />
        </button>
      </div>

      <!-- Active project description + link -->
      <div class="mt-4 px-6 pb-10">
        <!-- Fixed-height description area so the block doesn't resize when switching slides -->
        <div ref="descriptionRef" :style="{ minHeight: descriptionHeight + 'px' }">
          <div v-if="activeProject">
            <p class="font-bold">{{ activeProject.title }}</p>
            <p class="mt-1 text-sm leading-relaxed">{{ truncatedAbstract }}</p>
            <NuxtLink
              :to="`/projects/${activeProject.slug}`"
              class="mt-2 inline-block text-sm font-semibold underline underline-offset-2"
              >Mehr lesen…</NuxtLink
            >
          </div>
        </div>
        <NuxtLink
          to="/projects"
          class="mt-3 inline-flex shrink-0 items-center gap-1 text-sm font-semibold underline underline-offset-2"
          ><span v-blokkli-editable:linkText v-text="props.linkText || 'Alle Erfolgsprojekte ansehen'"
        /></NuxtLink>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { isRaster } from "~/shared/utils";

const isEditing = import.meta.blokkliEditing;

const { options, uuid } = defineBlokkli({
  bundle: "projects_carousel",
  propsFieldMapping: {
    label: { name: "label", type: "editable" },
    heading: { name: "heading", type: "editable" },
    linkText: { name: "linkText", type: "editable" },
  },
  options: {
    limit: {
      type: "radios",
      label: "Anzahl Projekte",
      default: "10",
      options: {
        "5": "5",
        "10": "10",
        "20": "20",
        "50": "50",
      },
    },
  },
  editor: {
    addBehaviour: "no-form",
    editTitle: () => "Projektkarussell",
    mockProps: () => {
      return { label: "Erfolgsprojekte", heading: "Von anderen Lernen/Kopieren erlaubt!" };
    },
  },
});

const props = defineProps<{
  label?: string | undefined;
  heading?: string | undefined;
  linkText?: string | undefined;
}>();

const { data: projects } = await useAsyncData(
  `projects-carousel-${uuid}`,
  async () => {
    try {
      const result = await $fetch("/api/public/articles");
      return result.articles.slice(0, parseInt(options.value.limit) || 10);
    } catch {
      return [];
    }
  },
  { watch: [() => options.value.limit] },
);

function isRasterImage(type?: string | null): boolean {
  return isRaster(type);
}

// ─── Infinite carousel ────────────────────────────────────────────────────────
//
// Strategy: render [copy_A, real_items, copy_B] (3× the list).
// On mount, jump (instant) to the start of real_items (= offset * step).
// After each scroll settles, if the raw index has drifted into copy_A or copy_B,
// silently teleport back to the equivalent position in real_items.
// From the user's perspective it never ends.

const scrollEl = ref<HTMLElement | null>(null);
const descriptionRef = ref<HTMLElement | null>(null);
const containerWidth = ref(0);
const currentIndex = ref(0); // logical index within the real list
const descriptionHeight = ref(0);

const GAP_PX = 16;

// Responsive slide count: fewer on small screens so each slide is readable
const slidesVisible = computed(() => {
  if (!containerWidth.value || containerWidth.value < 480) return 1.5;
  if (containerWidth.value < 768) return 2.5;
  return 3.3;
});

// Triple list for cloning
const infiniteItems = computed(() => {
  const items = projects.value || [];
  return [...items, ...items, ...items];
});

const realCount = computed(() => projects.value?.length ?? 0);

const slideWidthPx = computed(() => {
  if (!containerWidth.value) return 320;
  const n = slidesVisible.value;
  // Distribute container width across n visible slides, accounting for gaps
  return Math.round((containerWidth.value - GAP_PX * (n - 1)) / n);
});

// Padding so the first/last slides can snap-center:
// with this value, scrollLeft = i * getStep() exactly centers slide i.
const centeringPaddingPx = computed(() => {
  if (!containerWidth.value) return 24;
  return Math.round((containerWidth.value - slideWidthPx.value) / 2);
});

const trackStyle = computed(() => ({
  paddingLeft: `${centeringPaddingPx.value}px`,
  paddingRight: `${centeringPaddingPx.value}px`,
  boxSizing: "border-box" as const,
}));

const activeProject = computed(() => projects.value?.[currentIndex.value] ?? null);

const truncatedAbstract = computed(() => {
  const abstract = activeProject.value?.abstract || "";
  return abstract.length > 250 ? abstract.substring(0, 250) + "…" : abstract;
});

function getStep(): number {
  return slideWidthPx.value + GAP_PX;
}

function getRawIndex(): number {
  const el = scrollEl.value;
  if (!el) return realCount.value;
  return Math.round(el.scrollLeft / getStep());
}

// Update the logical dot indicator during scroll
function updateCurrentIndex() {
  const n = realCount.value;
  if (n === 0) return;
  const raw = getRawIndex();
  currentIndex.value = (((raw - n) % n) + n) % n;
}

// Guard against re-entrancy when we silently set scrollLeft
let isTeleporting = false;

function teleportIfNeeded() {
  const el = scrollEl.value;
  const n = realCount.value;
  if (!el || n === 0 || isTeleporting) return;
  const raw = getRawIndex();
  if (raw < n || raw >= 2 * n) {
    isTeleporting = true;
    // Map back into the middle copy
    const target = ((((raw % n) + n) % n) + n) * getStep();
    el.scrollLeft = target;
    requestAnimationFrame(() => {
      isTeleporting = false;
    });
  }
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function onScrollHandler() {
  if (isTeleporting) return;
  updateCurrentIndex();
  // Debounce-based teleport (fallback for browsers without scrollend)
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(teleportIfNeeded, 150);
}

function scrollBy(direction: 1 | -1) {
  const el = scrollEl.value;
  if (!el) return;
  el.scrollBy({ left: direction * getStep(), behavior: "smooth" });
}

function scrollToIndex(logicalIndex: number) {
  const el = scrollEl.value;
  if (!el) return;
  el.scrollTo({ left: (realCount.value + logicalIndex) * getStep(), behavior: "smooth" });
}

function updateContainerWidth() {
  const el = scrollEl.value;
  if (!el) return;
  containerWidth.value = el.clientWidth;
}

// Place scroll at the start of the middle (real) copy
function initScroll() {
  const el = scrollEl.value;
  if (!el || realCount.value === 0) return;
  el.scrollLeft = realCount.value * getStep();
  currentIndex.value = 0;
}

// Measure the tallest description across all projects so the block never
// resizes when the user flips between slides.
// Uses a temporary off-screen element so Vue's managed DOM is never touched.
function measureMaxDescriptionHeight() {
  const items = projects.value || [];
  if (!items.length || !descriptionRef.value) return;

  const probe = document.createElement("div");
  // Match the real container's width and styling but keep it invisible
  probe.style.cssText =
    "position:absolute;visibility:hidden;pointer-events:none;width:" + String(descriptionRef.value.offsetWidth) + "px";
  document.body.appendChild(probe);

  let maxH = 0;
  for (const project of items) {
    const abstract = project.abstract || "";
    const truncated = abstract.length > 250 ? abstract.substring(0, 250) + "\u2026" : abstract;
    probe.innerHTML =
      `<p class="font-bold">${project.title}</p>` +
      `<p class="text-sm mt-1 leading-relaxed">${truncated}</p>` +
      `<a class="inline-block mt-2 text-sm font-semibold">Mehr lesen\u2026</a>`;
    maxH = Math.max(maxH, probe.scrollHeight);
  }

  document.body.removeChild(probe);
  descriptionHeight.value = maxH;
}

let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  updateContainerWidth();
  void nextTick(() => {
    initScroll();
    measureMaxDescriptionHeight();
    const el = scrollEl.value;
    if (!el) return;
    // Native scrollend for clean teleporting (Chrome 114+, Firefox 109+)
    el.addEventListener("scrollend", teleportIfNeeded);
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        updateContainerWidth();
        void nextTick(() => {
          // Re-seat scroll position to current logical index after resize
          const scrollElVal = scrollEl.value;
          if (scrollElVal && realCount.value > 0) {
            scrollElVal.scrollLeft = (realCount.value + currentIndex.value) * getStep();
          }
          measureMaxDescriptionHeight();
        });
      });
      resizeObserver.observe(el);
    }
  });
});

onUnmounted(() => {
  resizeObserver?.disconnect();
  scrollEl.value?.removeEventListener("scrollend", teleportIfNeeded);
  if (debounceTimer) clearTimeout(debounceTimer);
});
</script>

<style scoped>
.blokkli-block-projects-carousel {
  width: 100%;
}

.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}

/*
  Full-bleed: breaks out of any container max-width and fills the full viewport.
  The inner scroll div retains its own padding (px-6) so content aligns correctly.
*/
.carousel-bleed {
  position: relative;
  left: 50%;
  margin-left: -50vw;
  width: 100vw;
}
</style>

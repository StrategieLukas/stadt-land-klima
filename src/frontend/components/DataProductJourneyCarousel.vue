<template>
  <div v-if="items.length" class="mt-8">
    <div class="mb-3 flex items-center justify-between gap-3">
      <h3 class="text-gray-500 text-sm font-bold uppercase tracking-wide">Datenreise</h3>
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="border-gray-200 btn btn-ghost btn-xs border bg-white"
          @click="expanded = !expanded"
        >
          <Icon :icon="expanded ? 'mdi:arrow-collapse' : 'mdi:arrow-expand'" class="h-4 w-4" />
          {{ expanded ? "Kompakt" : "Groß" }}
        </button>
        <button
          type="button"
          class="border-gray-200 btn btn-ghost btn-xs border bg-white"
          :disabled="activePage <= 0"
          aria-label="Vorherige Grafik"
          @click="goTo(activePage - 1)"
        >
          <Icon icon="mdi:chevron-left" class="h-4 w-4" />
        </button>
        <button
          type="button"
          class="border-gray-200 btn btn-ghost btn-xs border bg-white"
          :disabled="activePage >= pages.length - 1"
          aria-label="Nächste Grafik"
          @click="goTo(activePage + 1)"
        >
          <Icon icon="mdi:chevron-right" class="h-4 w-4" />
        </button>
      </div>
    </div>

    <div ref="trackRef" class="no-scrollbar snap-x snap-mandatory overflow-x-auto scroll-smooth">
      <div class="flex">
        <div v-for="(page, pageIndex) in pages" :key="pageIndex" class="min-w-full snap-start">
          <div class="grid gap-4" :class="expanded ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'">
            <article
              v-for="item in page"
              :key="item.key"
              class="border-gray-200 overflow-hidden rounded-lg border bg-white shadow-sm"
            >
              <div class="border-gray-100 border-b px-4 py-3">
                <p class="text-gray-900 text-sm font-bold leading-snug">{{ item.title }}</p>
                <p v-if="item.description" class="text-gray-500 mt-1 line-clamp-2 text-xs leading-relaxed">
                  {{ item.description }}
                </p>
              </div>

              <div class="p-3">
                <KPICard
                  v-if="item.element.type === 'kpi'"
                  :element="item.element"
                  :collection-slug="collection.id"
                  :ars="ars"
                  :base-url="baseUrl"
                  :population="population"
                />
                <DataImage
                  v-else-if="item.element.type === 'image'"
                  :element="item.element"
                  :collection-slug="collection.id"
                  :base-url="baseUrl"
                />
                <div v-else-if="item.spec" class="w-full" :style="`height: ${expanded ? 430 : 280}px`">
                  <ClientOnly>
                    <VegaChart :spec="item.spec" />
                  </ClientOnly>
                </div>
                <div
                  v-else
                  class="text-gray-400 bg-gray-50 flex min-h-[180px] items-center justify-center rounded text-xs"
                >
                  Visualisierung für diesen Schritt noch nicht verfügbar.
                </div>
              </div>
            </article>
          </div>
        </div>
      </div>
    </div>

    <div v-if="pages.length > 1" class="mt-3 flex items-center justify-center gap-1.5">
      <button
        v-for="(_, pageIndex) in pages"
        :key="pageIndex"
        type="button"
        class="h-1.5 rounded-full transition-all"
        :class="pageIndex === activePage ? 'w-6 bg-[#006e94]' : 'bg-gray-300 w-1.5'"
        :aria-label="`Grafikgruppe ${pageIndex + 1}`"
        @click="goTo(pageIndex)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { computed, nextTick, ref, watch } from "vue";
import type { Collection, RenderElement } from "~/types/slz-api";
import type { ResolvedStep } from "~/composables/useCollectionRender";
import { injectAreaIntoSpec, localizedText } from "~/utils/dataProducts";

const props = defineProps<{
  steps: ResolvedStep[];
  collection: Collection;
  ars: string;
  baseUrl: string;
  population?: number | null;
}>();

interface CarouselItem {
  key: string;
  title: string;
  description: string;
  element: RenderElement;
  spec: object | null;
}

const expanded = ref(false);
const activePage = ref(0);
const trackRef = ref<HTMLElement | null>(null);

const items = computed<CarouselItem[]>(() => {
  const list: CarouselItem[] = [];
  for (const step of props.steps) {
    for (const element of step.elements) {
      if (element.type === "map") continue;
      list.push({
        key: `${step.index}-${element.plot_id || list.length}`,
        title: localizedText(element.title) || localizedText(step.title) || localizedText(props.collection.title),
        description: localizedText(element.description) || localizedText(step.description),
        element,
        spec: element.vegalite_spec ? injectAreaIntoSpec(element.vegalite_spec as object, props.ars) : null,
      });
    }
  }
  return list;
});

const pageSize = computed(() => (expanded.value ? 1 : 2));
const pages = computed(() => {
  const grouped: CarouselItem[][] = [];
  for (let i = 0; i < items.value.length; i += pageSize.value) {
    grouped.push(items.value.slice(i, i + pageSize.value));
  }
  return grouped;
});

function goTo(index: number) {
  activePage.value = Math.min(Math.max(index, 0), pages.value.length - 1);
  nextTick(() => {
    const track = trackRef.value;
    if (!track) return;
    track.scrollTo({ left: activePage.value * track.clientWidth, behavior: "smooth" });
  });
}

watch(expanded, () => goTo(0));
watch(
  () => pages.value.length,
  () => {
    if (activePage.value >= pages.value.length) goTo(Math.max(pages.value.length - 1, 0));
  },
);
</script>

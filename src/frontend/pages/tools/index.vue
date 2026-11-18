<template>
  <div class="w-full py-8">
    <header class="mb-8">
      <h1 class="mb-4 font-heading text-4xl font-black text-stats-dark sm:text-6xl">{{ $t("tools.title") }}</h1>
      <p class="max-w-3xl text-lg leading-relaxed text-gray">{{ $t("tools.description") }}</p>
      <div class="mt-6 flex flex-wrap gap-3">
        <CanonicalButton
          :label="$t('measures.heading')"
          href="/measures"
          icon-slug="mdi:clipboard-list-outline"
          color="dark"
          text-color="white"
        />
        <CanonicalButton
          :label="$t('data.overview.title')"
          href="/data"
          icon-slug="mdi:chart-box-outline"
          color="dark"
          text-color="white"
        />
      </div>
    </header>

    <div v-if="pending" class="rounded-lg border border-gray-100 bg-white p-6 text-gray-500 shadow-xs">
      {{ $t("generic.loading") }}
    </div>

    <div v-else-if="hasLoadError" class="rounded-lg border border-red/20 bg-red/5 p-6 text-red shadow-xs">
      {{ $t("tools.loading_error") }}
    </div>

    <template v-else>
      <div class="mb-6 rounded-lg border border-stats-light bg-stats-light/40 p-3 shadow-xs">
        <div class="flex flex-wrap items-center gap-2">
          <button
            type="button"
            class="inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-bold transition-colors"
            :class="
              selectedCategory === null
                ? 'border-stats-dark bg-stats-dark text-white'
                : 'border-stats-dark bg-white text-stats-dark hover:bg-stats-light'
            "
            @click="selectedCategory = null"
          >
            {{ $t("tools.category.all") }}
          </button>
          <button
            v-for="category in categoryOptions"
            :key="category"
            type="button"
            class="inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-bold transition-colors"
            :class="
              selectedCategory === category
                ? 'border-stats-dark bg-stats-dark text-white'
                : 'border-stats-dark bg-white text-stats-dark hover:bg-stats-light'
            "
            @click="selectedCategory = category"
          >
            {{ category }}
          </button>
        </div>
      </div>

      <p class="mb-4 text-sm text-gray-500">
        {{ $t("tools.results_count", { ":count": filteredTools.length }) }}
      </p>

      <div
        v-if="filteredTools.length === 0"
        class="rounded-lg border border-gray-100 bg-white p-6 text-gray-500 shadow-xs"
      >
        {{ $t("tools.empty") }}
      </div>

      <div v-else class="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        <article
          v-for="tool in filteredTools"
          :id="`tool-${tool.id}`"
          :key="tool.id"
          tabindex="-1"
          class="card scroll-mt-32 overflow-hidden rounded-lg border border-gray-100 bg-white shadow-xs transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--slk-text-strong)"
        >
          <a
            :href="tool.link"
            target="_blank"
            rel="noopener noreferrer"
            class="group block focus-visible:ring-2 focus-visible:ring-light-blue focus-visible:outline-hidden"
            :aria-label="$t('tools.open_tool')"
          >
            <div class="relative h-44 overflow-hidden bg-stats-light">
              <SmartImg
                v-if="imageId(tool.image)"
                :asset-id="imageId(tool.image)"
                :is-raster="imageIsRaster(tool.image)"
                :alt="$t('tools.image_alt', { ':title': tool.title })"
                :width="640"
                :height="280"
                fit="cover"
                img-class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div
                v-else
                class="flex h-full items-center justify-center bg-linear-to-br from-stats-light via-white to-ranking-light"
              >
                <svg
                  class="h-16 w-16 text-stats-dark/25"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.4"
                  aria-hidden="true"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v13a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 18.5v-13Z"
                  />
                  <path stroke-linecap="round" stroke-linejoin="round" d="M8 8h8M8 12h5M8 16h8" />
                </svg>
              </div>
              <span
                class="slk-badge slk-badge--info absolute top-3 left-3 rounded-full px-2.5 py-1 text-xs font-bold shadow-xs"
              >
                {{ categoryLabel(tool) }}
              </span>
              <span
                v-if="tool.image_credits"
                class="absolute right-2 bottom-2 max-w-[80%] truncate rounded-sm bg-black/60 px-2 py-1 text-[0.65rem] text-white"
              >
                {{ tool.image_credits }}
              </span>
            </div>
          </a>

          <div class="card-body gap-3 p-5">
            <div>
              <h2 class="text-xl leading-snug font-bold text-gray">{{ tool.title }}</h2>
              <p v-if="tool.vendor" class="mt-1 text-xs font-semibold tracking-wide text-mid-gray uppercase">
                {{ $t("tools.vendor_label") }}: {{ tool.vendor }}
              </p>
            </div>

            <p class="text-sm leading-relaxed text-gray-600">{{ tool.description }}</p>

            <div class="mt-auto flex flex-wrap items-center justify-between gap-3 pt-2">
              <span class="min-w-0 truncate text-xs text-mid-gray">{{ linkHost(tool.link) }}</span>
              <CanonicalButton
                :href="tool.link"
                :label="$t('tools.open_tool')"
                color="dark"
                icon-slug="mdi:open-in-new"
                external
              />
            </div>
          </div>
        </article>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { isRaster } from "~/shared/utils";

import type { ClimateTool } from "~/shared/contracts/content";
const fetchContent = useContentFetch();

const { $t } = useNuxtApp();

usePageSeo({ title: $t("tools.title") });

const selectedCategory = ref<string | null>(null);

const {
  data: toolData,
  pending,
  error,
} = await useAsyncData("climate-tools-list", () => fetchContent("/api/public/climate-tools"));
const tools = computed(() => toolData.value?.tools ?? []);

const hasLoadError = computed(() => Boolean(error.value));

const sortedTools = computed(() => {
  return [...(tools.value ?? [])].sort((a, b) => {
    const sortA = typeof a.sort === "number" ? a.sort : Number.MAX_SAFE_INTEGER;
    const sortB = typeof b.sort === "number" ? b.sort : Number.MAX_SAFE_INTEGER;
    if (sortA !== sortB) return sortA - sortB;
    return a.title.localeCompare(b.title);
  });
});

const categoryOptions = computed(() => {
  return [...new Set(sortedTools.value.map(categoryLabel))].filter(Boolean).sort((a, b) => a.localeCompare(b));
});

const filteredTools = computed(() => {
  if (selectedCategory.value === null) return sortedTools.value;
  return sortedTools.value.filter((tool) => categoryLabel(tool) === selectedCategory.value);
});

const route = useRoute();
async function revealTool(hash: string) {
  if (!import.meta.client || !hash.startsWith("#tool-")) return;
  const tool = sortedTools.value.find((tool) => `#tool-${tool.id}` === hash);
  if (!tool) return;
  if (selectedCategory.value !== null && categoryLabel(tool) !== selectedCategory.value) selectedCategory.value = null;
  await nextTick();
  if (route.hash !== hash) return;
  const card = document.getElementById(`tool-${tool.id}`);
  card?.focus({ preventScroll: true });
  card?.scrollIntoView({ block: "start" });
}
onMounted(() => {
  void revealTool(route.hash);
});
watch([() => route.hash, sortedTools], ([hash]) => {
  void revealTool(hash);
});

function categoryLabel(tool: ClimateTool): string {
  return tool.category?.trim() || $t("tools.category.other");
}

function imageId(image: ClimateTool["image"]): string | null {
  if (!image) return null;
  return typeof image === "string" ? image : image.id;
}

function imageType(image: ClimateTool["image"]): string | null {
  if (!image || typeof image === "string") return null;
  return image.type ?? null;
}

function imageIsRaster(image: ClimateTool["image"]): boolean {
  const type = imageType(image);
  return type ? isRaster(type) : true;
}

function linkHost(link: string): string {
  try {
    return new URL(link).hostname.replace(/^www\./, "");
  } catch {
    return link;
  }
}
</script>

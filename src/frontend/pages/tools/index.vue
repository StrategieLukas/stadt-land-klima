<template>
  <div class="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
    <header class="mb-8 max-w-3xl">
      <h1 class="text-4xl font-bold text-stats-dark">{{ $t("tools.title") }}</h1>
      <p class="text-gray-600 mt-3 text-base leading-relaxed">{{ $t("tools.description") }}</p>
    </header>

    <div v-if="pending" class="border-gray-100 text-gray-500 rounded-lg border bg-white p-6 shadow-sm">
      {{ $t("generic.loading") }}
    </div>

    <div v-else-if="hasLoadError" class="rounded-lg border border-red/20 bg-red/5 p-6 text-red shadow-sm">
      {{ $t("tools.loading_error") }}
    </div>

    <template v-else>
      <div class="mb-6 rounded-lg border border-stats-light bg-stats-light/40 p-3 shadow-sm">
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

      <p class="text-gray-500 mb-4 text-sm">
        {{ $t("tools.results_count", { ":count": filteredTools.length }) }}
      </p>

      <div
        v-if="filteredTools.length === 0"
        class="border-gray-100 text-gray-500 rounded-lg border bg-white p-6 shadow-sm"
      >
        {{ $t("tools.empty") }}
      </div>

      <div v-else class="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        <article
          v-for="tool in filteredTools"
          :key="tool.id"
          class="border-gray-100 card overflow-hidden rounded-lg border bg-white shadow-sm transition-shadow hover:shadow-md"
        >
          <a
            :href="tool.link"
            target="_blank"
            rel="noopener noreferrer"
            class="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-light-blue"
            :aria-label="$t('tools.open_tool')"
          >
            <div class="relative h-44 overflow-hidden bg-stats-light">
              <SmartImg
                v-if="imageId(tool.image)"
                :assetId="imageId(tool.image)"
                :isRaster="imageIsRaster(tool.image)"
                :alt="$t('tools.image_alt', { ':title': tool.title })"
                :width="640"
                :height="280"
                fit="cover"
                imgClass="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div
                v-else
                class="flex h-full items-center justify-center bg-gradient-to-br from-stats-light via-white to-ranking-light"
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
                class="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-xs font-bold text-stats-dark shadow-sm"
              >
                {{ categoryLabel(tool) }}
              </span>
              <span
                v-if="tool.image_credits"
                class="absolute bottom-2 right-2 max-w-[80%] truncate rounded bg-black/60 px-2 py-1 text-[0.65rem] text-white"
              >
                {{ tool.image_credits }}
              </span>
            </div>
          </a>

          <div class="card-body gap-3 p-5">
            <div>
              <h2 class="text-xl font-bold leading-snug text-gray">{{ tool.title }}</h2>
              <p v-if="tool.vendor" class="mt-1 text-xs font-semibold uppercase tracking-wide text-mid-gray">
                {{ $t("tools.vendor_label") }}: {{ tool.vendor }}
              </p>
            </div>

            <p class="text-gray-600 text-sm leading-relaxed">{{ tool.description }}</p>

            <div class="mt-auto flex items-center justify-between gap-3 pt-2">
              <span class="min-w-0 truncate text-xs text-mid-gray">{{ linkHost(tool.link) }}</span>
              <a
                :href="tool.link"
                target="_blank"
                rel="noopener noreferrer"
                class="btn btn-sm rounded-full border-stats-dark bg-stats-dark px-4 text-white hover:border-light-blue hover:bg-light-blue"
              >
                {{ $t("tools.open_tool") }}
              </a>
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

type DirectusFile = {
  id: string;
  type?: string | null;
};

type ClimateTool = {
  id: string;
  title: string;
  description: string;
  category?: string | null;
  vendor?: string | null;
  link: string;
  image?: DirectusFile | string | null;
  image_credits?: string | null;
  sort?: number | null;
};

const { $directus, $readItems, $t } = useNuxtApp();

useHead({ title: $t("tools.title") });

const selectedCategory = ref<string | null>(null);

const {
  data: tools,
  pending,
  error,
} = await useAsyncData("climate-tools-list", async () => {
  return (await $directus.request(
    $readItems(
      "climate_tools" as never,
      {
        fields: [
          "id",
          "title",
          "description",
          "category",
          "vendor",
          "link",
          "image_credits",
          "sort",
          { image: ["id", "type"] },
        ],
        sort: ["sort", "title"],
        limit: -1,
      } as never,
    ),
  )) as ClimateTool[];
});

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

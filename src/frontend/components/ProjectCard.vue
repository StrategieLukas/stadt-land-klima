<template>
  <div class="card max-w-[400px] overflow-hidden rounded-none bg-white shadow-xl">
    <div class="relative">
      <NuxtLink :to="`/projects/${slug}`" class="group relative flex h-40 items-center justify-center bg-gray-200">
        <SmartImg
          :asset-id="image_id"
          :is-raster="image_is_raster"
          :alt="title"
          :height="160"
          :width="400"
          fit="cover"
          sizes="(max-width: 768px) 312px, 400px"
          img-class="object-cover w-full h-full"
        />
        <div v-if="tag" class="absolute top-2 left-2 rounded-sm bg-yellow-400 px-2 py-1 text-xs">
          {{ tag }}
        </div>

        <!-- Mini-Logo, if article has associated organisation -->
        <div v-if="organisation" class="absolute top-0 right-0 h-28 w-28 overflow-hidden">
          <div
            class="absolute top-0 right-0 h-0 w-0 border-t-[7rem] border-l-[7rem] border-t-white border-l-transparent"
          ></div>
          <!-- Using raw image url (no width parameter) for easier request caching as organisation logos should be small -->
          <img
            class="absolute top-2 right-2"
            height="48"
            width="48"
            :alt="organisation.name ?? ''"
            loading="lazy"
            :src="getRawUrl(organisation.logo)"
          />
        </div>

        <!-- Image credits overlay on hover -->
        <div
          v-if="image_credits"
          class="absolute inset-x-0 bottom-0 truncate bg-black/50 px-2 py-1 text-[10px] text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100"
        >
          {{ image_credits }}
        </div>
      </NuxtLink>

      <!-- Card Content -->
      <div class="p-4">
        <NuxtLink :to="`/projects/${slug}`">
          <h2 class="mb-2 font-semibold text-blue-500">
            {{ title }}
          </h2>
        </NuxtLink>
        <p class="mb-1 text-sm font-bold">
          {{ location }}
        </p>

        <!-- Truncated abstract text -->
        <p class="mb-2 text-sm text-gray-600">
          {{ truncatedAbstract }}
        </p>

        <!-- Author and Date Section -->
        <p v-if="byline" class="mb-2 text-xs text-gray-500 italic">
          {{ byline }}
        </p>

        <!-- Measures -->
        <div v-if="measures && measures.length" class="mb-2 flex flex-wrap gap-1">
          <NuxtLink
            v-for="m in measures"
            :key="m.id"
            :to="`/measures/${m.slug || m.id}`"
            class="inline-block rounded-sm bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-200"
            >{{ m.measure_id }}</NuxtLink
          >
        </div>

        <!-- Read more link -->
        <NuxtLink :to="`/projects/${slug}`" class="text-sm text-blue-500">{{ $t("article.read_more") }} → </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Asset, Organisation } from "~/types/components/content";

import type { PropType } from "vue";
import type { Measure } from "~/types/components/municipality";

import { computed } from "vue";
import { buildLocationString } from "~/shared/utils";
import { formatProjectDate } from "~/shared/projectDate";
const { $locale } = useNuxtApp();

const props = defineProps({
  slug: { type: String as PropType<string | undefined> },
  title: { type: String as PropType<string | undefined> },
  municipality_name: { type: String as PropType<string | undefined> },
  state: { type: String as PropType<string | undefined> },
  abstract: { type: String as PropType<string | undefined> },
  author: { type: String as PropType<string | undefined> },
  date: [String, Date] as PropType<string | Date | null | undefined>,
  tag: { type: String as PropType<string | undefined> },
  image_id: { type: String as PropType<string | undefined> },
  image_is_raster: { type: Boolean as PropType<boolean | undefined> },
  image_credits: { type: String as PropType<string | null | undefined>, default: null },
  organisation: Object as PropType<Organisation | null | undefined>, // can be null
  measures: Array as PropType<Pick<Measure, "id" | "measure_id" | "name" | "slug">[] | null | undefined>, // can be null/empty
});

const config = useRuntimeConfig();
const location = computed(() => buildLocationString(props.municipality_name, props.state));
const formattedDate = computed(() => formatProjectDate(props.date, $locale));
const byline = computed(() => [props.author, formattedDate.value].filter(Boolean).join(", "));

const truncatedAbstract = computed(() => {
  if (props.abstract && props.abstract.length > 300) {
    return props.abstract.substring(0, 300) + "...";
  }
  return props.abstract;
});

function getRawUrl(assetId: Asset | undefined) {
  return `${config.public.clientDirectusUrl}/assets/${typeof assetId === "object" ? (assetId?.id ?? "") : (assetId ?? "")}`;
}
</script>

<style scoped>
.card img {
  object-fit: cover;
}
</style>

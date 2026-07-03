<template>
  <div class="card max-w-[400px] overflow-hidden rounded-none bg-white shadow-xl">
    <div class="relative">
      <NuxtLink :to="`/projects/${slug}`" class="bg-gray-200 relative flex h-40 items-center justify-center">
        <SmartImg
          :assetId="image_id"
          :isRaster="image_is_raster"
          :alt="title"
          :height="160"
          :width="400"
          fit="cover"
          sizes="(max-width: 768px) 312px, 400px"
          format="webp"
          img-class="object-cover w-full h-full"
        />
        <div v-if="tag" class="absolute left-2 top-2 rounded bg-yellow-400 px-2 py-1 text-xs">
          {{ tag }}
        </div>

        <!-- Mini-Logo, if article has associated organisation -->
        <div v-if="organisation" class="absolute right-0 top-0 h-28 w-28 overflow-hidden">
          <div class="slk-card-logo-corner absolute right-0 top-0 h-28 w-28"></div>
          <!-- Using raw image url (no width parameter) for easier request caching as organisation logos should be small -->
          <img
            class="absolute right-2 top-2"
            :class="{ 'dark:hidden': hasDarkOrganisationLogo(organisation.logo) }"
            height="48"
            width="48"
            :alt="organisation.name"
            loading="lazy"
            :src="getRawUrl(organisation.logo)"
          />
          <img
            v-if="hasDarkOrganisationLogo(organisation.logo)"
            class="absolute right-2 top-2 hidden dark:block"
            height="48"
            width="48"
            :alt="organisation.name"
            loading="lazy"
            :src="getDarkOrganisationLogoUrl(organisation.logo)"
          />
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
        <p class="text-gray-600 mb-2 text-sm">
          {{ truncatedAbstract }}
        </p>

        <!-- Author and Date Section -->
        <p class="text-gray-500 mb-2 text-xs italic">{{ author }}, {{ date.toLocaleDateString($locale) }}</p>

        <!-- Measures -->
        <div v-if="measures && measures.length" class="mb-2 flex flex-wrap gap-1">
          <NuxtLink
            v-for="m in measures"
            :key="m.id"
            :to="`/measures/${m.slug || m.id}`"
            class="inline-block rounded bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-200"
            >{{ m.measure_id }}</NuxtLink
          >
        </div>

        <!-- Read more link -->
        <NuxtLink :to="`/projects/${slug}`" class="text-sm text-blue-500">{{ $t("article.read_more") }} → </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { buildLocationString } from "~/shared/utils";
import localZeroLogoDark from "~/assets/images/LocalZero-logo-small-dark.png";
const { $locale } = useNuxtApp();
const localZeroLogoId = "85624177-21f4-43c7-9b13-b53087ba2401";

const props = defineProps({
  slug: String,
  title: String,
  municipality_name: String,
  state: String,
  abstract: String,
  author: String,
  date: Date,
  tag: String,
  image_id: String,
  image_is_raster: Boolean,
  organisation: Object, // can be null
  measures: Array, // can be null/empty
});

const config = useRuntimeConfig();
const location = computed(() => buildLocationString(props.municipality_name, props.state));

const truncatedAbstract = computed(() => {
  if (props.abstract && props.abstract.length > 300) {
    return props.abstract.substring(0, 300) + "...";
  }
  return props.abstract;
});

function getAssetId(assetId) {
  return typeof assetId === "string" ? assetId : assetId?.id;
}

function getRawUrl(assetId) {
  const id = getAssetId(assetId);

  return id ? `${config.public.clientDirectusUrl}/assets/${id}` : "";
}

function hasDarkOrganisationLogo(assetId) {
  return getAssetId(assetId) === localZeroLogoId;
}

function getDarkOrganisationLogoUrl(assetId) {
  return hasDarkOrganisationLogo(assetId) ? localZeroLogoDark : getRawUrl(assetId);
}
</script>

<style scoped>
.card img {
  object-fit: cover;
}

.slk-card-logo-corner {
  background-color: var(--slk-surface);
  clip-path: polygon(100% 0, 100% 100%, 0 0);
}
</style>

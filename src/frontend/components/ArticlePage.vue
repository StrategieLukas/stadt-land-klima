<template>
  <!-- Mobile version -->
  <div class="project-page mt-4 block overflow-hidden rounded-md bg-very-light-blue shadow-md lg:hidden">
    <div class="p-6">
      <NuxtLink :to="backHref" class="text-sm text-blue-500">← {{ backLabel }}</NuxtLink>

      <!-- Title and Subtitle -->
      <h1 class="mb-1 text-2xl font-bold text-blue-500">{{ title }}</h1>
      <h2 class="text-gray-500 mb-4 text-lg">{{ subtitle }}</h2>

      <!-- Social Media Icons -->
      <div class="my-2 flex">
        <!-- <img src="/icons/facebook.svg" class="w-6 h-6" alt="Facebook" /> -->

        <a
          v-if="article_instagram"
          :href="article_instagram"
          target="_blank"
          rel="noopener noreferrer"
          class="text-blue-500 hover:underline"
        >
          <img src="~/assets/icons/icon_instagram.svg" class="my-0 mr-2 h-6 w-6" alt="Instagram" />
        </a>

        <a
          v-if="article_linkedin"
          :href="article_linkedin"
          target="_blank"
          rel="noopener noreferrer"
          class="text-blue-500 hover:underline"
        >
          <img src="~/assets/icons/icon_linkedin.svg" class="my-0 h-6 w-6" alt="LinkedIn" />
        </a>

        <!-- <img src="/icons/mastodon.svg" class="w-6 h-6" alt="Mastodon" /> -->
      </div>

      <!-- Location, Author and Date -->
      <p class="text-gray-600 mb-1 text-sm">
        <NuxtLink
          v-if="municipality_slug"
          :to="`/municipalities/${municipality_slug}`"
          class="text-blue-500 hover:underline"
          >{{ location }}</NuxtLink
        >
        <span v-else>{{ location }}</span>
      </p>
      <p class="text-gray-600 mb-1 text-sm">
        <i>{{ $t("article.author_date", { ":author": author, ":date": date.toLocaleDateString($locale) }) }}</i>
      </p>

      <!-- Image and Image Credits (Passing the expected maxwidth of 960 for mobile to avoid fetching excessively large images)-->
      <div class="relative mb-4">
        <SmartImg
          v-if="image_id"
          :assetId="image_id"
          :isRaster="image_is_raster"
          :alt="title"
          :width="960"
          fit="cover"
          format="webp"
          img-class="object-cover w-full h-full"
        />
        <div
          v-if="organisation && organisation.logo"
          class="clip-triangle absolute right-0 top-0 flex h-32 w-32 items-center justify-center bg-white"
        >
          <SmartImg
            :assetId="organisation.logo?.id || organisation.logo"
            :isRaster="organisation.logo?.type ? isRaster(organisation.logo.type) : true"
            :alt="organisation.name"
            :height="56"
            :width="56"
            fit="cover"
            img-class="absolute top-2 right-2 w-14 h-14"
          />
        </div>
        <p v-if="image_credits" class="text-gray-500 mt-1 text-center text-xs italic">{{ image_credits }}</p>
      </div>

      <!-- Abstract -->
      <p v-if="abstract" v-html="md.render(abstract)" class="text-gray-700 mb-4 font-semibold" />

      <!-- Main Text -->
      <div class="text-gray-700 mb-4">
        <div v-html="md.render(article_text)"></div>
      </div>

      <!-- Measures -->
      <div v-if="measures && measures.length" class="mt-4">
        <p class="text-gray-700 mb-1 text-sm font-semibold">{{ $t("article.related_measures") }}</p>
        <div class="flex flex-wrap gap-2">
          <NuxtLink
            v-for="m in measures"
            :key="m.id"
            :to="`/measures/${m.slug || m.id}`"
            class="inline-block rounded bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700 transition hover:bg-blue-200"
            >{{ m.measure_id }}</NuxtLink
          >
        </div>
      </div>

      <!-- Organisation note -->
      <p v-if="organisation" class="text-gray-600 mb-1 text-sm">
        {{ $t("article.project_by", { ":organisation": organisation.name }) }}
      </p>

      <!-- Contact Information -->
      <!-- <div class="border-t pt-4 mt-4">
          <h3 class="text-lg font-semibold mb-2">Kontakt zu den Verantwortlichen:</h3>
          <p class="text-blue-500">
            <a :href="contact.link" target="_blank">{{ contact.text }}</a>
          </p>
        </div> -->

      <!-- Navigation Links -->
      <!-- <div class="flex justify-between mt-6">
          <NuxtLink to="#" class="text-blue-500 text-sm">← vorherige Story</NuxtLink>
          <NuxtLink to="#" class="text-blue-500 text-sm">nächste Story →</NuxtLink>
        </div> -->
    </div>
  </div>

  <!-- Desktop version -->
  <div class="project-page relative mt-8 hidden rounded-lg bg-very-light-blue p-8 shadow-lg lg:block">
    <NuxtLink :to="backHref" class="text-sm text-blue-500">← {{ backLabel }}</NuxtLink>
    <!-- Top Right Logo with White Triangle Background -->
    <div
      v-if="organisation && organisation.logo"
      class="clip-triangle absolute right-0 top-0 flex h-32 w-32 items-center justify-center bg-white"
    >
      <SmartImg
        :assetId="organisation.logo.id"
        :isRaster="isRaster(organisation.logo.type)"
        :alt="organisation.name"
        :height="56"
        :width="56"
        fit="cover"
        img-class="absolute top-2 right-2 w-14 h-14"
      />
    </div>

    <div class="prose grid max-w-none grid-cols-3 gap-6">
      <!-- Sidebar -->
      <div class="text-gray-700 flex flex-col space-y-4 rounded-lg bg-white p-6 text-sm shadow-md">
        <!-- Image and Credits -->
        <div>
          <div class="bg-gray-200 flex h-48 w-full items-center justify-center rounded-lg">
            <span v-if="!image_id" class="text-gray-500">{{ $t("generic.loading") }}</span>
            <SmartImg
              v-if="image_id"
              :assetId="image_id"
              :isRaster="image_is_raster"
              :alt="title"
              fit="cover"
              format="webp"
              img-class="w-full h-full object-cover rounded-lg"
            />
          </div>
          <p v-if="image_credits" class="text-gray-500 text-center text-xs italic">{{ image_credits }}</p>
        </div>

        <p v-if="municipality_name" class="border-gray-300 flex justify-between border-b pb-2">
          <strong>{{ $t("municipality") }}</strong>
          <NuxtLink
            v-if="municipality_slug"
            :to="`/municipalities/${municipality_slug}`"
            class="text-right text-blue-500 hover:underline"
            >{{ municipality_name }}</NuxtLink
          >
          <span v-else class="text-right">{{ municipality_name }}</span>
        </p>
        <p v-if="state" class="border-gray-300 flex justify-between border-b pb-2">
          <strong>{{ $t("state") }}</strong>
          <span class="text-right">{{ state }}</span>
        </p>
        <!-- <p v-if="date" class="pb-2 border-b border-gray-300 flex justify-between">
          <strong>{{ $t("date") }}</strong>
          <span class="text-right">{{ date.toLocaleDateString($locale) }}</span>
        </p> -->
        <p v-if="organisation" class="border-gray-300 flex justify-between border-b pb-2">
          <strong>{{ $t("organisation") }}</strong>
          <span class="text-right">
            <a
              :href="organisation.link"
              target="_blank"
              rel="noopener noreferrer"
              class="text-blue-500 hover:underline"
              >{{ organisation.name }}</a
            >
          </span>
        </p>
        <p v-if="author" class="border-gray-300 flex justify-between border-b pb-2">
          <strong>{{ $t("author") }}</strong>
          <span class="text-right">{{ author }}</span>
        </p>
        <!-- Measures -->
        <div v-if="measures && measures.length" class="border-gray-300 border-b pb-2">
          <strong class="mb-1 block">{{ $t("article.related_measures") }}</strong>
          <div class="flex flex-wrap justify-end gap-1">
            <NuxtLink
              v-for="m in measures"
              :key="m.id"
              :to="`/measures/${m.slug || m.id}`"
              class="inline-block rounded bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700 transition hover:bg-blue-200"
              >{{ m.name }} ({{ m.measure_id }})</NuxtLink
            >
          </div>
        </div>

        <p v-if="link" class="border-gray-300 flex justify-between border-b pb-2">
          <strong>{{ $t("link") }}</strong>
          <a :href="link.href" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:underline">{{
            link.hostname
          }}</a>
        </p>

        <!-- Missing categories: Tag, Municipality size, Contact for this project (i.e. from the local group that did the project, not necessarily the author) -->

        <!-- Social Media Icons -->
        <div v-if="articleHasSocialMedia" class="flex justify-between space-x-3">
          <strong>{{ $t("generic.social_media") }}</strong>
          <div class="flex">
            <!-- <img src="/icons/facebook.svg" class="w-6 h-6" alt="Facebook" /> -->

            <a
              v-if="article_instagram"
              :href="article_instagram"
              target="_blank"
              rel="noopener noreferrer"
              class="text-blue-500 hover:underline"
            >
              <img src="~/assets/icons/icon_instagram.svg" class="my-0 mr-2 h-6 w-6" alt="Instagram" />
            </a>

            <a
              v-if="article_linkedin"
              :href="article_linkedin"
              target="_blank"
              rel="noopener noreferrer"
              class="text-blue-500 hover:underline"
            >
              <img src="~/assets/icons/icon_linkedin.svg" class="my-0 h-6 w-6" alt="LinkedIn" />
            </a>

            <!-- <img src="/icons/mastodon.svg" class="w-6 h-6" alt="Mastodon" /> -->
          </div>
        </div>
      </div>

      <!-- Main Content -->
      <div class="col-span-2 flex flex-col">
        <h1 class="mb-2 pr-10 text-3xl font-bold text-blue-600">{{ title }}</h1>
        <p v-if="subtitle" class="text-gray-500 mb-6 text-lg">{{ subtitle }}</p>

        <div class="text-gray-700 flex-grow leading-relaxed">
          <div v-if="abstract" v-html="md.render(abstract)" class="prose mb-8 max-w-none" />
          <div v-html="md.render(article_text)"></div>
        </div>
      </div>
    </div>

    <!-- Footer Buttons -->
    <!-- <div class="flex justify-center space-x-4 mt-8">
      <button class="bg-[#009FE3] text-white px-6 py-3 rounded-full shadow-md hover:bg-[#0082C3] transition">
        Übersicht Erfolgsprojekte
      </button>
      <button class="bg-[#009FE3] text-white px-6 py-3 rounded-full shadow-md hover:bg-[#0082C3] transition flex items-center">
        <span class="mr-2">✖</span> Fenster schließen
      </button>
    </div> -->
  </div>
</template>

<style>
.clip-triangle {
  clip-path: polygon(100% 0, 0 0, 100% 100%);
}
</style>

<script setup>
import { ref, watchEffect } from "vue";
import { buildLocationString, toAssetUrl, isRaster } from "~/shared/utils";
import MarkdownIt from "markdown-it";
import { useReferrer } from "~/composables/useReferrer";

const md = new MarkdownIt();
const { $t, $locale } = useNuxtApp();
const { backHref, backLabel } = useReferrer("/projects", $t("navigation.return_to_overview"));

const props = defineProps({
  title: String,
  subtitle: String,
  municipality_name: String,
  municipality_slug: String,
  state: String,
  author: String,
  date: Date,
  image_id: String,
  image_is_raster: Boolean,
  image_credits: String,
  abstract: String,
  article_text: String,
  link: URL,
  article_instagram: String,
  article_linkedin: String,
  organisation: Object, // can be null
  measures: Array, // can be null/empty
});

const articleHasSocialMedia = props.article_instagram || props.article_linkedin;
// const organisationHasSocialMedia = props.organisation && (props.organisation.instagram || props.organisation.linkedin);

const src = ref(null);

// does nothing?
// watchEffect(async () => {
//   src.value = null;
//   src.value = await toAssetUrl(props.assetId, { width: props.width, height: props.height, quality: props.quality, fit: props.fit });
// });

const location = computed(() => buildLocationString(props.municipality_name, props.state));
</script>

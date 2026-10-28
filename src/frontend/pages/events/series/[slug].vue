<template>
  <main v-if="series" class="container mx-auto px-4 py-8">
    <h1 class="mb-4 font-heading text-4xl font-black">{{ series.title }}</h1>
    <p v-if="series.introduction" class="mb-8">{{ series.introduction }}</p>
    <div class="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      <EventCard v-for="event in events" :key="event.id" :event="event" />
    </div>
  </main>
</template>
<script setup lang="ts">
import { routeSlug } from "~/shared/routeValues";
const fetchContent = useContentFetch();

const { $t } = useNuxtApp();
const route = useRoute();
const slug = routeSlug(route.params.slug);
if (!slug) throw createError({ statusCode: 404, statusMessage: "Not found" });
const legacyRedirected = await useLegacyTourRedirect("tour", slug);
const { data: seriesData } = await useAsyncData(`ordinary-event-series-${slug}`, () =>
  fetchContent(`/api/public/event-series/${encodeURIComponent(slug)}`),
);
const series = computed(() => seriesData.value?.series);
if (!series.value && !legacyRedirected)
  throw createError({ statusCode: 404, statusMessage: $t("page_not_found"), fatal: true });
const events = computed(() => seriesData.value?.events ?? []);
usePageSeo({
  title: () => series.value?.title,
  description: () => series.value?.introduction,
  image: () => series.value?.cover_image,
});
</script>

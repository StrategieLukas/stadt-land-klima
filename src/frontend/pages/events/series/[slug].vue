<template>
  <main v-if="series" class="container mx-auto px-4 py-8">
    <h1 class="mb-4 font-heading text-4xl font-black">{{ series.title }}</h1>
    <p v-if="series.introduction" class="mb-8">{{ series.introduction }}</p>
    <div class="grid gap-5 md:grid-cols-2 xl:grid-cols-3"><EventCard v-for="event in events" :key="event.id" :event="event" /></div>
  </main>
</template>
<script setup lang="ts">
const { $directus, $readItems, $t } = useNuxtApp();
const route = useRoute();
const legacyRedirected = await useLegacyTourRedirect('tour', String(route.params.slug));
const { data: rows } = await useAsyncData(`ordinary-event-series-${route.params.slug}`, () => $directus.request($readItems('event_series', {filter:{slug:{_eq:route.params.slug},status:{_eq:'published'}},fields:['id','title','introduction'],limit:1})));
const series = computed(() => rows.value?.[0]);
if (!series.value && !legacyRedirected) throw createError({statusCode:404,statusMessage:$t('page_not_found'),fatal:true});
const { data: events } = await useAsyncData(`ordinary-series-events-${route.params.slug}`, () => series.value ? $directus.request($readItems('events', {filter:{series:{_eq:series.value.id},status:{_eq:'published'}},fields:['id','slug','title','start_date','end_date','date_only','location','event_type','event_category',{image:['id','type']}],sort:['series_order','start_date'],limit:-1})) : Promise.resolve([]));
useHead(() => ({title:series.value?.title}));
</script>

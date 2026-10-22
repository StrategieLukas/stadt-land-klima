<template>
  <main v-if="event" class="event-detail mx-auto w-full max-w-3xl px-4 py-8">
    <NuxtLink :to="backHref" class="mb-6 inline-flex text-sm text-stats-dark hover:underline">← {{ backLabel }}</NuxtLink>
    <header class="mb-6">
      <span class="mb-3 inline-block text-xs font-bold uppercase text-olive-green">{{ eventTypeLabel(event.event_type) }}</span>
      <h1 class="mb-4 font-heading text-3xl font-black leading-tight sm:text-5xl">{{ event.title }}</h1>
      <div class="mb-3 flex flex-wrap gap-4 text-sm">
        <time :datetime="event.start_date">{{ formatEventDateTimeRange(event.start_date, event.end_date, $locale, event.date_only) }}</time>
        <span v-if="event.location">{{ event.location }}</span>
      </div>
    </header>
    <figure v-if="cover" class="event-detail__cover mb-8">
      <SmartImg :asset-base-url="undefined" :asset-id="relationId(cover)" :is-raster="isRaster(typeof cover === 'string' ? 'image/jpeg' : cover.type || 'image/jpeg')" :alt="event.title" :width="1100" img-class="block max-h-[50svh] w-full object-contain" />
      <figcaption v-if="coverCredit" class="mt-2 text-xs">{{ coverCredit }}</figcaption>
    </figure>
    <div v-if="event.description" class="prose mb-8 max-w-none" v-html="event.description" />
    <CanonicalButton v-if="event.registration_url && event.event_category !== 'internal'" :href="event.registration_url" :label="event.cta_label || $t('events.register')" icon-slug="mdi:calendar-check" color="green" external />
    <CanonicalButton v-if="ordinaryReport" :href="`/news/${ordinaryReport.slug}`" :label="$t('tour.read_report')" color="dark" icon-slug="mdi:newspaper" />
    <nav v-if="event.series || eventProjects.length" class="event-detail__related mt-8 flex flex-wrap gap-3">
      <CanonicalButton v-if="event.series" class="max-w-full !whitespace-normal" :href="`/events/series/${event.series.slug}#stop-${event.slug}`" :label="$t('tour.back_to_series', { ':title': event.series.title })" color="dark" icon-slug="mdi:map-marker-path" />
      <NuxtLink v-for="project in eventProjects" :key="project.id" :to="`/projects/${project.slug}`" class="self-center font-semibold text-stats-dark hover:underline">{{ project.title }} →</NuxtLink>
    </nav>
  </main>
</template>
<script setup lang="ts">
import { routeSlug } from "~/shared/routeValues";
import { useReferrer } from '~/composables/useReferrer';
import { isRaster } from '~/shared/utils';
import { relationId } from '~/shared/tour';
import { formatBerlinDate, formatEventDateTimeRange } from '~/shared/eventDateTime';
import type { MediaFile } from '~/shared/tourMedia';
const { $t, $translateDynamic, $locale } = useNuxtApp();
const route = useRoute();
const slug = routeSlug(route.params.slug);
if (!slug) throw createError({statusCode: 404, statusMessage: "Not found"});
const { backHref, backLabel } = useReferrer('/events', $t('events.title'));
const legacyRedirected = await useLegacyTourRedirect('stop', slug);
const { data: eventData } = await useAsyncData(`event-${route.params.slug}`, () => $fetch(`/api/public/events/${encodeURIComponent(slug)}`));
const event = computed(() => eventData.value?.event);
if (!event.value && !legacyRedirected) throw createError({ statusCode: 404, statusMessage: $t('events.not_found'), fatal: true });
const ordinaryReport = computed(() => eventData.value?.ordinaryReport);
const eventProjects = computed(() => eventData.value?.eventProjects ?? []);
const cover = computed(() => event.value?.image);
const coverCredit = computed(() => event.value?.image_credits);
function eventTypeLabel(type?: string | null) { return type ? $translateDynamic(`events.type.${type}`) : ''; }
useHead(() => ({ title: event.value?.title }));
</script>
<style scoped>
.event-detail { color: var(--slk-text, #505050); }
.event-detail__media { min-width: 0; border: 3px solid #505050; background: var(--slk-surface, white); }
.event-detail__media button:focus-visible { outline: 3px solid #16bae7; outline-offset: 3px; }
</style>

<template>
  <main v-if="event" class="event-detail mx-auto w-full max-w-3xl px-4 py-8">
    <NuxtLink :to="backHref" class="mb-6 inline-flex text-sm text-stats-dark hover:underline">← {{ backLabel }}</NuxtLink>
    <header class="mb-6">
      <span class="mb-3 inline-block text-xs font-bold uppercase text-olive-green">{{ eventTypeLabel(event.event_type) }}</span>
      <h1 class="mb-4 font-heading text-3xl font-black leading-tight sm:text-5xl">{{ report?.title || event.title }}</h1>
      <div class="mb-3 flex flex-wrap gap-4 text-sm">
        <time :datetime="event.start_date">{{ formatEventDateTimeRange(event.start_date, event.end_date, $locale, event.date_only) }}</time>
        <span v-if="event.location">{{ event.location }}</span>
      </div>
      <p v-if="event.event_category === 'internal'" class="event-detail__attendance">{{ $t('tour.internal_visit') }}</p>
      <p v-if="report?.author" class="mt-3 text-sm">{{ $t('article.author_date', { ':author': report.author, ':date': formatBerlinDate(report.date_published, $locale) }) }}</p>
      <p v-if="report?.teaser" class="mt-4 text-lg leading-relaxed">{{ report.teaser }}</p>
    </header>
    <figure v-if="cover" class="mb-8">
      <SmartImg :asset-base-url="report?.image ? '/api/tour-media' : undefined" :asset-id="relationId(cover)" :is-raster="isRaster(typeof cover === 'string' ? 'image/jpeg' : cover.type || 'image/jpeg')" :alt="report?.title || event.title" :width="1100" img-class="block max-h-[50svh] w-full object-contain" />
      <figcaption v-if="coverCredit" class="mt-2 text-xs">{{ coverCredit }}</figcaption>
    </figure>
    <p v-if="canEdit && report?.status !== 'published' && report" class="mb-4 bg-solid-orange-10 p-3">{{ $t('tour.report_draft') }}</p>
    <section v-if="report" class="prose max-w-none">
      <EventReportContent :key="report.id" :report="report" :can-edit="canEdit" />
    </section>
    <section v-if="media.length" class="my-8">
      <h2 class="mb-4 font-heading text-2xl font-bold">{{ $t('tour.media') }}</h2>
      <div class="grid gap-5 sm:grid-cols-2">
        <figure v-for="(item, index) in media" :key="item.id" class="event-detail__media">
          <button type="button" class="block w-full text-left" :aria-label="`${$t('tour.media_open')}: ${item.alt}`" @click="viewer?.open(media, index, report?.title || event.title)"><TourMediaPreview :item="item" /></button>
          <figcaption class="p-3 text-sm"><span v-if="item.caption" class="block">{{ item.caption }}</span><small>{{ item.credit }}</small></figcaption>
        </figure>
      </div>
    </section>
    <details v-if="report && event.description" class="my-8 border-y border-gray py-4">
      <summary class="cursor-pointer font-bold">{{ $t('tour.visit_details') }}</summary>
      <div class="prose mt-4 max-w-none" v-html="event.description" />
    </details>
    <div v-else-if="event.description" class="prose mb-8 max-w-none" v-html="event.description" />
    <CanonicalButton v-if="event.registration_url && event.event_category !== 'internal'" :href="event.registration_url" :label="event.cta_label || $t('events.register')" icon-slug="mdi:calendar-check" color="green" external />
    <CanonicalButton v-if="ordinaryReport" :href="`/news/${ordinaryReport.slug}`" :label="$t('tour.read_report')" color="dark" icon-slug="mdi:newspaper" />
    <nav v-if="event.series || eventProjects.length" class="mt-8 flex flex-wrap gap-3 border-t border-gray pt-6">
      <CanonicalButton v-if="event.series" :href="`/events/series/${event.series.slug}#stop-${event.slug}`" :label="$t('tour.back_to_series')" color="dark" icon-slug="mdi:map-marker-path" />
      <NuxtLink v-for="project in eventProjects" :key="project.id" :to="`/projects/${project.slug}`" class="self-center font-semibold text-stats-dark hover:underline">{{ project.title }} →</NuxtLink>
    </nav>
    <section v-if="canEdit && isTour" class="mt-8 border-t border-gray pt-6">
      <CanonicalButton v-if="!report" :label="$t('tour.report_create')" color="dark" icon-slug="mdi:pencil" :disabled="saving" @click="createReport" />
      <template v-else>
        <button type="button" class="mb-4 border border-gray px-3 py-2" @click="metadataOpen = !metadataOpen">{{ $t('tour.report_edit_metadata') }}</button>
        <form v-if="metadataOpen" class="mb-4 grid gap-3" @submit.prevent="saveReport(false)">
          <label>{{ $t('tour.report_title') }}<input v-model="metadata.title" required class="input input-bordered block w-full" /></label>
          <label>{{ $t('tour.report_teaser') }}<textarea v-model="metadata.teaser" class="textarea textarea-bordered block w-full" /></label>
          <label>{{ $t('tour.report_author') }}<input v-model="metadata.author" class="input input-bordered block w-full" /></label>
          <button type="submit" class="btn" :disabled="saving">{{ $t('tour.report_save') }}</button>
          <a :href="`${config.public.clientDirectusUrl}/admin/content/event_reports/${report.id}`" target="_blank" rel="noopener noreferrer" class="text-stats-dark underline">{{ $t('tour.media') }} ↗</a>
        </form>
        <CanonicalButton v-if="report.status !== 'published'" :label="$t('tour.report_publish')" color="green" icon-slug="mdi:publish" :disabled="saving" @click="saveReport(true)" />
      </template>
      <p v-if="saveError" role="alert" class="mt-3 text-red">{{ $t('tour.report_error') }}</p>
    </section>
    <TourMediaViewer ref="viewer" />
  </main>
</template>
<script setup lang="ts">
import { createItem, readItems, updateItem } from '@directus/sdk';
import { useAuth } from '~/composables/useAuth';
import { useReferrer } from '~/composables/useReferrer';
import { isRaster } from '~/shared/utils';
import { relationId } from '~/shared/tour';
import { formatBerlinDate, formatEventDateTimeRange } from '~/shared/eventDateTime';
import { REPORT_FIELDS, orderedMedia } from '~/shared/tourMedia';
import type { EventReport, MediaFile, TourMedia } from '~/shared/tourMedia';
type Event = { id: string; slug: string; title: string; description?: string; event_category?: string; event_type?: string; start_date: string; end_date?: string; date_only?: boolean; location?: string; image?: MediaFile; image_credits?: string; registration_url?: string; cta_label?: string; series?: { slug: string; title: string; format: string } };
const { $directus, $readItems, $t, $locale } = useNuxtApp();
const route = useRoute();
const config = useRuntimeConfig();
const { backHref, backLabel } = useReferrer('/events', $t('events.title'));
const { initialize, isAuthenticated, getAuthenticatedClient } = useAuth();
const { data: eventRows } = await useAsyncData(`event-${route.params.slug}`, () => $directus.request($readItems('events', {
  filter: { slug: { _eq: route.params.slug }, status: { _eq: 'published' } },
  fields: ['id', 'slug', 'title', 'description', 'event_category', 'event_type', 'start_date', 'end_date', 'date_only', 'location', 'registration_url', 'cta_label', 'image_credits', { image: ['id', 'type'] }, { series: ['slug', 'title', 'format'] }], limit: 1,
})));
const event = computed(() => eventRows.value?.[0] as Event | undefined);
if (!event.value) throw createError({ statusCode: 404, statusMessage: $t('events.not_found'), fatal: true });
const isTour = computed(() => event.value?.series?.format === 'tour');
const { data: reports } = await useAsyncData(`event-report-${event.value.id}`, () => $directus.request($readItems('event_reports', {
  filter: { event: { _eq: event.value!.id }, status: { _eq: 'published' } }, fields: REPORT_FIELDS, limit: 1,
})));
const { data: ordinaryReports } = await useAsyncData(`ordinary-event-report-${event.value.id}`, () => isTour.value ? Promise.resolve([]) : $directus.request($readItems('news_items', {
  filter: { report_event: { _eq: event.value!.id }, status: { _eq: 'published' }, is_event_redirect: { _eq: false } }, fields: ['slug'], limit: 1,
})));
const ordinaryReport = computed(() => ordinaryReports.value?.[0]);
const report = ref<EventReport | null>((reports.value?.[0] as EventReport) || null);
const { data: projectLinks } = await useAsyncData(`event-projects-${event.value.id}`, () => $directus.request($readItems('events_articles', {
  filter: { events_id: { _eq: event.value!.id } }, fields: [{ articles_id: ['id', 'slug', 'title'] }], limit: -1,
})));
const eventProjects = computed(() => (projectLinks.value ?? []).map(link => link.articles_id).filter(Boolean));
const cover = computed(() => report.value?.image || event.value?.image);
const coverCredit = computed(() => report.value?.image ? report.value.image_credits : event.value?.image_credits);
const media = computed(() => orderedMedia(report.value));
const viewer = ref<{ open: (media: TourMedia[], index: number, title: string) => void } | null>(null);
const canEdit = ref(false);
const saving = ref(false);
const saveError = ref(false);
const metadataOpen = ref(false);
const metadata = reactive({ title: '', teaser: '', author: '' });
watch(report, value => Object.assign(metadata, { title: value?.title || event.value?.title || '', teaser: value?.teaser || '', author: value?.author || '' }), { immediate: true });
onMounted(async () => {
  await initialize();
  if (!isAuthenticated.value || !isTour.value) return;
  try {
    const rows = await getAuthenticatedClient().request(readItems('event_reports', { filter: { event: { _eq: event.value!.id } }, fields: REPORT_FIELDS, limit: 1 }));
    report.value = (rows?.[0] as EventReport) || report.value;
    canEdit.value = true;
  } catch { /* Readers without report permissions retain the public view. */ }
});
async function createReport() {
  saving.value = true; saveError.value = false;
  try {
    const row = await getAuthenticatedClient().request(createItem('event_reports', { event: event.value!.id, status: 'draft', title: event.value!.title }));
    report.value = row as EventReport;
    metadataOpen.value = true;
  } catch { saveError.value = true; } finally { saving.value = false; }
}
async function saveReport(publish: boolean) {
  if (!report.value || !metadata.title.trim()) return;
  saving.value = true; saveError.value = false;
  try {
    await getAuthenticatedClient().request(updateItem('event_reports', report.value.id, {
      title: metadata.title.trim(), teaser: metadata.teaser.trim(), author: metadata.author.trim(),
      ...(publish ? { status: 'published', date_published: report.value.date_published || new Date().toISOString() } : {}),
    }));
    report.value = { ...report.value, ...metadata, ...(publish ? { status: 'published' } : {}) };
  } catch { saveError.value = true; } finally { saving.value = false; }
}
function eventTypeLabel(type?: string) { return type ? $t(`events.type.${type}`) : ''; }
useHead(() => ({ title: report.value?.title || event.value?.title }));
</script>
<style scoped>
.event-detail { color: var(--slk-text, #505050); }
.event-detail__attendance { display: inline-block; border-left: 4px solid #afca0b; padding: .5rem .75rem; background: var(--slk-surface-subtle, #e6f1f4); font-weight: 700; }
.event-detail__media { min-width: 0; border: 3px solid #505050; background: var(--slk-surface, white); }
.event-detail__media button:focus-visible { outline: 3px solid #16bae7; outline-offset: 3px; }
</style>

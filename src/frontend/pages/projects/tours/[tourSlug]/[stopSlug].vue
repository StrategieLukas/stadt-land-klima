<template>
  <main v-if="stop" class="event-detail mx-auto w-full max-w-3xl px-4 py-8">
    <NuxtLink :to="tourHref(stop.tour)" class="mb-6 inline-flex text-sm text-stats-dark hover:underline">← {{ $t('tour.back_to_series', { ':title': stop.tour.title }) }}</NuxtLink>
    <header class="mb-6">
      <span class="mb-3 inline-block text-xs font-bold uppercase text-olive-green">{{ $t('tour.stop') }}</span>
      <h1 class="mb-4 font-heading text-3xl font-black leading-tight sm:text-5xl">{{ reportVisible && stop.report_title ? stop.report_title : stop.title }}</h1>
      <div class="mb-3 flex flex-wrap gap-4 text-sm">
        <time :datetime="stop.start_date">{{ formatEventDateTimeRange(stop.start_date, stop.end_date, $locale, stop.date_only) }}</time>
        <span v-if="stop.location">{{ stop.location }}</span>
      </div>
      <p v-if="reportVisible && stop.author" class="mt-3 text-sm">{{ $t('article.author_date', { ':author': stop.author, ':date': formatBerlinDate(stop.date_published, $locale) }) }}</p>
      <p v-if="reportVisible && stop.teaser" class="mt-4 text-lg leading-relaxed">{{ stop.teaser }}</p>
    </header>
    <figure v-if="cover" class="event-detail__cover mb-8">
      <SmartImg :access-token="previewToken" :asset-base-url="reportVisible && stop.image ? '/api/tour-media' : undefined" :asset-id="relationId(cover)" :is-raster="isRaster(typeof cover === 'string' ? 'image/jpeg' : cover.type || 'image/jpeg')" :alt="stop.report_title || stop.title" :width="1100" img-class="block max-h-[50svh] w-full object-contain" />
      <figcaption v-if="coverCredit" class="mt-2 text-xs">{{ coverCredit }}</figcaption>
    </figure>
    <p v-if="canEdit && stop.report_status !== 'published'" class="mb-4 bg-solid-orange-10 p-3">{{ $t('tour.report_draft') }}</p>
    <section v-if="reportVisible" class="prose max-w-none">
      <SuccessProjectTourContent :key="stop.id" :stop="stop" :can-edit="canEdit" :preview-token="previewToken" />
    </section>
    <p v-else class="mb-6">{{ $t('tour.report_pending') }}</p>
    <section v-if="media.length" class="my-8">
      <h2 class="mb-4 font-heading text-2xl font-bold">{{ $t('tour.media') }}</h2>
      <div class="grid gap-5 sm:grid-cols-2">
        <figure v-for="(item, index) in media" :key="item.id" class="event-detail__media">
          <button type="button" class="block w-full text-left" :aria-label="`${$t('tour.media_open')}: ${item.alt}`" @click="viewer?.open(media, index, stop.report_title || stop.title)"><TourMediaPreview :item="item" :preview-token="previewToken" /></button>
          <figcaption class="p-3 text-sm"><span v-if="item.caption" class="block">{{ item.caption }}</span><small>{{ item.credit }}</small></figcaption>
        </figure>
      </div>
    </section>
    <nav class="event-detail__related mt-8 flex flex-wrap gap-3">
      <CanonicalButton class="max-w-full !whitespace-normal" :href="`${tourHref(stop.tour)}#stop-${stop.slug}`" :label="$t('tour.back_to_series', { ':title': stop.tour.title })" color="dark" icon-slug="mdi:map-marker-path" />
      <CanonicalButton v-for="project in projects" :key="project.id" class="max-w-full !whitespace-normal" :href="`/projects/${project.slug}`" :label="projects.length === 1 ? $t('tour.visit_project') : `${$t('tour.visit_project')} ${project.title}`" :title="project.title" icon-slug="mdi:leaf" color="blue" />
    </nav>
    <section v-if="canEdit" class="mt-8 border-t border-gray pt-6">
      <button type="button" class="mb-4 border border-gray px-3 py-2" @click="metadataOpen = !metadataOpen">{{ $t('tour.report_edit_metadata') }}</button>
      <form v-if="metadataOpen" class="mb-4 grid gap-3" @submit.prevent="saveStop(false)">
        <label>{{ $t('tour.visit_title') }}<input v-model="metadata.title" required class="input input-bordered block w-full" /></label>
        <label>{{ $t('tour.location') }}<input v-model="metadata.location" class="input input-bordered block w-full" /></label>
        <label>{{ $t('tour.state') }}<input v-model="metadata.state" class="input input-bordered block w-full" /></label>
        <label>{{ $t('tour.start_date') }}<input v-model="metadata.start_date" type="datetime-local" required class="input input-bordered block w-full" /></label>
        <label>{{ $t('tour.end_date') }}<input v-model="metadata.end_date" type="datetime-local" class="input input-bordered block w-full" /></label>
        <label class="flex items-center gap-2"><input v-model="metadata.date_only" type="checkbox" class="checkbox" />{{ $t('tour.date_only') }}</label>
        <label>{{ $t('tour.report_title') }}<input v-model="metadata.report_title" class="input input-bordered block w-full" /></label>
        <label>{{ $t('tour.report_teaser') }}<textarea v-model="metadata.teaser" class="textarea textarea-bordered block w-full" /></label>
        <label>{{ $t('tour.report_author') }}<input v-model="metadata.author" class="input input-bordered block w-full" /></label>
        <label>{{ $t('tour.stop_status') }}<select v-model="metadata.status" class="select select-bordered block w-full"><option v-for="value in statuses" :key="value" :value="value">{{ $t(`status.${value}`) }}</option></select></label>
        <label>{{ $t('tour.report_status') }}<select v-model="metadata.report_status" class="select select-bordered block w-full"><option v-for="value in statuses" :key="value" :value="value">{{ $t(`status.${value}`) }}</option></select></label>
        <button type="submit" class="btn" :disabled="saving">{{ $t('tour.report_save') }}</button>
        <a :href="`${config.public.clientDirectusUrl}/admin/content/success_project_tour_stops/${stop.id}`" target="_blank" rel="noopener noreferrer" class="text-stats-dark underline">{{ $t('tour.media') }} ↗</a>
      </form>
      <CanonicalButton v-if="stop.report_status !== 'published'" :label="$t('tour.report_publish')" color="green" icon-slug="mdi:publish" :disabled="saving" @click="saveStop(true)" />
      <p v-if="saveError" role="alert" class="mt-3 text-red">{{ $t('tour.report_error') }}</p>
    </section>
    <TourMediaViewer ref="viewer" :preview-token="previewToken" />
  </main>
  <p v-else-if="authChecked" class="container mx-auto py-8">{{ $t('page_not_found') }}</p>
</template>
<script setup lang="ts">
import { customEndpoint, readItems, updateItem } from '@directus/sdk';
import { useAuth } from '~/composables/useAuth';
import { useAuthStore } from '~/stores/auth';
import { isRaster } from '~/shared/utils';
import { relationId } from '~/shared/tour';
import { formatBerlinDate, formatEventDateTimeRange } from '~/shared/eventDateTime';
import { orderedMedia } from '~/shared/tourMedia';
import type { TourMedia } from '~/shared/tourMedia';
import { STOP_FIELDS, publicStopFilter, tourHref } from '~/shared/successProjectTour';
import type { SuccessProjectTourStop, SuccessProjectTour } from '~/shared/successProjectTour';
const { $t, $locale } = useNuxtApp();
const route = useRoute();
const config = useRuntimeConfig();
const { initialize, isAuthenticated, getAuthenticatedClient } = useAuth();
const filter = { slug: { _eq: route.params.stopSlug }, tour: { slug: { _eq: route.params.tourSlug } } };
const { data: rows } = await useAsyncData(`tour-stop-${route.params.tourSlug}-${route.params.stopSlug}`, async () => {
  const { series } = await $fetch<{ series: SuccessProjectTour | null }>('/api/public/tour-detail', { query: { slug: String(route.params.tourSlug) } });
  if (!series) return [];
  const { stops } = await $fetch<{ stops: SuccessProjectTourStop[] }>('/api/public/tour-stops-by-tour', { query: { tourId: series.id } });
  return stops.filter(stop => stop.slug === route.params.stopSlug);
});
const stop = ref<SuccessProjectTourStop | null>((rows.value?.[0] as SuccessProjectTourStop) || null);
if (!stop.value && import.meta.server) useRequestEvent()!.node.res.statusCode = 404;
const authChecked = ref(false);
const canEdit = ref(false);
const previewToken = computed(() => canEdit.value ? useAuthStore()._accessToken.value : null);
const reportVisible = computed(() => Boolean(stop.value && (canEdit.value || stop.value.report_status === 'published')));
const cover = computed(() => (reportVisible.value ? stop.value?.image : null) || stop.value?.itinerary_image);
const coverCredit = computed(() => reportVisible.value && stop.value?.image ? stop.value.image_credits : stop.value?.itinerary_image_credits);
const media = computed(() => reportVisible.value ? orderedMedia(stop.value) : []);
const { data: links } = await useAsyncData(`tour-stop-projects-${route.params.stopSlug}`, () => stop.value ? $fetch<{ articles_id: { id: string; slug: string; title: string } | null }[]>('/api/public/tour-stop-articles', { query: { stopIds: stop.value.id } }) : Promise.resolve([]));
const projects = computed(() => (links.value || []).map(link => link.articles_id).filter((project): project is NonNullable<typeof project> => Boolean(project)));
const viewer = ref<{ open: (media: TourMedia[], index: number, title: string) => void } | null>(null);
const saving = ref(false);
const saveError = ref(false);
const metadataOpen = ref(false);
const statuses = ['draft','published','archived'];
const metadata = reactive({title:'',location:'',state:'',start_date:'',end_date:'',date_only:false,status:'draft',report_status:'draft',report_title:'',teaser:'',author:''});
const localDate = (value?: string | null) => value ? new Date(new Date(value).getTime() - new Date(value).getTimezoneOffset()*60000).toISOString().slice(0,16) : '';
watch(stop, value => { if (value) Object.assign(metadata, {...value,start_date:localDate(value.start_date),end_date:localDate(value.end_date),report_title:value.report_title||'',teaser:value.teaser||'',author:value.author||''}); }, {immediate:true});
onMounted(async () => {
  try {
    await initialize();
    if (!isAuthenticated.value) return;
    const client = getAuthenticatedClient();
    const permissions = await client.request(customEndpoint<Record<string, Record<string, {access:string}>>>({path:'/permissions/me',method:'GET'}));
    if (!permissions.success_project_tour_stops?.update || permissions.success_project_tour_stops.update.access === 'none') return;
    const draft = await client.request(readItems('success_project_tour_stops', {filter,fields:[...STOP_FIELDS,'legacy_report_id','source_news_item'],limit:1}));
    if (draft[0]) { stop.value = draft[0] as SuccessProjectTourStop; canEdit.value = true; }
  } catch { /* Readers without editor permissions retain the published view. */ } finally { authChecked.value = true; }
});
async function saveStop(publish: boolean) {
  if (!stop.value || !metadata.title.trim()) return;
  saving.value = true; saveError.value = false;
  try {
    const payload = {title:metadata.title.trim(),location:metadata.location?.trim(),state:metadata.state?.trim(),start_date:new Date(metadata.start_date).toISOString(),end_date:metadata.end_date?new Date(metadata.end_date).toISOString():null,date_only:metadata.date_only,status:metadata.status,
      report_title:metadata.report_title.trim(),teaser:metadata.teaser.trim(),author:metadata.author.trim(),report_status:publish?'published':metadata.report_status,
      date_published:(publish||metadata.report_status==='published') ? stop.value.date_published || new Date().toISOString() : stop.value.date_published};
    const saved = await getAuthenticatedClient().request(updateItem('success_project_tour_stops', stop.value.id, payload, {fields:[...STOP_FIELDS,'legacy_report_id','source_news_item']}));
    stop.value = saved as SuccessProjectTourStop;
  } catch { saveError.value = true; } finally { saving.value = false; }
}
useHead(() => ({title: reportVisible.value && stop.value?.report_title ? stop.value.report_title : stop.value?.title}));
</script>
<style scoped>
.event-detail { color: var(--slk-text, #505050); }
.event-detail__media { min-width: 0; border: 3px solid #505050; background: var(--slk-surface, white); }
.event-detail__media button:focus-visible { outline: 3px solid #16bae7; outline-offset: 3px; }
</style>

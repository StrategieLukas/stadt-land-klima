<template>
  <div v-if="event" class="flex flex-col items-center py-8 w-full">
    <div class="max-w-2xl w-full">
    <!-- Back link -->
    <NuxtLink :to="backHref" class="text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1 mb-6">
      <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
      </svg>
      {{ backLabel }}
    </NuxtLink>

    <!-- Teaser image -->
    <div v-if="event.image" class="rounded-xl overflow-hidden mb-6">
      <SmartImg
        :assetId="event.image?.id || event.image"
        :isRaster="event.image?.type ? isRaster(event.image.type) : true"
        :alt="event.title"
        :width="800"
        img-class="w-full h-auto block"
      />
    </div>
    <p v-if="event.image_credits" class="text-xs text-gray-500 italic mb-6 text-center">{{ event.image_credits }}</p>

    <!-- Type badge -->
    <span class="text-xs font-semibold uppercase tracking-wide px-3 py-1 rounded-full bg-light-green/10 text-olive-green mb-4 inline-block">
      {{ eventTypeLabel(event.event_type) }}
    </span>

    <h1 class="text-3xl font-bold text-gray-900 mb-4 leading-tight">{{ event.title }}</h1>

    <!-- Meta info -->
    <div class="flex flex-wrap gap-4 text-sm text-gray-600 mb-6">
      <div class="flex items-center gap-1">
        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span>{{ formatEventDateTimeRange(event.start_date, event.end_date, $locale, event.date_only) }}</span>
      </div>
      <div v-if="event.location" class="flex items-center gap-1">
        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        {{ event.location }}
      </div>
    </div>

    <!-- Description -->
    <div
      v-if="event.description"
      class="prose prose-gray max-w-none mb-8"
      v-html="event.description"
    />

    <!-- Registration button -->
    <a
      v-if="event.registration_url"
      :href="event.registration_url"
      target="_blank"
      rel="noopener noreferrer"
      class="inline-flex items-center gap-2 px-6 py-3 bg-light-green text-white font-bold rounded hover:bg-olive-green transition-colors"
    >
      {{ event.cta_label || 'Zur Anmeldung' }}
      <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
    </a>
    <div v-if="event.series || eventProjects.length || report" class="mt-8 border-t border-gray-200 pt-6">
      <NuxtLink v-if="event.series" :to="`/events/series/${event.series.slug}#stop-${event.slug}`" class="mb-4 block font-semibold text-stats-dark hover:underline">
        {{ $t('tour.back_to_series') }}: {{ event.series.title }} →
      </NuxtLink>
      <div v-if="eventProjects.length" class="mb-4 flex flex-wrap gap-2">
        <NuxtLink v-for="project in eventProjects" :key="project.id" :to="`/projects/${project.slug}`" class="btn btn-sm btn-outline border-stats-dark text-stats-dark">
          {{ project.title }}
        </NuxtLink>
      </div>
      <NuxtLink v-if="report" :to="`/news/${report.slug}`" class="font-semibold text-stats-dark hover:underline">
        {{ $t('tour.read_report') }} →
      </NuxtLink>
    </div>
    </div><!-- /.max-w-2xl -->
  </div>

  <div v-else class="py-8 text-gray-500">
    Veranstaltung nicht gefunden.
  </div>
</template>

<script setup>
import { useReferrer } from '~/composables/useReferrer'
import { isRaster } from '~/shared/utils'
import { formatEventDateTimeRange } from '~/shared/eventDateTime'
const { $directus, $readItems, $t, $locale } = useNuxtApp()
const config = useRuntimeConfig()
const directusUrl = config.public.clientDirectusUrl
const { backHref, backLabel } = useReferrer('/events', 'Alle Veranstaltungen')
const route = useRoute()

const { data: event } = await useAsyncData(`event-${route.params.slug}`, () =>
  $directus.request($readItems('events', {
    filter: {
      slug: { _eq: route.params.slug },
      status: { _eq: 'published' },
    },
    fields: ['id', 'title', 'slug', 'description', 'start_date', 'end_date', 'date_only', 'location', 'event_type', 'registration_url', 'cta_label', 'image_credits', { image: ['id', 'type'] }, { series: ['slug', 'title'] }],
    limit: 1,
  })).then(data => {
    return data?.[0] ?? false
  })
)

if (!event.value) {
  throw createError({ statusCode: 404, statusMessage: 'Veranstaltung nicht gefunden', fatal: true })
}

const [{ data: projectLinks }, { data: reports }] = await Promise.all([
  useAsyncData(`event-projects-${event.value.id}`, () => $directus.request($readItems('events_articles', {
    filter: { events_id: { _eq: event.value.id } },
    fields: [{ articles_id: ['id', 'slug', 'title'] }],
    limit: -1,
  }))),
  useAsyncData(`event-report-${event.value.id}`, () => $directus.request($readItems('news_items', {
    filter: { report_event: { _eq: event.value.id }, status: { _eq: 'published' } },
    fields: ['slug', 'title'],
    limit: 1,
  }))),
])
const eventProjects = computed(() => (projectLinks.value ?? []).map((link) => link.articles_id).filter(Boolean))
const report = computed(() => reports.value?.[0] ?? null)

useHead({ title: event.value?.title ?? 'Veranstaltung' })

function eventTypeLabel(type) {
  if (!type) return ''
  const translated = $t(`events.type.${type}`)
  return translated === `events.type.${type}` ? type : translated
}
</script>

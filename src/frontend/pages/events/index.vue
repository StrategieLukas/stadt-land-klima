<template>
  <div class="py-8">
    <h1 class="text-3xl font-bold mb-8">{{ $t('events.title') || 'Veranstaltungen' }}</h1>

    <div v-if="!events || !events.length" class="text-gray-500 italic">
      Aktuell sind keine Veranstaltungen geplant.
    </div>

    <!-- Grouped by month -->
    <div v-for="group in groupedEvents" :key="group.monthKey" class="mb-10">
      <h2 class="text-lg font-semibold text-gray-600 mb-4 uppercase tracking-wide border-b border-gray-200 pb-2">
        {{ group.label }}
      </h2>
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <NuxtLink
          v-for="event in group.events"
          :key="event.id"
          :to="`/events/${event.slug}`"
          class="block bg-white rounded-lg shadow-sm border border-gray-100 p-5 hover:shadow-md hover:border-light-green transition-all"
        >
          <div class="flex items-start justify-between gap-2 mb-2">
            <span class="text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-light-green/10 text-olive-green">
              {{ eventTypeLabel(event.event_type) }}
            </span>
          </div>
          <h3 class="font-bold text-gray-900 mb-1 leading-snug">{{ event.title }}</h3>
          <div class="text-sm text-gray-500 flex items-center gap-1">
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {{ formatDate(event.start_date) }}
            <span v-if="event.location" class="ml-1">· {{ event.location }}</span>
          </div>
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
const { $directus, $readItems, $t } = useNuxtApp()

useHead({ title: 'Veranstaltungen' })

const { data: events } = await useAsyncData('events-list', () =>
  $directus.request($readItems('events', {
    filter: { status: { _eq: 'published' } },
    fields: ['id', 'title', 'slug', 'start_date', 'end_date', 'location', 'event_type'],
    sort: ['start_date'],
    limit: -1,
  }))
)

const eventTypeLabels = { conference: 'Konferenz', workshop: 'Workshop', webinar: 'Webinar', other: 'Sonstiges' }
function eventTypeLabel(type) { return eventTypeLabels[type] ?? type ?? '' }

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })
}

const groupedEvents = computed(() => {
  if (!events.value) return []
  const map = new Map()
  for (const ev of events.value) {
    const d = new Date(ev.start_date)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
    if (!map.has(key)) map.set(key, { monthKey: key, label, events: [] })
    map.get(key).events.push(ev)
  }
  return [...map.values()]
})
</script>

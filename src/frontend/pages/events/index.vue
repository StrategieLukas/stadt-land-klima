<template>
  <div class="py-8">
    <h1 class="text-3xl font-bold mb-8">{{ $t('events.title') || 'Veranstaltungen' }}</h1>

    <div class="flex gap-8 items-start">

      <!-- Left sticky sidebar -->
      <nav
        class="hidden xl:block w-44 flex-shrink-0 sticky text-sm self-start"
        :style="`top: ${headerHeight + 12}px`"
      >
        <p class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Abschnitte</p>
        <ul class="space-y-1">
          <li v-if="currentEvents.length">
            <a
              href="#section-laufend"
              :class="[
                'block px-2 py-1 rounded transition-colors truncate',
                activeSection === 'section-laufend'
                  ? 'text-orange-600 font-semibold bg-orange-50'
                  : 'text-gray-400 hover:text-gray-700 hover:bg-gray-50',
              ]"
            >Laufende Veranstaltungen</a>
          </li>
          <li v-for="group in futureGroups" :key="group.monthKey">
            <a
              :href="`#section-${group.monthKey}`"
              :class="[
                'block px-2 py-1 rounded transition-colors truncate',
                activeSection === `section-${group.monthKey}`
                  ? 'text-[#006e94] font-semibold bg-[#006e94]/5'
                  : 'text-gray-400 hover:text-gray-700 hover:bg-gray-50',
              ]"
            >{{ group.label }}</a>
          </li>
          <li v-for="group in pastGroups" :key="group.monthKey">
            <a
              :href="`#section-${group.monthKey}`"
              :class="[
                'block px-2 py-1 rounded transition-colors truncate',
                activeSection === `section-${group.monthKey}`
                  ? 'text-gray-600 font-semibold bg-gray-100'
                  : 'text-gray-400 hover:text-gray-700 hover:bg-gray-50',
              ]"
            >{{ group.label }}</a>
          </li>
        </ul>
      </nav>

      <!-- Main content -->
      <div class="flex-1 min-w-0">

        <!-- Currently happening -->
        <div
          v-if="currentEvents.length"
          id="section-laufend"
          class="mb-10"
          :style="`scroll-margin-top: ${headerHeight + 16}px`"
        >
          <h2 class="text-base font-semibold text-orange-600 uppercase tracking-wide border-b border-orange-200 pb-2 mb-4 flex items-center">
            <span class="inline-block w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
            Laufende Veranstaltungen
          </h2>
          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <NuxtLink
              v-for="event in currentEvents"
              :key="event.id"
              :to="`/events/${event.slug}`"
              class="block bg-white rounded-lg shadow-sm border border-orange-200 overflow-hidden hover:shadow-md hover:border-orange-400 transition-all"
            >
              <div v-if="event.image" class="relative h-40 bg-gray-100 overflow-hidden">
                <img :src="`${directusUrl}/assets/${event.image}?width=600&quality=80`" :alt="event.title" class="w-full h-full object-cover" />
              </div>
              <div v-else class="relative h-40 bg-gradient-to-br from-orange-50 to-orange-100 flex items-center justify-center">
                <svg class="w-14 h-14 text-orange-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </div>
              <div class="p-5">
                <span class="text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 mb-2 inline-block">
                  {{ eventTypeLabel(event.event_type) }}
                </span>
                <h3 class="font-bold text-gray-900 mb-1 leading-snug">{{ event.title }}</h3>
                <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500">
                  <span class="flex items-center gap-1">
                    <svg class="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {{ formatDateRange(event.start_date, event.end_date) }}
                  </span>
                  <span v-if="event.location" class="flex items-center gap-1">
                    <svg class="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {{ event.location }}
                  </span>
                </div>
              </div>
            </NuxtLink>
          </div>
        </div>

        <!-- Upcoming events grouped by month -->
        <div v-if="futureGroups.length">
          <div
            v-for="group in futureGroups"
            :key="group.monthKey"
            :id="`section-${group.monthKey}`"
            class="mb-10"
            :style="`scroll-margin-top: ${headerHeight + 16}px`"
          >
            <h2 class="text-base font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200 pb-2 mb-4">
              {{ group.label }}
            </h2>
            <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <NuxtLink
                v-for="event in group.events"
                :key="event.id"
                :to="`/events/${event.slug}`"
                class="block bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden hover:shadow-md hover:border-light-green transition-all"
              >
                <div v-if="event.image" class="relative h-40 bg-gray-100 overflow-hidden">
                  <img :src="`${directusUrl}/assets/${event.image}?width=600&quality=80`" :alt="event.title" class="w-full h-full object-cover" />
                </div>
                <div class="p-5">
                  <span class="text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-light-green/10 text-olive-green mb-2 inline-block">
                    {{ eventTypeLabel(event.event_type) }}
                  </span>
                  <h3 class="font-bold text-gray-900 mb-1 leading-snug">{{ event.title }}</h3>
                  <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500">
                    <span class="flex items-center gap-1">
                      <svg class="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {{ formatDateRange(event.start_date, event.end_date) }}
                    </span>
                    <span v-if="event.location" class="flex items-center gap-1">
                      <svg class="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 16 0z" />
                      </svg>
                      {{ event.location }}
                    </span>
                  </div>
                </div>
              </NuxtLink>
            </div>
          </div>
        </div>
        <div v-else-if="!currentEvents.length" class="text-gray-500 italic mb-8">
          Aktuell sind keine kommenden Veranstaltungen geplant.
        </div>

        <!-- Past events -->
        <div
          v-if="pastGroups.length"
          id="section-vergangen"
          class="mt-10"
          :style="`scroll-margin-top: ${headerHeight + 16}px`"
        >
          <h2 class="text-base font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100 pb-2 mb-6">
            Vergangene Veranstaltungen
          </h2>
          <div
            v-for="group in pastGroups"
            :key="group.monthKey"
            :id="`section-${group.monthKey}`"
            class="mb-10"
            :style="`scroll-margin-top: ${headerHeight + 16}px`"
          >
            <h2 class="text-sm font-semibold text-gray-400 mb-4 uppercase tracking-wide border-b border-gray-100 pb-2">
              {{ group.label }}
            </h2>
            <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <NuxtLink
                v-for="event in group.events"
                :key="event.id"
                :to="`/events/${event.slug}`"
                class="block bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden hover:shadow-md hover:border-gray-300 transition-all opacity-70"
              >
                <div v-if="event.image" class="relative h-40 bg-gray-100 overflow-hidden">
                  <img :src="`${directusUrl}/assets/${event.image}?width=600&quality=80`" :alt="event.title" class="w-full h-full object-cover grayscale" />
                </div>
                <div class="p-5">
                  <span class="text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 mb-2 inline-block">
                    {{ eventTypeLabel(event.event_type) }}
                  </span>
                  <h3 class="font-bold text-gray-700 mb-1 leading-snug">{{ event.title }}</h3>
                  <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-400">
                    <span class="flex items-center gap-1">
                      <svg class="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {{ formatDateRange(event.start_date, event.end_date) }}
                    </span>
                    <span v-if="event.location" class="flex items-center gap-1">
                      <svg class="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {{ event.location }}
                    </span>
                  </div>
                </div>
              </NuxtLink>
            </div>
          </div>
        </div>

      </div><!-- /main content -->
    </div><!-- /flex layout -->
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useHeaderHeight } from '~/composables/useHeaderHeight.js'
const { $directus, $readItems, $t } = useNuxtApp()
const config = useRuntimeConfig()
const directusUrl = config.public.clientDirectusUrl
const headerHeight = useHeaderHeight()

useHead({ title: 'Veranstaltungen' })

const { data: events } = await useAsyncData('events-list', () =>
  $directus.request($readItems('events', {
    filter: { status: { _eq: 'published' } },
    fields: ['id', 'title', 'slug', 'start_date', 'end_date', 'location', 'event_type', 'image'],
    sort: ['start_date'],
    limit: -1,
  }))
)

const eventTypeLabels = { conference: 'Konferenz', workshop: 'Workshop', webinar: 'Webinar', other: 'Sonstiges' }
function eventTypeLabel(type) { return eventTypeLabels[type] ?? type ?? '' }

function formatDateRange(startIso, endIso) {
  if (!startIso) return ''
  const start = new Date(startIso)
  const end = endIso ? new Date(endIso) : null
  if (!end || end.toDateString() === start.toDateString()) {
    return start.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })
  }
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${start.getDate()}. – ${end.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}`
  }
  if (start.getFullYear() === end.getFullYear()) {
    return `${start.toLocaleDateString('de-DE', { day: '2-digit', month: 'long' })} – ${end.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}`
  }
  return `${start.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })} – ${end.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}`
}

const now = new Date()

// Events currently happening: started but not yet ended
const currentEvents = computed(() =>
  (events.value || []).filter(e => {
    if (!e.start_date) return false
    const start = new Date(e.start_date)
    const end = e.end_date ? new Date(e.end_date) : null
    return start <= now && end && end >= now
  })
)

// Strictly future events (start_date > now)
const futureEvents = computed(() =>
  (events.value || []).filter(e => e.start_date && new Date(e.start_date) > now)
)

// Past events (end_date < now, or no end_date and start_date < now)
const pastEvents = computed(() =>
  (events.value || []).filter(e => {
    if (!e.start_date) return false
    const start = new Date(e.start_date)
    const end = e.end_date ? new Date(e.end_date) : null
    if (end) return end < now
    return start < now
  })
)

function groupByMonth(evList) {
  const map = new Map()
  for (const ev of evList) {
    const d = new Date(ev.start_date)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
    if (!map.has(key)) map.set(key, { monthKey: key, label, events: [] })
    map.get(key).events.push(ev)
  }
  return [...map.values()]
}

const futureGroups = computed(() => groupByMonth(futureEvents.value))
const pastGroups = computed(() => {
  const sorted = [...pastEvents.value].sort((a, b) => new Date(b.start_date) - new Date(a.start_date))
  return groupByMonth(sorted)
})

// ── Section nav active tracking ────────────────────────────────────────────────
const activeSection = ref(null)
let sectionObserver = null

onMounted(() => {
  const observe = () => {
    const sections = document.querySelectorAll('[id^="section-"]')
    if (!sections.length) return
    sectionObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) activeSection.value = entry.target.id
        }
      },
      { rootMargin: '-20% 0px -70% 0px', threshold: 0 },
    )
    sections.forEach(s => sectionObserver.observe(s))
  }
  setTimeout(observe, 100)
})

onUnmounted(() => { sectionObserver?.disconnect() })
</script>

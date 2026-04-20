<template>
  <div class="py-8">
    <!-- Header row: title + admin create button -->
    <div class="flex items-start justify-between gap-4 mb-2">
      <h1 class="text-3xl font-bold text-[#006e94]">News</h1>
      <button
        v-if="isAuthenticated"
        type="button"
        :disabled="creating"
        @click="createNewsItem"
        class="flex-shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 disabled:opacity-50 transition-colors"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        {{ creating ? 'Erstelle…' : 'Neuigkeit erstellen' }}
      </button>
    </div>
    <p class="text-gray-500 mb-8">Aktuelle Meldungen, Veranstaltungen, neue Kommunen und Projekte.</p>

    <!-- Type filter pills -->
    <div class="flex flex-wrap gap-2 mb-6">
      <button
        type="button"
        @click="activeFilter = null"
        :class="[
          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors whitespace-nowrap',
          activeFilter === null
            ? 'bg-[#374151] text-white border-[#374151]'
            : 'bg-[#e5e7eb] text-[#374151] border-[#e5e7eb] hover:bg-[#d1d5db]',
        ]"
      >
        Alle
      </button>
      <button
        v-for="f in filterOptions"
        :key="f.value"
        type="button"
        @click="activeFilter = f.value"
        :class="[
          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors whitespace-nowrap',
          activeFilter === f.value
            ? f.activeClass
            : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400',
        ]"
      >
        {{ f.label }}
      </button>
    </div>

    <div v-if="visibleItems.length === 0" class="text-gray-400 italic">
      Keine Einträge gefunden.
    </div>

    <div v-for="group in groupedByMonth" :key="group.monthKey" class="mb-10">
      <!-- Month heading -->
      <h2 class="text-base font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200 pb-2 mb-4">
        {{ group.label }}
      </h2>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <component
        v-for="item in group.items"
        :is="item.href ? NuxtLinkComponent : 'div'"
        :key="`${item.type}-${item.id}`"
        :to="item.href || undefined"
        :class="item.href
          ? 'group flex flex-col bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden cursor-pointer hover:shadow-md hover:border-[#16BAE7]/60 focus-visible:ring-2 focus-visible:ring-[#16BAE7] focus-visible:outline-none transition-all duration-150'
          : 'flex flex-col bg-gray-50 rounded-lg border border-dashed border-gray-200 overflow-hidden opacity-80'
        "
      >
        <!-- Thumbnail -->
        <div :class="item.href ? 'relative h-40 bg-gray-50 flex-shrink-0 overflow-hidden' : 'relative h-40 bg-gray-100 flex-shrink-0 flex items-center justify-center'">
          <!-- Catalog: gray gradient with all sector icons -->
          <div
            v-if="item.type === 'catalog'"
            class="absolute inset-0 bg-gradient-to-br from-[#6b7280]/25 via-[#6b7280]/10 to-[#6b7280]/35 flex items-center justify-center"
          >
            <div class="grid grid-cols-3 gap-3 px-6">
              <img v-for="(src, key) in sectorImages" :key="key" :src="src" :alt="key" class="w-10 h-10 opacity-40" />
            </div>
          </div>
          <!-- Event: green gradient with calendar icon -->
          <div
            v-else-if="item.type === 'event' && !item.imageId"
            class="absolute inset-0 bg-gradient-to-br from-[#1da64a]/20 via-[#1da64a]/10 to-[#1da64a]/30 flex items-center justify-center"
          >
            <svg class="w-16 h-16 text-[#1da64a] opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </div>
          <img
            v-else-if="item.imageId && item.href"
            :src="`${directusUrl}/assets/${item.imageId}?width=480&height=160&fit=cover&quality=75`"
            :alt="item.title"
            class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          <!-- News: teal gradient + info icon -->
          <div
            v-else-if="item.type === 'news'"
            class="absolute inset-0 bg-gradient-to-br from-teal-100 via-teal-50 to-teal-200 flex items-center justify-center"
          >
            <img src="~/assets/icons/icon_info.svg" alt="" class="w-16 h-16 opacity-20" />
          </div>
          <!-- Project: blue gradient + klimachecker icon -->
          <div
            v-else-if="item.type === 'project'"
            class="absolute inset-0 bg-gradient-to-br from-[#006e94]/20 via-[#006e94]/10 to-[#006e94]/30 flex items-center justify-center"
          >
            <img src="~/assets/icons/icon_klimachecker.svg" alt="" class="w-16 h-16 opacity-20" />
          </div>
          <!-- Municipality: yellow-green gradient + location icon -->
          <div
            v-else-if="item.type === 'municipality'"
            class="absolute inset-0 bg-gradient-to-br from-[#afca0b]/20 via-[#afca0b]/10 to-[#afca0b]/30 flex items-center justify-center"
          >
            <img src="~/assets/icons/icon_location_green_marker.svg" alt="" class="w-16 h-16 opacity-20" />
          </div>
          <span v-else class="text-4xl opacity-20">{{ typeEmoji(item.type) }}</span>
          <span :class="['absolute top-2 left-2 text-xs font-bold px-2 py-0.5 rounded-full', typeBadgeClass(item.type)]">
            {{ typeLabel(item.type) }}
          </span>
          <!-- Status badge for non-published news items (editors only) -->
          <span
            v-if="item.status && item.status !== 'published'"
            :class="[
              'absolute top-2 right-2 text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wide',
              item.status === 'draft' ? 'bg-[#fbbf24] text-[#78350f]' : 'bg-[#9ca3af] text-white',
            ]"
          >{{ item.status === 'draft' ? 'Entwurf' : 'Archiviert' }}</span>
        </div>
        <!-- Card body -->
        <div
          :class="[
            'p-4 flex flex-col gap-1 flex-1',
            item.href ? '' : '',
            item.status && item.status !== 'published' ? 'bg-[#fffbeb]/40' : '',
          ]"
        >
          <h3 :class="item.href ? 'font-bold text-gray-900 leading-snug line-clamp-2 group-hover:text-[#006e94] transition-colors' : 'font-bold text-gray-700 leading-snug line-clamp-2'">
            {{ item.title }}
          </h3>
          <p v-if="item.teaser" :class="item.href ? 'text-sm text-gray-500 line-clamp-3' : 'text-sm text-gray-400 line-clamp-3'">{{ item.teaser }}</p>
          <div class="flex items-center justify-between mt-auto pt-2">
            <time class="text-xs text-gray-400" :datetime="item.date">{{ formatDate(item.date) }}</time>
            <!-- Arrow indicator (clickable cards only) -->
            <svg
              v-if="item.href"
              class="w-4 h-4 text-[#16BAE7] opacity-0 group-hover:opacity-100 translate-x-0 group-hover:translate-x-0.5 transition-all duration-150"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </component>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, resolveComponent } from 'vue'
import { createItem, readItems } from '@directus/sdk'
import { useAuth } from '~/composables/useAuth'
import sectorImages from '~/shared/sectorImages.js'

const NuxtLinkComponent = resolveComponent('NuxtLink')

const { $directus, $readItems } = useNuxtApp()
const config = useRuntimeConfig()
const directusUrl = config.public.clientDirectusUrl

const { isAuthenticated, initialize, getAuthenticatedClient } = useAuth()

// Null until the admin re-fetch completes; when set, overrides the SSR news list
const adminNewsItems = ref(null)

onMounted(async () => {
  await initialize()
  if (isAuthenticated.value) {
    try {
      const client = getAuthenticatedClient()
      adminNewsItems.value = await client.request(readItems('news_items', {
        fields: ['id', 'slug', 'title', 'teaser', 'image', 'date_published', 'date_created', 'status'],
        sort: ['-date_published', '-date_created'],
        limit: 200,
      }))
    } catch (e) {
      console.warn('[news] admin fetch failed', e)
    }
  }
})

useHead({ title: 'Neuigkeiten' })

// ── Data fetching ──────────────────────────────────────────────────────────────

const [
  { data: newsData },
  { data: articlesData },
  { data: eventsData },
  { data: municipalitiesData },
  { data: catalogData },
] = await Promise.all([
  useAsyncData('feed-news', () =>
    $directus.request($readItems('news_items', {
      filter: { status: { _eq: 'published' } },
      fields: ['id', 'slug', 'title', 'teaser', 'image', 'date_published', 'date_created'],
      sort: ['-date_published', '-date_created'],
      limit: 50,
    }))
  ),
  useAsyncData('feed-articles', () =>
    $directus.request($readItems('articles', {
      filter: { status: { _eq: 'published' } },
      fields: ['id', 'slug', 'title', 'abstract', 'image', 'date_created'],
      sort: ['-date_created'],
      limit: 20,
    }))
  ),
  useAsyncData('feed-events', () =>
    $directus.request($readItems('events', {
      filter: { status: { _eq: 'published' } },
      fields: ['id', 'slug', 'title', 'description', 'event_type', 'start_date', 'date_created', 'image'],
      sort: ['-start_date'],
      limit: 20,
    }))
  ),
  useAsyncData('feed-municipalities', () =>
    $directus.request($readItems('municipalities', {
      filter: { status: { _eq: 'published' } },
      fields: ['id', 'slug', 'name', 'description', 'date_updated', 'image'],
      sort: ['-date_updated'],
      limit: 20,
    }))
  ),
  useAsyncData('feed-catalogs', () =>
    $directus.request($readItems('measure_catalog', {
      fields: ['id', 'name', 'date_created'],
      sort: ['-date_created'],
      limit: 10,
    }))
  ),
])

// ── Map to unified feed items ──────────────────────────────────────────────────

const allItems = computed(() => {
  const items = []

  for (const n of (adminNewsItems.value ?? newsData.value ?? [])) {
    items.push({
      type: 'news',
      id: n.id,
      title: n.title,
      teaser: n.teaser || null,
      imageId: n.image || null,
      date: n.date_published || n.date_created,
      status: n.status || 'published',
      href: `/news/${n.slug}`,
    })
  }

  for (const a of articlesData.value || []) {
    items.push({
      type: 'project',
      id: a.id,
      title: a.title,
      teaser: a.abstract || null,
      imageId: a.image || null,
      date: a.date_created,
      href: `/projects/${a.slug}`,
    })
  }

  for (const e of eventsData.value || []) {
    items.push({
      type: 'event',
      id: e.id,
      title: e.title,
      teaser: e.description || null,
      imageId: e.image || null,
      date: e.start_date || e.date_created,
      href: `/events/${e.slug}`,
    })
  }

  for (const m of municipalitiesData.value || []) {
    items.push({
      type: 'municipality',
      id: m.id,
      title: m.name,
      teaser: m.description || null,
      imageId: m.image || null,
      date: m.date_updated,
      href: `/municipalities/${m.slug}`,
    })
  }

  for (const c of catalogData.value || []) {
    items.push({
      type: 'catalog',
      id: c.id,
      title: c.name,
      teaser: 'Neuer Maßnahmenkatalog veröffentlicht',
      imageId: null,
      date: c.date_created,
      href: `/measures?v=${encodeURIComponent(c.name)}`,
    })
  }

  // Sort all items by date descending
  return items.sort((a, b) => new Date(b.date) - new Date(a.date))
})

// ── Filtering ──────────────────────────────────────────────────────────────────

const activeFilter = ref(null)

const filterOptions = [
  { value: 'news', label: 'Neuigkeiten', activeClass: 'bg-teal-600 text-white border-teal-600' },
  { value: 'project', label: 'Erfolgsprojekte', activeClass: 'bg-[#006e94] text-white border-[#006e94]' },
  { value: 'event', label: 'Veranstaltungen', activeClass: 'bg-[#1da64a] text-white border-[#1da64a]' },
  { value: 'municipality', label: 'Kommunen', activeClass: 'bg-[#afca0b] text-white border-[#afca0b]' },
  { value: 'catalog', label: 'Maßnahmenkataloge', activeClass: 'bg-[#6b7280] text-white border-[#6b7280]' },
]

const visibleItems = computed(() =>
  activeFilter.value
    ? allItems.value.filter(i => i.type === activeFilter.value)
    : allItems.value
)

const groupedByMonth = computed(() => {
  const map = new Map()
  for (const item of visibleItems.value) {
    const d = new Date(item.date)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
    if (!map.has(key)) map.set(key, { monthKey: key, label, items: [] })
    map.get(key).items.push(item)
  }
  return [...map.values()]
})

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })
}

function typeLabel(type) {
  return {
    news: 'Neuigkeit',
    project: 'Erfolgsprojekt',
    event: 'Veranstaltung',
    municipality: 'Bewertung geupdated',
    catalog: 'Maßnahmenkatalog',
  }[type] ?? type
}

function typeBadgeClass(type) {
  return {
    news: 'bg-teal-600 text-white',
    project: 'bg-[#006e94] text-white',
    event: 'bg-[#1da64a] text-white',
    municipality: 'bg-[#afca0b] text-white',
    catalog: 'bg-[#6b7280] text-white',
  }[type] ?? 'bg-gray-200 text-gray-700'
}

function typeEmoji(type) {
  return { news: '📰', project: '🏆', event: '📅', municipality: '🏙️', catalog: '📋' }[type] ?? '•'
}

// ── Admin: create new news item ────────────────────────────────────────────────

const creating = ref(false)

async function createNewsItem() {
  const title = window.prompt('Titel der neuen Neuigkeit:')
  if (!title?.trim()) return

  const slug = title.trim()
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    + '-' + Date.now().toString(36)

  creating.value = true
  try {
    const client = getAuthenticatedClient()
    const result = await client.request(createItem('news_items', {
      title: title.trim(),
      slug,
      status: 'draft',
    }))
    await navigateTo(`/news/${result.slug}`)
  } catch (err) {
    alert('Fehler beim Erstellen: ' + (err?.errors?.[0]?.message || err?.message || err))
  } finally {
    creating.value = false
  }
}
</script>

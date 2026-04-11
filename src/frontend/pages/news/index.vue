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
      <!-- Clickable card (NuxtLink) -->
      <NuxtLink
        v-for="item in group.items.filter(i => i.href)"
        :key="`${item.type}-${item.id}`"
        :to="item.href"
        class="group flex flex-col bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden cursor-pointer
               hover:shadow-md hover:border-[#16BAE7]/60 focus-visible:ring-2 focus-visible:ring-[#16BAE7] focus-visible:outline-none
               transition-all duration-150"
      >
        <!-- Thumbnail -->
        <div class="relative h-40 bg-gray-50 flex-shrink-0 overflow-hidden">
          <img
            v-if="item.imageId"
            :src="`${directusUrl}/assets/${item.imageId}?width=480&height=160&fit=cover&quality=75`"
            :alt="item.title"
            class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          <div v-else class="w-full h-full flex items-center justify-center">
            <span class="text-4xl opacity-20">{{ typeEmoji(item.type) }}</span>
          </div>
          <span :class="['absolute top-2 left-2 text-xs font-bold px-2 py-0.5 rounded-full', typeBadgeClass(item.type)]">
            {{ typeLabel(item.type) }}
          </span>
          <!-- Status badge for non-published news items (editors only) -->
          <span
            v-if="item.status && item.status !== 'published'"
            :class="[
              'absolute top-2 right-2 text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wide',
              item.status === 'draft' ? 'bg-amber-400 text-amber-900' : 'bg-gray-400 text-white',
            ]"
          >{{ item.status === 'draft' ? 'Entwurf' : 'Archiviert' }}</span>
        </div>
        <!-- Card body -->
        <div
          :class="[
            'p-4 flex flex-col gap-1 flex-1',
            item.status && item.status !== 'published' ? 'bg-amber-50/40' : '',
          ]"
        >
          <h3 class="font-bold text-gray-900 leading-snug line-clamp-2 group-hover:text-[#006e94] transition-colors">
            {{ item.title }}
          </h3>
          <p v-if="item.teaser" class="text-sm text-gray-500 line-clamp-3">{{ item.teaser }}</p>
          <div class="flex items-center justify-between mt-auto pt-2">
            <time class="text-xs text-gray-400" :datetime="item.date">{{ formatDate(item.date) }}</time>
            <!-- Arrow indicator -->
            <svg
              class="w-4 h-4 text-[#16BAE7] opacity-0 group-hover:opacity-100 translate-x-0 group-hover:translate-x-0.5 transition-all duration-150"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </NuxtLink>

      <!-- Non-clickable info card (e.g. measure_catalog) -->
      <div
        v-for="item in group.items.filter(i => !i.href)"
        :key="`${item.type}-${item.id}`"
        class="flex flex-col bg-gray-50 rounded-lg border border-dashed border-gray-200 overflow-hidden opacity-80"
      >
        <div class="relative h-40 bg-gray-100 flex-shrink-0 flex items-center justify-center">
          <span class="text-5xl opacity-15">{{ typeEmoji(item.type) }}</span>
          <span :class="['absolute top-2 left-2 text-xs font-bold px-2 py-0.5 rounded-full', typeBadgeClass(item.type)]">
            {{ typeLabel(item.type) }}
          </span>
        </div>
        <div class="p-4 flex flex-col gap-1 flex-1">
          <h3 class="font-bold text-gray-700 leading-snug line-clamp-2">{{ item.title }}</h3>
          <p v-if="item.teaser" class="text-sm text-gray-400 line-clamp-3">{{ item.teaser }}</p>
          <time class="text-xs text-gray-400 mt-auto pt-2" :datetime="item.date">{{ formatDate(item.date) }}</time>
        </div>
      </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { createItem, readItems } from '@directus/sdk'
import { useAuth } from '~/composables/useAuth'

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
      fields: ['id', 'slug', 'title', 'description', 'event_type', 'start_date', 'date_created'],
      sort: ['-start_date'],
      limit: 20,
    }))
  ),
  useAsyncData('feed-municipalities', () =>
    $directus.request($readItems('municipalities', {
      fields: ['id', 'slug', 'name', 'description', 'date_created'],
      sort: ['-date_created'],
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
      imageId: null,
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
      imageId: null,
      date: m.date_created,
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
      href: null,
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
    municipality: 'Neue Kommune',
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

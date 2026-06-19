<template>
  <div class="py-8">
    <!-- Header row: title + admin create button -->
    <div class="flex items-start justify-between gap-4 mb-2">
      <h1 class="text-3xl font-bold text-[#006e94]">{{ $t('news.title') }}</h1>
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
        {{ creating ? $t('news.create.in_progress') : $t('news.create') }}
      </button>
    </div>
    <p class="text-gray-500 mb-8">{{ $t('news.description') }}</p>

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
        {{ $t('generic.all') }}
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

    <!-- Sidebar + feed layout -->
    <!-- Mobile sticky scroll nav -->
    <nav
      class="xl:hidden sticky z-10 bg-white/90 backdrop-blur-sm border-b border-gray-100 -mx-4 px-4 mb-6"
      :class="isDesktop ? '' : 'transition-[top] duration-300 ease-in-out'"
      :style="`top: ${pillTop}px`"
    >
      <div ref="mobilePillStrip" class="flex gap-2 overflow-x-auto py-2" style="scrollbar-width: none; -ms-overflow-style: none;">
        <a
          v-if="upcomingEvents.length && (activeFilter === null || activeFilter === 'event')"
          href="#section-zukunftig"
          :class="[
            'flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap',
            activeSection === 'section-zukunftig'
              ? 'bg-[#1da64a]/10 text-[#1da64a] font-semibold'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200',
          ]"
        >{{ $t('news.section.upcoming') }}</a>
        <a
          v-for="group in groupedByMonth"
          :key="group.monthKey"
          :href="`#section-${group.monthKey}`"
          :class="[
            'flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap',
            activeSection === `section-${group.monthKey}`
              ? 'bg-[#006e94]/10 text-[#006e94] font-semibold'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200',
          ]"
        >{{ group.label }}</a>
      </div>
    </nav>

    <div class="flex gap-8 items-start">

      <!-- Left sticky nav (desktop only) -->
      <nav
        class="hidden xl:block w-44 flex-shrink-0 sticky text-sm self-start"
        :style="`top: ${headerHeight + 12}px`"
      >
          <p class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">{{ $t('news.sections') }}</p>
          <ul class="space-y-1">
            <li
              v-if="upcomingEvents.length && (activeFilter === null || activeFilter === 'event')"
            >
              <a
                href="#section-zukunftig"
                :class="[
                  'block px-2 py-1 rounded transition-colors truncate',
                  activeSection === 'section-zukunftig'
                    ? 'text-[#1da64a] font-semibold bg-[#1da64a]/5'
                    : 'text-gray-400 hover:text-gray-700 hover:bg-gray-50',
                ]"
              >{{ $t('news.section.upcoming') }}</a>
            </li>
            <li v-for="group in groupedByMonth" :key="group.monthKey">
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
          </ul>
      </nav>

      <!-- Main feed -->
      <div class="flex-1 min-w-0">

    <!-- Zukünftige Veranstaltungen: upcoming events preview -->
    <div
      v-if="upcomingEvents.length && (activeFilter === null || activeFilter === 'event')"
      id="section-zukunftig"
      class="mb-10"
      :style="`scroll-margin-top: ${headerHeight + 16}px`"
    >
      <div class="flex items-center justify-between border-b border-gray-200 pb-2 mb-4">
        <h2 class="text-base font-semibold text-gray-500 uppercase tracking-wide">
          {{ $t('news.section.upcoming') }}
        </h2>
        <NuxtLink to="/events" class="text-sm text-[#1da64a] hover:underline flex items-center gap-1 font-medium shrink-0">
          {{ $t('news.all_events') }}
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </NuxtLink>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <NuxtLink
          v-for="ev in upcomingEvents"
          :key="ev.id"
          :to="`/events/${ev.slug}`"
          class="group flex flex-col bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden cursor-pointer hover:shadow-md hover:border-[#16BAE7]/60 focus-visible:ring-2 focus-visible:ring-[#16BAE7] focus-visible:outline-none transition-all duration-150"
        >
          <!-- Thumbnail -->
          <div class="relative h-40 bg-gray-50 flex-shrink-0 overflow-hidden">
            <div
              v-if="!ev.imageId"
              class="absolute inset-0 bg-gradient-to-br from-[#1da64a]/20 via-[#1da64a]/10 to-[#1da64a]/30 flex items-center justify-center"
            >
              <svg class="w-16 h-16 text-[#1da64a] opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <SmartImg
              v-else
              :assetId="ev.imageId"
              :isRaster="isRaster(ev.imageType)"
              :alt="ev.title"
              :width="480"
              :height="160"
              fit="cover"
              imgClass="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
            <span class="absolute top-2 left-2 text-xs font-bold px-2 py-0.5 rounded-full bg-[#1da64a] text-white">{{ typeLabel('event') }}</span>
          </div>
          <!-- Card body -->
          <div class="p-4 flex flex-col gap-1 flex-1">
            <h3 class="font-bold text-gray-900 leading-snug line-clamp-2 group-hover:text-[#006e94] transition-colors">{{ ev.title }}</h3>
            <div class="flex flex-wrap items-center gap-x-2 gap-y-1 mb-1">
              <span v-if="ev.event_type" class="text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[#1da64a]/10 text-[#1da64a]">
                {{ eventTypeLabel(ev.event_type) }}
              </span>
              <span class="flex items-center gap-1 text-xs text-gray-500">
                <svg class="h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {{ formatDateRange(ev.start_date, ev.end_date) }}
              </span>
              <span v-if="ev.location" class="flex items-center gap-1 text-xs text-gray-500">
                <svg class="h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {{ ev.location }}
              </span>
            </div>
          </div>
        </NuxtLink>
      </div>
    </div>

    <div v-if="visibleItems.length === 0 && !(upcomingEvents.length && (activeFilter === null || activeFilter === 'event'))" class="text-gray-400 italic">
      {{ $t('news.no_entries') }}
    </div>

    <div v-for="group in groupedByMonth" :key="group.monthKey" :id="`section-${group.monthKey}`" class="mb-10" :style="`scroll-margin-top: ${headerHeight + 16}px`">
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
          <SmartImg
            v-else-if="item.imageId && item.href"
            :assetId="item.imageId"
            :isRaster="isRaster(item.imageType)"
            :alt="item.title"
            :width="480"
            :height="160"
            fit="cover"
            imgClass="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
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
          >{{ statusLabel(item.status) }}</span>
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
          <!-- Event metadata: type badge, date, location -->
          <div v-if="item.type === 'event'" class="flex flex-wrap items-center gap-x-2 gap-y-1 mb-1">
            <span v-if="item.eventType" class="text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[#1da64a]/10 text-[#1da64a]">
              {{ eventTypeLabel(item.eventType) }}
            </span>
            <span class="flex items-center gap-1 text-xs text-gray-500">
              <svg class="h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {{ formatDateRange(item.date, item.endDate) }}
            </span>
            <span v-if="item.location" class="flex items-center gap-1 text-xs text-gray-500">
              <svg class="h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {{ item.location }}
            </span>
          </div>
          <p v-if="item.teaser" :class="item.href ? 'text-sm text-gray-500 line-clamp-3' : 'text-sm text-gray-400 line-clamp-3'">{{ item.teaser }}</p>
          <div class="flex items-center justify-between mt-auto pt-2">
            <time v-if="item.type !== 'event'" class="text-xs text-gray-400" :datetime="item.date">{{ formatDate(item.date) }}</time>
            <span v-else />
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

      </div><!-- /main feed -->
    </div><!-- /sidebar + feed layout -->
  </div>
</template>

<script setup>
import { computed, ref, resolveComponent, onMounted } from 'vue'
import { createItem, readItems } from '@directus/sdk'
import { useAuth } from '~/composables/useAuth'
import { useHeaderHeight } from '~/composables/useHeaderHeight.js'
import { useMobileHeaderHidden } from '~/composables/useMobileHeaderHidden.js'
import { useSectionScrollSpy } from '~/composables/useSectionScrollSpy'
import sectorImages from '~/shared/sectorImages.js'
import { createSlug } from '~/shared/slugify.js'

import { isRaster } from '~/shared/utils'
function stripHtml(html) {
  if (!html) return null
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() || null
}

const NuxtLinkComponent = resolveComponent('NuxtLink')

const { $directus, $readItems, $t, $locale } = useNuxtApp()
const config = useRuntimeConfig()
const directusUrl = config.public.clientDirectusUrl

const { isAuthenticated, initialize, getAuthenticatedClient } = useAuth()
const headerHeight = useHeaderHeight()
const mobileHeaderHidden = useMobileHeaderHidden()
const isDesktop = useState('layout-isDesktop')
const { activeSection, mobilePillStrip } = useSectionScrollSpy()
// On desktop use actual header height (no CSS transition needed — headerHeight updates
// every frame via ResizeObserver so the pill follows the nav strip animation precisely).
// On mobile use a fixed 64px / 0 with a CSS transition to match the header slide.
const pillTop = computed(() => {
  return isDesktop.value ? headerHeight.value : (mobileHeaderHidden.value ? 0 : 64)
})

// Null until the admin re-fetch completes; when set, overrides the SSR news list
const adminNewsItems = ref(null)

onMounted(async () => {
  await initialize()
  if (isAuthenticated.value) {
    try {
      const client = getAuthenticatedClient()
      adminNewsItems.value = await client.request(readItems('news_items', {
        fields: ['id', 'slug', 'title', 'teaser', { image: ['id', 'type'] }, 'date_published', 'date_created', 'status'],
        sort: ['-date_published', '-date_created'],
        limit: 200,
      }))
    } catch (e) {
      console.warn('[news] admin fetch failed', e)
    }
  }
})

useHead({ title: computed(() => $t('news.title')) })

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
      fields: ['id', 'slug', 'title', 'teaser', { image: ['id', 'type'] }, 'date_published', 'date_created'],
      sort: ['-date_published', '-date_created'],
      limit: 50,
    }))
  ),
  useAsyncData('feed-articles', () =>
    $directus.request($readItems('articles', {
      filter: { status: { _eq: 'published' } },
      fields: ['id', 'slug', 'title', 'abstract', { image: ['id', 'type'] }, 'date_created'],
      sort: ['-date_created'],
      limit: 20,
    }))
  ),
  useAsyncData('feed-events', () =>
    $directus.request($readItems('events', {
      filter: { status: { _eq: 'published' } },
      fields: ['id', 'slug', 'title', 'description', 'event_type', 'start_date', 'end_date', 'date_created', { image: ['id', 'type'] }, 'location'],
      sort: ['-start_date'],
      limit: 20,
    }))
  ),
  useAsyncData('feed-municipalities', () =>
    $directus.request($readItems('municipalities', {
      filter: { status: { _eq: 'published' } },
      fields: ['id', 'slug', 'name', 'description', 'date_updated', { image: ['id', 'type'] }],
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

function mapNewsItem(item) {
  return {
    type: 'news',
    id: item.id,
    title: item.title,
    teaser: item.teaser || null,
    imageId: item.image?.id || null,
    imageType: item.image?.type || null,
    date: item.date_published || item.date_created,
    status: item.status || 'published',
    href: `/news/${item.slug}`,
  }
}

function mapProjectItem(item) {
  return {
    type: 'project',
    id: item.id,
    title: item.title,
    teaser: item.abstract || null,
    imageId: item.image?.id || null,
    imageType: item.image?.type || null,
    date: item.date_created,
    href: `/projects/${item.slug}`,
  }
}

function isUpcomingEvent(item, now = new Date()) {
  return Boolean(item.start_date && new Date(item.start_date) >= now)
}

function mapPastEventItem(item) {
  return {
    type: 'event',
    id: item.id,
    title: item.title,
    teaser: stripHtml(item.description),
    imageId: item.image?.id || null,
    imageType: item.image?.type || null,
    date: item.start_date || item.date_created,
    endDate: item.end_date || null,
    eventType: item.event_type || null,
    location: item.location || null,
    href: `/events/${item.slug}`,
  }
}

function mapMunicipalityItem(item) {
  return {
    type: 'municipality',
    id: item.id,
    title: item.name,
    teaser: item.description || null,
    imageId: item.image?.id || null,
    imageType: item.image?.type || null,
    date: item.date_updated,
    href: `/municipalities/${item.slug}`,
  }
}

function mapCatalogItem(item) {
  return {
    type: 'catalog',
    id: item.id,
    title: item.name,
    teaser: $t('news.catalog_published'),
    imageId: null,
    imageType: null,
    date: item.date_created,
    href: `/measures?v=${encodeURIComponent(item.name)}`,
  }
}

function compareFeedItemsByDateDesc(a, b) {
  return new Date(b.date) - new Date(a.date)
}

const allItems = computed(() => {
  const now = new Date()

  return [
    ...(adminNewsItems.value ?? newsData.value ?? []).map(mapNewsItem),
    ...(articlesData.value || []).map(mapProjectItem),
    ...(eventsData.value || []).filter(item => !isUpcomingEvent(item, now)).map(mapPastEventItem),
    ...(municipalitiesData.value || []).map(mapMunicipalityItem),
    ...(catalogData.value || []).map(mapCatalogItem),
  ].sort(compareFeedItemsByDateDesc)
})

// ── Filtering ──────────────────────────────────────────────────────────────────

const activeFilter = ref(null)

const filterOptions = computed(() => [
  { value: 'news', label: $t('news.filter.news'), activeClass: 'bg-teal-600 text-white border-teal-600' },
  { value: 'project', label: $t('news.filter.project'), activeClass: 'bg-[#006e94] text-white border-[#006e94]' },
  { value: 'event', label: $t('news.filter.event'), activeClass: 'bg-[#1da64a] text-white border-[#1da64a]' },
  { value: 'municipality', label: $t('news.filter.municipality'), activeClass: 'bg-[#afca0b] text-white border-[#afca0b]' },
  { value: 'catalog', label: $t('news.filter.catalog'), activeClass: 'bg-[#6b7280] text-white border-[#6b7280]' },
])

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
    const label = d.toLocaleDateString($locale, { month: 'long', year: 'numeric' })
    if (!map.has(key)) map.set(key, { monthKey: key, label, items: [] })
    map.get(key).items.push(item)
  }
  return [...map.values()]
})

const upcomingEvents = computed(() => {
  const upcoming = new Date()
  return (eventsData.value || [])
    .filter(item => isUpcomingEvent(item, upcoming))
    .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))
    .slice(0, 2)
})

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString($locale, { day: '2-digit', month: 'long', year: 'numeric' })
}

function formatDateRange(startIso, endIso) {
  if (!startIso) return ''
  const start = new Date(startIso)
  const end = endIso ? new Date(endIso) : null
  if (!end || end.toDateString() === start.toDateString()) {
    return start.toLocaleDateString($locale, { day: '2-digit', month: 'long', year: 'numeric' })
  }
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${start.getDate()}. – ${end.toLocaleDateString($locale, { day: '2-digit', month: 'long', year: 'numeric' })}`
  }
  if (start.getFullYear() === end.getFullYear()) {
    return `${start.toLocaleDateString($locale, { day: '2-digit', month: 'long' })} – ${end.toLocaleDateString($locale, { day: '2-digit', month: 'long', year: 'numeric' })}`
  }
  return `${start.toLocaleDateString($locale, { day: '2-digit', month: 'long', year: 'numeric' })} – ${end.toLocaleDateString($locale, { day: '2-digit', month: 'long', year: 'numeric' })}`
}

function typeLabel(type) {
  const translated = $t(`news.type.${type}`)
  return translated === `news.type.${type}` ? type : translated
}

function eventTypeLabel(type) {
  if (!type) return ''
  const translated = $t(`events.type.${type}`)
  return translated === `events.type.${type}` ? type : translated
}

function statusLabel(status) {
  const translated = $t(`status.${status}`)
  return translated === `status.${status}` ? status : translated
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
  const title = window.prompt($t('news.create.prompt'))
  if (!title?.trim()) return

  const slug = `${createSlug(title)}-${Date.now().toString(36)}`

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
    alert($t('news.create.error', { ':message': err?.errors?.[0]?.message || err?.message || err }))
  } finally {
    creating.value = false
  }
}
</script>

<template>
  <div class="py-8">
    <!-- Header row: title + admin create button -->
    <div class="mb-2 flex items-start justify-between gap-4">
      <h1 class="text-3xl font-bold text-[#006e94]">{{ $t("news.title") }}</h1>
      <button
        v-if="isAuthenticated"
        type="button"
        :disabled="creating"
        @click="createNewsItem"
        class="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-700 disabled:opacity-50"
      >
        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        {{ creating ? $t("news.create.in_progress") : $t("news.create") }}
      </button>
    </div>
    <p class="text-gray-500 mb-8">{{ $t("news.description") }}</p>

    <!-- Type filter pills -->
    <div class="mb-6 flex flex-wrap gap-2">
      <button
        type="button"
        @click="activeFilter = null"
        :class="[
          'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-bold transition-colors',
          activeFilter === null
            ? 'slk-bright-badge slk-bright-badge--neutral border-[#374151] bg-[#374151] text-white'
            : 'border-[#e5e7eb] bg-[#e5e7eb] text-[#374151] hover:bg-[#d1d5db]',
        ]"
      >
        {{ $t("generic.all") }}
      </button>
      <button
        v-for="f in filterOptions"
        :key="f.value"
        type="button"
        @click="activeFilter = f.value"
        :class="[
          'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-bold transition-colors',
          activeFilter === f.value ? f.activeClass : 'text-gray-600 border-gray-300 hover:border-gray-400 bg-white',
        ]"
      >
        {{ f.label }}
      </button>
    </div>

    <!-- Sidebar + feed layout -->
    <!-- Mobile sticky scroll nav -->
    <nav
      class="border-gray-100 sticky z-10 -mx-4 mb-6 border-b bg-white/90 px-4 backdrop-blur-sm xl:hidden"
      :class="isDesktop ? '' : 'transition-[top] duration-300 ease-in-out'"
      :style="`top: ${pillTop}px`"
    >
      <div
        ref="mobilePillStrip"
        class="flex gap-2 overflow-x-auto py-2"
        style="scrollbar-width: none; -ms-overflow-style: none"
      >
        <a
          v-if="upcomingEvents.length && (activeFilter === null || activeFilter === 'event')"
          href="#section-zukunftig"
          :class="[
            'flex-shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors',
            activeSection === 'section-zukunftig'
              ? 'bg-[#1da64a]/10 font-semibold text-[#1da64a]'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200',
          ]"
          >{{ $t("news.section.upcoming") }}</a
        >
        <a
          v-for="group in groupedByMonth"
          :key="group.monthKey"
          :href="`#section-${group.monthKey}`"
          :class="[
            'flex-shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors',
            activeSection === `section-${group.monthKey}`
              ? 'bg-[#006e94]/10 font-semibold text-[#006e94]'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200',
          ]"
          >{{ group.label }}</a
        >
      </div>
    </nav>

    <div class="flex items-start gap-8">
      <!-- Left sticky nav (desktop only) -->
      <nav class="sticky hidden w-44 flex-shrink-0 self-start text-sm xl:block" :style="`top: ${headerHeight + 12}px`">
        <p class="text-gray-400 mb-3 text-xs font-bold uppercase tracking-widest">{{ $t("news.sections") }}</p>
        <ul class="space-y-1">
          <li v-if="upcomingEvents.length && (activeFilter === null || activeFilter === 'event')">
            <a
              href="#section-zukunftig"
              :class="[
                'block truncate rounded px-2 py-1 transition-colors',
                activeSection === 'section-zukunftig'
                  ? 'bg-[#1da64a]/5 font-semibold text-[#1da64a]'
                  : 'text-gray-400 hover:text-gray-700 hover:bg-gray-50',
              ]"
              >{{ $t("news.section.upcoming") }}</a
            >
          </li>
          <li v-for="group in groupedByMonth" :key="group.monthKey">
            <a
              :href="`#section-${group.monthKey}`"
              :class="[
                'block truncate rounded px-2 py-1 transition-colors',
                activeSection === `section-${group.monthKey}`
                  ? 'bg-[#006e94]/5 font-semibold text-[#006e94]'
                  : 'text-gray-400 hover:text-gray-700 hover:bg-gray-50',
              ]"
              >{{ group.label }}</a
            >
          </li>
        </ul>
      </nav>

      <!-- Main feed -->
      <div class="min-w-0 flex-1">
        <!-- Zukünftige Veranstaltungen: upcoming events preview -->
        <div
          v-if="upcomingEvents.length && (activeFilter === null || activeFilter === 'event')"
          id="section-zukunftig"
          class="mb-10"
          :style="`scroll-margin-top: ${headerHeight + 16}px`"
        >
          <div class="border-gray-200 mb-4 flex items-center justify-between border-b pb-2">
            <h2 class="text-gray-500 text-base font-semibold uppercase tracking-wide">
              {{ $t("news.section.upcoming") }}
            </h2>
            <NuxtLink
              to="/events"
              class="flex shrink-0 items-center gap-1 text-sm font-medium text-[#1da64a] hover:underline"
            >
              {{ $t("news.all_events") }}
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </NuxtLink>
          </div>
          <div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            <NuxtLink
              v-for="ev in upcomingEvents"
              :key="ev.id"
              :to="`/events/${ev.slug}`"
              class="border-gray-100 group flex cursor-pointer flex-col overflow-hidden rounded-lg border bg-white shadow-sm transition-all duration-150 hover:border-[#16BAE7]/60 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16BAE7]"
            >
              <!-- Thumbnail -->
              <div class="bg-gray-50 relative h-40 flex-shrink-0 overflow-hidden">
                <div
                  v-if="!ev.imageId"
                  class="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#1da64a]/20 via-[#1da64a]/10 to-[#1da64a]/30"
                >
                  <svg
                    class="h-16 w-16 text-[#1da64a] opacity-30"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="1.2"
                  >
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
                <span
                  class="slk-bright-badge slk-bright-badge--green absolute left-2 top-2 rounded-full bg-[#1da64a] px-2 py-0.5 text-xs font-bold text-white"
                  >{{ typeLabel("event") }}</span
                >
              </div>
              <!-- Card body -->
              <div class="flex flex-1 flex-col gap-1 p-4">
                <h3
                  class="text-gray-900 line-clamp-2 font-bold leading-snug transition-colors group-hover:text-[#006e94]"
                >
                  {{ ev.title }}
                </h3>
                <div class="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span
                    v-if="ev.event_type"
                    class="rounded-full bg-[#1da64a]/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-[#1da64a]"
                  >
                    {{ eventTypeLabel(ev.event_type) }}
                  </span>
                  <span class="text-gray-500 flex items-center gap-1 text-xs">
                    <svg
                      class="h-3.5 w-3.5 flex-shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    {{ formatEventDateTimeRange(ev.start_date, ev.end_date, $locale) }}
                  </span>
                  <span v-if="ev.location" class="text-gray-500 flex items-center gap-1 text-xs">
                    <svg
                      class="h-3.5 w-3.5 flex-shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                      />
                      <path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {{ ev.location }}
                  </span>
                </div>
              </div>
            </NuxtLink>
          </div>
        </div>

        <div
          v-if="
            visibleItems.length === 0 && !(upcomingEvents.length && (activeFilter === null || activeFilter === 'event'))
          "
          class="text-gray-400 italic"
        >
          {{ $t("news.no_entries") }}
        </div>

        <div
          v-for="group in groupedByMonth"
          :key="group.monthKey"
          :id="`section-${group.monthKey}`"
          class="mb-10"
          :style="`scroll-margin-top: ${headerHeight + 16}px`"
        >
          <!-- Month heading -->
          <h2 class="text-gray-500 border-gray-200 mb-4 border-b pb-2 text-base font-semibold uppercase tracking-wide">
            {{ group.label }}
          </h2>

          <div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            <component
              v-for="item in group.items"
              :is="item.href ? NuxtLinkComponent : 'div'"
              :key="`${item.type}-${item.id}`"
              :to="item.href || undefined"
              :class="
                item.href
                  ? 'border-gray-100 group flex cursor-pointer flex-col overflow-hidden rounded-lg border bg-white shadow-sm transition-all duration-150 hover:border-[#16BAE7]/60 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16BAE7]'
                  : 'bg-gray-50 border-gray-200 flex flex-col overflow-hidden rounded-lg border border-dashed opacity-80'
              "
            >
              <!-- Thumbnail -->
              <div
                :class="
                  item.href
                    ? 'bg-gray-50 relative h-40 flex-shrink-0 overflow-hidden'
                    : 'bg-gray-100 relative flex h-40 flex-shrink-0 items-center justify-center'
                "
              >
                <!-- Catalog: gray gradient with all sector icons -->
                <div
                  v-if="item.type === 'catalog'"
                  class="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#6b7280]/25 via-[#6b7280]/10 to-[#6b7280]/35"
                >
                  <div class="grid grid-cols-3 gap-3 px-6">
                    <img
                      v-for="(src, key) in sectorImages"
                      :key="key"
                      :src="src"
                      :alt="key"
                      class="h-10 w-10 opacity-40"
                    />
                  </div>
                </div>
                <!-- Event: green gradient with calendar icon -->
                <div
                  v-else-if="item.type === 'event' && !item.imageId"
                  class="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#1da64a]/20 via-[#1da64a]/10 to-[#1da64a]/30"
                >
                  <svg
                    class="h-16 w-16 text-[#1da64a] opacity-30"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="1.2"
                  >
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
                  class="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-teal-100 via-teal-50 to-teal-200"
                >
                  <img src="~/assets/icons/icon_info.svg" alt="" class="h-16 w-16 opacity-20" />
                </div>
                <!-- Project: blue gradient + klimachecker icon -->
                <div
                  v-else-if="item.type === 'project'"
                  class="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#006e94]/20 via-[#006e94]/10 to-[#006e94]/30"
                >
                  <img src="~/assets/icons/icon_klimachecker.svg" alt="" class="h-16 w-16 opacity-20" />
                </div>
                <!-- Municipality: yellow-green gradient + location icon -->
                <div
                  v-else-if="item.type === 'municipality'"
                  class="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#afca0b]/20 via-[#afca0b]/10 to-[#afca0b]/30"
                >
                  <img src="~/assets/icons/icon_location_green_marker.svg" alt="" class="h-16 w-16 opacity-20" />
                </div>
                <span v-else class="text-4xl opacity-20">{{ typeEmoji(item.type) }}</span>
                <span
                  :class="[
                    'absolute left-2 top-2 rounded-full px-2 py-0.5 text-xs font-bold',
                    typeBadgeClass(item.type),
                  ]"
                >
                  {{ typeLabel(item.type) }}
                </span>
                <!-- Status badge for non-published news items (editors only) -->
                <span
                  v-if="item.status && item.status !== 'published'"
                  :class="[
                    'absolute right-2 top-2 rounded-full px-2 py-0.5 text-xs font-bold uppercase tracking-wide',
                    item.status === 'draft'
                      ? 'bg-[#fbbf24] text-[#78350f]'
                      : 'slk-bright-badge slk-bright-badge--neutral bg-[#9ca3af] text-white',
                  ]"
                  >{{ statusLabel(item.status) }}</span
                >
              </div>
              <!-- Card body -->
              <div
                :class="[
                  'flex flex-1 flex-col gap-1 p-4',
                  item.href ? '' : '',
                  item.status && item.status !== 'published' ? 'bg-[#fffbeb]/40' : '',
                ]"
              >
                <h3
                  :class="
                    item.href
                      ? 'text-gray-900 line-clamp-2 font-bold leading-snug transition-colors group-hover:text-[#006e94]'
                      : 'text-gray-700 line-clamp-2 font-bold leading-snug'
                  "
                >
                  {{ item.title }}
                </h3>
                <!-- Event metadata: type badge, date, location -->
                <div v-if="item.type === 'event'" class="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span
                    v-if="item.eventType"
                    class="rounded-full bg-[#1da64a]/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-[#1da64a]"
                  >
                    {{ eventTypeLabel(item.eventType) }}
                  </span>
                  <span class="text-gray-500 flex items-center gap-1 text-xs">
                    <svg
                      class="h-3.5 w-3.5 flex-shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    {{ formatEventDateTimeRange(item.date, item.endDate, $locale) }}
                  </span>
                  <span v-if="item.location" class="text-gray-500 flex items-center gap-1 text-xs">
                    <svg
                      class="h-3.5 w-3.5 flex-shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                      />
                      <path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {{ item.location }}
                  </span>
                </div>
                <p
                  v-if="item.teaser"
                  :class="item.href ? 'text-gray-500 line-clamp-3 text-sm' : 'text-gray-400 line-clamp-3 text-sm'"
                >
                  {{ item.teaser }}
                </p>
                <div class="mt-auto flex items-center justify-between pt-2">
                  <time v-if="item.type !== 'event'" class="text-gray-400 text-xs" :datetime="item.date">{{
                    formatDate(item.date)
                  }}</time>
                  <span v-else />
                  <!-- Arrow indicator (clickable cards only) -->
                  <svg
                    v-if="item.href"
                    class="h-4 w-4 translate-x-0 text-[#16BAE7] opacity-0 transition-all duration-150 group-hover:translate-x-0.5 group-hover:opacity-100"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </component>
          </div>
        </div>
      </div>
      <!-- /main feed -->
    </div>
    <!-- /sidebar + feed layout -->
  </div>
</template>

<script setup>
import { computed, ref, watch, resolveComponent, onMounted, onUnmounted } from "vue";
import { createItem, readItems } from "@directus/sdk";
import { useAuth } from "~/composables/useAuth";
import { useHeaderHeight } from "~/composables/useHeaderHeight.js";
import { useMobileHeaderHidden } from "~/composables/useMobileHeaderHidden.js";
import { formatBerlinDate, formatEventDateTimeRange, formatEventMonth, getEventMonthKey } from "~/shared/eventDateTime";
import sectorImages from "~/shared/sectorImages.js";
import { createSlug } from "~/shared/slugify.js";

import { isRaster } from "~/shared/utils";
function stripHtml(html) {
  if (!html) return null;
  return (
    html
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim() || null
  );
}

const NuxtLinkComponent = resolveComponent("NuxtLink");

const { $directus, $readItems, $t, $locale } = useNuxtApp();
const config = useRuntimeConfig();
const directusUrl = config.public.clientDirectusUrl;

const { isAuthenticated, initialize, getAuthenticatedClient } = useAuth();
const headerHeight = useHeaderHeight();
const mobileHeaderHidden = useMobileHeaderHidden();
const isDesktop = useState("layout-isDesktop");
// On desktop use actual header height (no CSS transition needed — headerHeight updates
// every frame via ResizeObserver so the pill follows the nav strip animation precisely).
// On mobile use a fixed 64px / 0 with a CSS transition to match the header slide.
const pillTop = computed(() => {
  return isDesktop.value ? headerHeight.value : mobileHeaderHidden.value ? 0 : 64;
});

// ── Section nav active tracking ────────────────────────────────────────────────
const activeSection = ref(null);
const mobilePillStrip = ref(null);
let sectionObserver = null;

watch(activeSection, (id) => {
  if (!id || !mobilePillStrip.value) return;
  const pill = mobilePillStrip.value.querySelector(`[href="#${id}"]`);
  if (pill) pill.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
});

onMounted(() => {
  const observe = () => {
    const sections = document.querySelectorAll('[id^="section-"]');
    if (!sections.length) return;
    sectionObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            activeSection.value = entry.target.id;
          }
        }
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: 0 },
    );
    sections.forEach((s) => sectionObserver.observe(s));
  };
  // Wait one tick for v-for sections to be rendered
  setTimeout(observe, 100);
});

onUnmounted(() => {
  sectionObserver?.disconnect();
});

// Null until the admin re-fetch completes; when set, overrides the SSR news list
const adminNewsItems = ref(null);

onMounted(async () => {
  await initialize();
  if (isAuthenticated.value) {
    try {
      const client = getAuthenticatedClient();
      adminNewsItems.value = await client.request(
        readItems("news_items", {
          fields: [
            "id",
            "slug",
            "title",
            "teaser",
            { image: ["id", "type"] },
            "date_published",
            "date_created",
            "status",
          ],
          sort: ["-date_published", "-date_created"],
          limit: 200,
        }),
      );
    } catch (e) {
      console.warn("[news] admin fetch failed", e);
    }
  }
});

useHead({ title: computed(() => $t("news.title")) });

// ── Data fetching ──────────────────────────────────────────────────────────────

const [
  { data: newsData },
  { data: articlesData },
  { data: eventsData },
  { data: municipalitiesData },
  { data: catalogData },
] = await Promise.all([
  useAsyncData("feed-news", () =>
    $directus.request(
      $readItems("news_items", {
        filter: { status: { _eq: "published" } },
        fields: ["id", "slug", "title", "teaser", { image: ["id", "type"] }, "date_published", "date_created"],
        sort: ["-date_published", "-date_created"],
        limit: 50,
      }),
    ),
  ),
  useAsyncData("feed-articles", () =>
    $directus.request(
      $readItems("articles", {
        filter: { status: { _eq: "published" } },
        fields: ["id", "slug", "title", "abstract", { image: ["id", "type"] }, "date_created"],
        sort: ["-date_created"],
        limit: 20,
      }),
    ),
  ),
  useAsyncData("feed-events", () =>
    $directus.request(
      $readItems("events", {
        filter: { status: { _eq: "published" } },
        fields: [
          "id",
          "slug",
          "title",
          "description",
          "event_type",
          "start_date",
          "end_date",
          "date_created",
          { image: ["id", "type"] },
          "location",
        ],
        sort: ["-start_date"],
        limit: 20,
      }),
    ),
  ),
  useAsyncData("feed-municipalities", () =>
    $directus.request(
      $readItems("municipalities", {
        filter: { status: { _eq: "published" } },
        fields: ["id", "slug", "name", "description", "date_updated", { image: ["id", "type"] }],
        sort: ["-date_updated"],
        limit: 20,
      }),
    ),
  ),
  useAsyncData("feed-catalogs", () =>
    $directus.request(
      $readItems("measure_catalog", {
        fields: ["id", "name", "date_created"],
        sort: ["-date_created"],
        limit: 10,
      }),
    ),
  ),
]);

// ── Map to unified feed items ──────────────────────────────────────────────────

const allItems = computed(() => {
  const items = [];

  for (const n of adminNewsItems.value ?? newsData.value ?? []) {
    items.push({
      type: "news",
      id: n.id,
      title: n.title,
      teaser: n.teaser || null,
      imageId: n.image?.id || null,
      imageType: n.image?.type || null,
      date: n.date_published || n.date_created,
      status: n.status || "published",
      href: `/news/${n.slug}`,
    });
  }

  for (const a of articlesData.value || []) {
    items.push({
      type: "project",
      id: a.id,
      title: a.title,
      teaser: a.abstract || null,
      imageId: a.image?.id || null,
      imageType: a.image?.type || null,
      date: a.date_created,
      href: `/projects/${a.slug}`,
    });
  }

  const now = new Date();
  for (const e of eventsData.value || []) {
    if (e.start_date && new Date(e.start_date) >= now) continue; // future events shown in "Zukünftig" section
    items.push({
      type: "event",
      id: e.id,
      title: e.title,
      teaser: stripHtml(e.description),
      imageId: e.image?.id || null,
      imageType: e.image?.type || null,
      date: e.start_date || e.date_created,
      endDate: e.end_date || null,
      eventType: e.event_type || null,
      location: e.location || null,
      href: `/events/${e.slug}`,
    });
  }

  for (const m of municipalitiesData.value || []) {
    items.push({
      type: "municipality",
      id: m.id,
      title: m.name,
      teaser: m.description || null,
      imageId: m.image?.id || null,
      imageType: m.image?.type || null,
      date: m.date_updated,
      href: `/municipalities/${m.slug}`,
    });
  }

  for (const c of catalogData.value || []) {
    items.push({
      type: "catalog",
      id: c.id,
      title: c.name,
      teaser: $t("news.catalog_published"),
      imageId: null,
      imageType: null,
      date: c.date_created,
      href: `/measures?v=${encodeURIComponent(c.name)}`,
    });
  }

  // Sort all items by date descending
  return items.sort((a, b) => new Date(b.date) - new Date(a.date));
});

// ── Filtering ──────────────────────────────────────────────────────────────────

const activeFilter = ref(null);

const filterOptions = computed(() => [
  {
    value: "news",
    label: $t("news.filter.news"),
    activeClass: "slk-bright-badge slk-bright-badge--teal bg-teal-600 text-white border-teal-600",
  },
  {
    value: "project",
    label: $t("news.filter.project"),
    activeClass: "slk-bright-badge slk-bright-badge--blue bg-[#006e94] text-white border-[#006e94]",
  },
  {
    value: "event",
    label: $t("news.filter.event"),
    activeClass: "slk-bright-badge slk-bright-badge--green bg-[#1da64a] text-white border-[#1da64a]",
  },
  {
    value: "municipality",
    label: $t("news.filter.municipality"),
    activeClass: "slk-bright-badge slk-bright-badge--lime bg-[#afca0b] text-white border-[#afca0b]",
  },
  {
    value: "catalog",
    label: $t("news.filter.catalog"),
    activeClass: "slk-bright-badge slk-bright-badge--neutral bg-[#6b7280] text-white border-[#6b7280]",
  },
]);

const visibleItems = computed(() =>
  activeFilter.value ? allItems.value.filter((i) => i.type === activeFilter.value) : allItems.value,
);

const groupedByMonth = computed(() => {
  const map = new Map();
  for (const item of visibleItems.value) {
    const key = getEventMonthKey(item.date);
    const label = formatEventMonth(item.date, $locale);
    if (!key) continue;
    if (!map.has(key)) map.set(key, { monthKey: key, label, items: [] });
    map.get(key).items.push(item);
  }
  return [...map.values()];
});

const upcomingEvents = computed(() => {
  const upcoming = new Date();
  return (eventsData.value || [])
    .filter((e) => e.start_date && new Date(e.start_date) >= upcoming)
    .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))
    .slice(0, 2);
});

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDate(iso) {
  return formatBerlinDate(iso, $locale);
}

function typeLabel(type) {
  const translated = $t(`news.type.${type}`);
  return translated === `news.type.${type}` ? type : translated;
}

function eventTypeLabel(type) {
  if (!type) return "";
  const translated = $t(`events.type.${type}`);
  return translated === `events.type.${type}` ? type : translated;
}

function statusLabel(status) {
  const translated = $t(`status.${status}`);
  return translated === `status.${status}` ? status : translated;
}

function typeBadgeClass(type) {
  return (
    {
      news: "slk-bright-badge slk-bright-badge--teal bg-teal-600 text-white",
      project: "slk-bright-badge slk-bright-badge--blue bg-[#006e94] text-white",
      event: "slk-bright-badge slk-bright-badge--green bg-[#1da64a] text-white",
      municipality: "slk-bright-badge slk-bright-badge--lime bg-[#afca0b] text-white",
      catalog: "slk-bright-badge slk-bright-badge--neutral bg-[#6b7280] text-white",
    }[type] ?? "bg-gray-200 text-gray-700"
  );
}

function typeEmoji(type) {
  return { news: "📰", project: "🏆", event: "📅", municipality: "🏙️", catalog: "📋" }[type] ?? "•";
}

// ── Admin: create new news item ────────────────────────────────────────────────

const creating = ref(false);

async function createNewsItem() {
  const title = window.prompt($t("news.create.prompt"));
  if (!title?.trim()) return;

  const slug = `${createSlug(title)}-${Date.now().toString(36)}`;

  creating.value = true;
  try {
    const client = getAuthenticatedClient();
    const result = await client.request(
      createItem("news_items", {
        title: title.trim(),
        slug,
        status: "draft",
      }),
    );
    await navigateTo(`/news/${result.slug}`);
  } catch (err) {
    alert($t("news.create.error", { ":message": err?.errors?.[0]?.message || err?.message || err }));
  } finally {
    creating.value = false;
  }
}
</script>

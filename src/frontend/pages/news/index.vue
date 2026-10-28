<template>
  <div class="container mx-auto px-4 py-8">
    <header class="mb-10 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="mb-4 font-heading text-4xl font-black text-stats-dark sm:text-6xl">{{ $t("news.title") }}</h1>
        <p class="max-w-3xl text-lg leading-relaxed text-gray">{{ $t("news.description") }}</p>
      </div>
      <CanonicalButton
        v-if="isAuthenticated"
        :label="creating ? $t('generic.loading') : $t('news.create')"
        icon-slug="mdi:plus"
        color="dark"
        :disabled="creating"
        @click="createNewsItem"
      />
    </header>

    <!-- Type filter pills -->
    <div class="mb-6 flex flex-wrap gap-2">
      <button
        type="button"
        :class="[
          'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-colors',
          activeFilter === null
            ? 'border-[#374151] bg-[#374151] text-white'
            : 'border-[#e5e7eb] bg-[#e5e7eb] text-[#374151] hover:bg-[#d1d5db]',
        ]"
        @click="activeFilter = null"
      >
        Alle
      </button>
      <button
        v-for="f in filterOptions"
        :key="f.value"
        type="button"
        :class="[
          'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-colors',
          activeFilter === f.value ? f.activeClass : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400',
        ]"
        @click="activeFilter = f.value"
      >
        {{ f.label }}
      </button>
    </div>

    <!-- Sidebar + feed layout -->
    <!-- Mobile sticky scroll nav -->
    <nav
      class="sticky z-10 -mx-4 mb-6 border-b border-gray-100 bg-white/90 px-4 backdrop-blur-xs xl:hidden"
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
            'shrink-0 rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors',
            activeSection === 'section-zukunftig'
              ? 'bg-[#1da64a]/10 font-semibold text-[#1da64a]'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200',
          ]"
          >Zukünftig</a
        >
        <a
          v-for="group in groupedByMonth"
          :key="group.monthKey"
          :href="`#section-${group.monthKey}`"
          :class="[
            'shrink-0 rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors',
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
      <nav class="sticky hidden w-44 shrink-0 self-start text-sm xl:block" :style="`top: ${headerHeight + 12}px`">
        <p class="mb-3 text-xs font-bold tracking-widest text-gray-400 uppercase">Abschnitte</p>
        <ul class="space-y-1">
          <li v-if="upcomingEvents.length && (activeFilter === null || activeFilter === 'event')">
            <a
              href="#section-zukunftig"
              :class="[
                'block truncate rounded-sm px-2 py-1 transition-colors',
                activeSection === 'section-zukunftig'
                  ? 'bg-[#1da64a]/5 font-semibold text-[#1da64a]'
                  : 'text-gray-400 hover:bg-gray-50 hover:text-gray-700',
              ]"
              >Zukünftig</a
            >
          </li>
          <li v-for="group in groupedByMonth" :key="group.monthKey">
            <a
              :href="`#section-${group.monthKey}`"
              :class="[
                'block truncate rounded-sm px-2 py-1 transition-colors',
                activeSection === `section-${group.monthKey}`
                  ? 'bg-[#006e94]/5 font-semibold text-[#006e94]'
                  : 'text-gray-400 hover:bg-gray-50 hover:text-gray-700',
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
          <div class="mb-4 flex items-center justify-between border-b border-gray-200 pb-2">
            <h2 class="text-base font-semibold tracking-wide text-gray-500 uppercase">Zukünftig</h2>
            <NuxtLink
              to="/events"
              class="flex shrink-0 items-center gap-1 text-sm font-medium text-[#1da64a] hover:underline"
            >
              Alle Veranstaltungen
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
              class="group flex cursor-pointer flex-col overflow-hidden rounded-lg border border-gray-100 bg-white shadow-xs transition-all duration-150 hover:border-[#16BAE7]/60 hover:shadow-md focus-visible:ring-2 focus-visible:ring-[#16BAE7] focus-visible:outline-hidden"
            >
              <!-- Thumbnail -->
              <div class="relative h-40 shrink-0 overflow-hidden bg-gray-50">
                <div
                  v-if="!ev.image"
                  class="absolute inset-0 flex items-center justify-center bg-linear-to-br from-[#1da64a]/20 via-[#1da64a]/10 to-[#1da64a]/30"
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
                  :asset-id="ev.image?.id"
                  :is-raster="ev.image?.type ? isRaster(ev.image.type) : true"
                  :alt="ev.title"
                  :width="480"
                  :height="160"
                  fit="cover"
                  img-class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <span class="absolute top-2 left-2 rounded-full bg-[#1da64a] px-2 py-0.5 text-xs font-bold text-white"
                  >Veranstaltung</span
                >
                <!-- Image credits overlay on hover -->
                <div
                  v-if="ev.image_credits && ev.image"
                  :title="ev.image_credits"
                  class="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-black/50 px-2 py-1 text-[10px] text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100"
                >
                  {{ ev.image_credits }}
                </div>
              </div>
              <!-- Card body -->
              <div class="flex flex-1 flex-col gap-1 p-4">
                <h3
                  class="line-clamp-2 leading-snug font-bold text-gray-900 transition-colors group-hover:text-[#006e94]"
                >
                  {{ ev.title }}
                </h3>
                <div class="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span
                    v-if="ev.event_type"
                    class="rounded-full bg-[#1da64a]/10 px-2 py-0.5 text-xs font-semibold tracking-wide text-[#1da64a] uppercase dark:bg-(--slk-green) dark:text-(--slk-text-strong)"
                  >
                    {{
                      { conference: "Konferenz", workshop: "Workshop", webinar: "Webinar", other: "Sonstiges" }[
                        ev.event_type
                      ] ?? ev.event_type
                    }}
                  </span>
                  <span class="flex items-center gap-1 text-xs text-gray-500">
                    <svg
                      class="h-3.5 w-3.5 shrink-0"
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
                    {{ formatDateRange(ev.start_date, ev.end_date) }}
                  </span>
                  <span v-if="ev.location" class="flex items-center gap-1 text-xs text-gray-500">
                    <svg
                      class="h-3.5 w-3.5 shrink-0"
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
          Keine Einträge gefunden.
        </div>

        <div
          v-for="group in groupedByMonth"
          :id="`section-${group.monthKey}`"
          :key="group.monthKey"
          class="mb-10"
          :style="`scroll-margin-top: ${headerHeight + 16}px`"
        >
          <!-- Month heading -->
          <h2 class="mb-4 border-b border-gray-200 pb-2 text-base font-semibold tracking-wide text-gray-500 uppercase">
            {{ group.label }}
          </h2>

          <div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            <component
              :is="item.href ? NuxtLinkComponent : 'div'"
              v-for="item in group.items"
              :key="`${item.type}-${item.id}`"
              :to="item.href || undefined"
              :class="
                item.href
                  ? 'group flex cursor-pointer flex-col overflow-hidden rounded-lg border border-gray-100 bg-white shadow-xs transition-all duration-150 hover:border-[#16BAE7]/60 hover:shadow-md focus-visible:ring-2 focus-visible:ring-[#16BAE7] focus-visible:outline-hidden'
                  : 'flex flex-col overflow-hidden rounded-lg border border-dashed border-gray-200 bg-gray-50 opacity-80'
              "
            >
              <!-- Thumbnail -->
              <div
                :class="
                  item.href
                    ? 'relative h-40 shrink-0 overflow-hidden bg-gray-50'
                    : 'relative flex h-40 shrink-0 items-center justify-center bg-gray-100'
                "
              >
                <!-- Catalog: gray gradient with all sector icons -->
                <div
                  v-if="item.type === 'catalog'"
                  class="absolute inset-0 flex items-center justify-center bg-linear-to-br from-[#6b7280]/25 via-[#6b7280]/10 to-[#6b7280]/35"
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
                  class="absolute inset-0 flex items-center justify-center bg-linear-to-br from-[#1da64a]/20 via-[#1da64a]/10 to-[#1da64a]/30"
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
                  :asset-id="item.imageId"
                  :asset-base-url="item.assetBaseUrl"
                  :is-raster="isRaster(item.imageType)"
                  :alt="item.title"
                  :width="480"
                  :height="160"
                  fit="cover"
                  img-class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <!-- News: teal gradient + info icon -->
                <div
                  v-else-if="item.type === 'news'"
                  class="absolute inset-0 flex items-center justify-center bg-linear-to-br from-teal-100 via-teal-50 to-teal-200"
                >
                  <img src="~/assets/icons/icon_info.svg" alt="" class="h-16 w-16 opacity-20" />
                </div>
                <!-- Project: blue gradient + klimachecker icon -->
                <div
                  v-else-if="item.type === 'project'"
                  class="absolute inset-0 flex items-center justify-center bg-linear-to-br from-[#006e94]/20 via-[#006e94]/10 to-[#006e94]/30"
                >
                  <img src="~/assets/icons/icon_klimachecker.svg" alt="" class="h-16 w-16 opacity-20" />
                </div>
                <!-- Municipality: yellow-green gradient + location icon -->
                <div
                  v-else-if="item.type === 'municipality'"
                  class="absolute inset-0 flex items-center justify-center bg-linear-to-br from-[#afca0b]/20 via-[#afca0b]/10 to-[#afca0b]/30"
                >
                  <img src="~/assets/icons/icon_location_green_marker.svg" alt="" class="h-16 w-16 opacity-20" />
                </div>
                <span v-else class="text-4xl opacity-20">{{ typeEmoji(item.type) }}</span>
                <span
                  :class="[
                    'absolute top-2 left-2 rounded-full px-2 py-0.5 text-xs font-bold',
                    typeBadgeClass(item.type),
                  ]"
                >
                  {{ typeLabel(item.type) }}
                </span>
                <!-- Image credits overlay on hover -->
                <div
                  v-if="item.imageCredits && item.imageId"
                  :title="item.imageCredits"
                  class="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-black/50 px-2 py-1 text-[10px] text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100"
                >
                  {{ item.imageCredits }}
                </div>
                <!-- Status badge for non-published news items (editors only) -->
                <span
                  v-if="item.status && item.status !== 'published'"
                  :class="[
                    'absolute top-2 right-2 rounded-full px-2 py-0.5 text-xs font-bold tracking-wide uppercase',
                    item.status === 'draft' ? 'bg-[#fbbf24] text-[#78350f]' : 'bg-[#9ca3af] text-white',
                  ]"
                  >{{ item.status === "draft" ? "Entwurf" : "Archiviert" }}</span
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
                      ? 'line-clamp-2 leading-snug font-bold text-gray-900 transition-colors group-hover:text-[#006e94]'
                      : 'line-clamp-2 leading-snug font-bold text-gray-700'
                  "
                >
                  {{ item.title }}
                </h3>
                <!-- Event metadata: type badge, date, location -->
                <div v-if="item.type === 'event'" class="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span
                    v-if="item.eventType"
                    class="rounded-full bg-[#1da64a]/10 px-2 py-0.5 text-xs font-semibold tracking-wide text-[#1da64a] uppercase dark:bg-(--slk-green) dark:text-(--slk-text-strong)"
                  >
                    {{
                      { conference: "Konferenz", workshop: "Workshop", webinar: "Webinar", other: "Sonstiges" }[
                        item.eventType
                      ] ?? item.eventType
                    }}
                  </span>
                  <span class="flex items-center gap-1 text-xs text-gray-500">
                    <svg
                      class="h-3.5 w-3.5 shrink-0"
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
                    {{ formatDateRange(item.date, item.endDate) }}
                  </span>
                  <span v-if="item.location" class="flex items-center gap-1 text-xs text-gray-500">
                    <svg
                      class="h-3.5 w-3.5 shrink-0"
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
                  :class="item.href ? 'line-clamp-3 text-sm text-gray-500' : 'line-clamp-3 text-sm text-gray-400'"
                >
                  {{ item.teaser }}
                </p>
                <div class="mt-auto flex items-center justify-between pt-2">
                  <time v-if="item.type !== 'event'" class="text-xs text-gray-400" :datetime="item.date ?? undefined">{{
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

<script setup lang="ts">
import { clientDiagnostic } from "~/shared/securityLog";

import {
  parseBerlinDateTime,
  formatBerlinDate as formatDate,
  formatBerlinDateRange as formatDateRange,
  getEventMonthKey,
  formatEventMonth,
} from "~/shared/eventDateTime";
import { visitHasEnded } from "~/shared/tour";
import { computed, ref, watch, resolveComponent, onMounted, onUnmounted } from "vue";
import { requestErrorMessage } from "~/shared/requestError";
import { useAuth } from "~/composables/useAuth";
import { useHeaderHeight } from "~/composables/useHeaderHeight";
import { useMobileHeaderHidden } from "~/composables/useMobileHeaderHidden";
import sectorImages from "~/shared/sectorImages";

import { isRaster } from "~/shared/utils";
const fetchContent = useContentFetch();

type FeedItem = {
  type: string;
  id: string | number;
  title: string;
  teaser?: string | null | undefined;
  imageId: string | null;
  imageType: string | null;
  imageCredits?: string | null | undefined;
  date: string | null;
  href: string;
  status?: string | undefined;
  endDate?: string | null | undefined;
  eventType?: string | null | undefined;
  location?: string | null | undefined;
  assetBaseUrl?: string | undefined;
};
function stripHtml(html: string | null) {
  if (!html) return null;
  return (
    html
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim() || null
  );
}

const NuxtLinkComponent = resolveComponent("NuxtLink");

const { $t } = useNuxtApp();

const { isAuthenticated, initialize } = useAuth();
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
const activeSection = ref<string | null>(null);
const mobilePillStrip = ref<HTMLElement | null>(null);
let sectionObserver: IntersectionObserver | null = null;

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
    sections.forEach((s) => sectionObserver?.observe(s));
  };
  // Wait one tick for v-for sections to be rendered
  setTimeout(observe, 100);
});

onUnmounted(() => {
  sectionObserver?.disconnect();
});

// Null until the admin re-fetch completes; when set, overrides the SSR news list
const editor = useNewsEditor();
const adminNewsItems = shallowRef<Awaited<ReturnType<typeof editor.list>> | null>(null);

watch(isAuthenticated, (authenticated) => {
  if (!authenticated) adminNewsItems.value = null;
});
onMounted(async () => {
  await initialize();
  if (isAuthenticated.value) {
    try {
      adminNewsItems.value = await editor.list();
    } catch {
      clientDiagnostic("app.pages.news.index.degraded", "warn");
    }
  }
});

const seoText = useSeoText();
usePageSeo({ title: () => seoText("seo.news.title") });

// ── Data fetching ──────────────────────────────────────────────────────────────

const { data: feedData } = await useAsyncData("public-news-feed", () => fetchContent("/api/public/news"));
const newsData = computed(() => feedData.value?.news ?? []);
const articlesData = computed(() => feedData.value?.articles ?? []);
const eventsData = computed(() => feedData.value?.events ?? []);
const municipalitiesData = computed(() => feedData.value?.municipalities ?? []);
const catalogData = computed(() => feedData.value?.catalogs ?? []);
const visitReports = computed(() => feedData.value?.visitReports ?? []);

// ── Map to unified feed items ──────────────────────────────────────────────────

const allItems = computed(() => {
  const items: FeedItem[] = [];

  for (const n of adminNewsItems.value ?? newsData.value ?? []) {
    items.push({
      type: "news",
      id: n.id,
      title: n.title,
      teaser: n.teaser || null,
      imageId: n.image?.id || null,
      imageType: n.image?.type || null,
      imageCredits: n.image_credits || null,
      date: n.date_published || n.date_created,
      status: "status" in n && typeof n.status === "string" ? n.status : "published",
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
      imageCredits: a.image_credits || null,
      date: a.date_created,
      href: `/projects/${a.slug}`,
    });
  }

  const now = new Date();
  for (const e of eventsData.value || []) {
    if (e.event_category === "internal") continue;
    if (e.start_date && (parseBerlinDateTime(e.start_date)?.getTime() ?? 0) >= now.getTime()) continue; // future events shown in "Zukünftig" section
    items.push({
      type: "event",
      id: e.id,
      title: e.title,
      teaser: stripHtml(e.description),
      imageId: e.image?.id || null,
      imageType: e.image?.type || null,
      imageCredits: e.image_credits || null,
      date: e.start_date || e.date_created,
      endDate: e.end_date || null,
      eventType: e.event_type || null,
      location: e.location || null,
      href: `/events/${e.slug}`,
    });
  }

  for (const report of visitReports.value || []) {
    const visit = report;
    if (!visit || !visitHasEnded(visit.start_date, visit.end_date, now)) continue;
    items.push({
      type: "news",
      id: `visit-${report.id}`,
      title: report.report_title || report.title,
      teaser: report.teaser,
      imageId: report.image?.id || null,
      imageType: report.image?.type || null,
      imageCredits: report.image_credits || null,
      assetBaseUrl: "/api/tour-media",
      date: report.date_published || visit.start_date,
      href: `/projects/tours/${visit.tour.slug}/${visit.slug}`,
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
      imageCredits: m.image_credits || null,
      date: m.date_updated,
      href: `/municipalities/${m.slug}`,
    });
  }

  for (const c of catalogData.value || []) {
    items.push({
      type: "catalog",
      id: c.id,
      title: c.name,
      teaser: "Neuer Maßnahmenkatalog veröffentlicht",
      imageId: null,
      imageType: null,
      date: c.date_created,
      href: `/measures?v=${encodeURIComponent(c.name)}`,
    });
  }

  // Sort all items by date descending
  return items.sort(
    (a, b) => (parseBerlinDateTime(b.date)?.getTime() ?? 0) - (parseBerlinDateTime(a.date)?.getTime() ?? 0),
  );
});

// ── Filtering ──────────────────────────────────────────────────────────────────

const activeFilter = ref<string | null>(null);

const filterOptions = [
  { value: "news", label: "Neuigkeiten", activeClass: "bg-teal-600 text-white border-teal-600" },
  { value: "project", label: "Erfolgsprojekte", activeClass: "bg-[#006e94] text-white border-[#006e94]" },
  { value: "event", label: "Veranstaltungen", activeClass: "bg-[#1da64a] text-white border-[#1da64a]" },
  { value: "municipality", label: "Kommunen", activeClass: "bg-[#afca0b] text-white border-[#afca0b]" },
  { value: "catalog", label: "Maßnahmenkataloge", activeClass: "bg-[#6b7280] text-white border-[#6b7280]" },
];

const visibleItems = computed(() =>
  activeFilter.value ? allItems.value.filter((i) => i.type === activeFilter.value) : allItems.value,
);

const groupedByMonth = computed(() => {
  const map = new Map<string, { monthKey: string; label: string; items: FeedItem[] }>();
  for (const item of visibleItems.value) {
    const key = getEventMonthKey(item.date);
    const label = formatEventMonth(item.date);
    if (!map.has(key)) map.set(key, { monthKey: key, label, items: [] });
    map.get(key)?.items.push(item);
  }
  return [...map.values()];
});

const upcomingEvents = computed(() => {
  const upcoming = new Date();
  return (eventsData.value || [])
    .filter(
      (e) =>
        e.event_category !== "internal" &&
        e.start_date &&
        (parseBerlinDateTime(e.start_date)?.getTime() ?? 0) >= upcoming.getTime(),
    )
    .sort(
      (a, b) =>
        (parseBerlinDateTime(a.start_date)?.getTime() ?? 0) - (parseBerlinDateTime(b.start_date)?.getTime() ?? 0),
    )
    .slice(0, 2);
});

// ── Helpers ────────────────────────────────────────────────────────────────────

function typeLabel(type: string) {
  return (
    {
      news: "Neuigkeit",
      project: "Erfolgsprojekt",
      event: "Veranstaltung",
      municipality: "Bewertung geupdated",
      catalog: "Maßnahmenkatalog",
    }[type as "news" | "project" | "event" | "municipality" | "catalog"] ?? type
  );
}

function typeBadgeClass(type: string) {
  return (
    {
      news: "bg-teal-600 text-white",
      project: "bg-[#006e94] text-white",
      event: "bg-[#1da64a] text-white",
      municipality: "bg-[#afca0b] text-white",
      catalog: "bg-[#6b7280] text-white",
    }[type as "news" | "project" | "event" | "municipality" | "catalog"] ?? "bg-gray-200 text-gray-700"
  );
}

function typeEmoji(type: string) {
  return (
    { news: "📰", project: "🏆", event: "📅", municipality: "🏙️", catalog: "📋" }[
      type as "news" | "project" | "event" | "municipality" | "catalog"
    ] ?? "•"
  );
}

// ── Admin: create new news item ────────────────────────────────────────────────

const creating = ref(false);

async function createNewsItem() {
  const title = window.prompt("Titel der neuen Neuigkeit:");
  if (!title?.trim()) return;

  const slug =
    title
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // strip accents
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") +
    "-" +
    Date.now().toString(36);

  creating.value = true;
  try {
    const result = await editor.create(title.trim(), slug);
    await navigateTo(`/news/${result.slug}`);
  } catch (err) {
    alert("Fehler beim Erstellen: " + requestErrorMessage(err, $t("generic.technical_error")));
  } finally {
    creating.value = false;
  }
}
</script>

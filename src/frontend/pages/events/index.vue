<template>
  <div class="py-8">
    <h1 class="mb-8 text-3xl font-bold">{{ $t("events.title") }}</h1>

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
          v-if="currentEvents.length"
          href="#section-momentan"
          :class="[
            'flex-shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors',
            activeSection === 'section-momentan'
              ? 'bg-orange-100 text-orange-700'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200',
          ]"
          >{{ $t("events.section.current") }}</a
        >
        <a
          v-for="group in futureGroups"
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
        <a
          v-for="group in pastGroups"
          :key="group.monthKey"
          :href="`#section-${group.monthKey}`"
          :class="[
            'flex-shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors',
            activeSection === `section-${group.monthKey}`
              ? 'bg-gray-200 text-gray-700 font-semibold'
              : 'bg-gray-100 text-gray-400 hover:bg-gray-200',
          ]"
          >{{ group.label }}</a
        >
      </div>
    </nav>

    <div class="flex items-start gap-8">
      <!-- Left sticky sidebar (desktop only) -->
      <nav class="sticky hidden w-44 flex-shrink-0 self-start text-sm xl:block" :style="`top: ${headerHeight + 12}px`">
        <p class="text-gray-400 mb-3 text-xs font-bold uppercase tracking-widest">{{ $t("news.sections") }}</p>
        <ul class="space-y-1">
          <li v-if="currentEvents.length">
            <a
              href="#section-momentan"
              :class="[
                'block truncate rounded px-2 py-1 transition-colors',
                activeSection === 'section-momentan'
                  ? 'text-orange-600 bg-orange-50 font-semibold'
                  : 'text-gray-400 hover:text-gray-700 hover:bg-gray-50',
              ]"
              >{{ $t("events.section.current") }}</a
            >
          </li>
          <li v-for="group in futureGroups" :key="group.monthKey">
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
          <li v-for="group in pastGroups" :key="group.monthKey">
            <a
              :href="`#section-${group.monthKey}`"
              :class="[
                'block truncate rounded px-2 py-1 transition-colors',
                activeSection === `section-${group.monthKey}`
                  ? 'text-gray-600 bg-gray-100 font-semibold'
                  : 'text-gray-400 hover:text-gray-700 hover:bg-gray-50',
              ]"
              >{{ group.label }}</a
            >
          </li>
        </ul>
      </nav>

      <!-- Main content -->
      <div class="min-w-0 flex-1">
        <!-- Currently happening -->
        <div
          v-if="currentEvents.length"
          id="section-momentan"
          class="mb-10"
          :style="`scroll-margin-top: ${headerHeight + 16}px`"
        >
          <h2
            class="text-orange-600 border-orange-200 mb-4 flex items-center border-b pb-2 text-base font-semibold uppercase tracking-wide"
          >
            <span class="bg-orange-500 inline-block h-2 w-2 animate-pulse rounded-full"></span>
            {{ $t("events.section.current") }}
          </h2>
          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <EventCard v-for="event in currentEvents" :key="event.id" :event="event" variant="current" />
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
            <h2
              class="text-gray-500 border-gray-200 mb-4 border-b pb-2 text-base font-semibold uppercase tracking-wide"
            >
              {{ group.label }}
            </h2>
            <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <EventCard v-for="event in group.events" :key="event.id" :event="event" />
            </div>
          </div>
        </div>
        <div v-else-if="!currentEvents.length" class="text-gray-500 mb-8 italic">
          {{ $t("events.no_upcoming") }}
        </div>

        <!-- Past events -->
        <div
          v-if="pastGroups.length"
          id="section-vergangen"
          class="mt-10"
          :style="`scroll-margin-top: ${headerHeight + 16}px`"
        >
          <h2 class="text-gray-400 border-gray-100 mb-6 border-b pb-2 text-base font-semibold uppercase tracking-wide">
            {{ $t("events.past") }}
          </h2>
          <div
            v-for="group in pastGroups"
            :key="group.monthKey"
            :id="`section-${group.monthKey}`"
            class="mb-10"
            :style="`scroll-margin-top: ${headerHeight + 16}px`"
          >
            <h2 class="text-gray-400 border-gray-100 mb-4 border-b pb-2 text-sm font-semibold uppercase tracking-wide">
              {{ group.label }}
            </h2>
            <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <EventCard v-for="event in group.events" :key="event.id" :event="event" variant="past" />
            </div>
          </div>
        </div>
      </div>
      <!-- /main content -->
    </div>
    <!-- /flex layout -->
  </div>
</template>

<script setup>
import { computed, ref, watch, onMounted, onUnmounted } from "vue";
import { useHeaderHeight } from "~/composables/useHeaderHeight.js";
import { useMobileHeaderHidden } from "~/composables/useMobileHeaderHidden.js";
import { formatEventMonth, getEventMonthKey } from "~/shared/eventDateTime";
const { $directus, $readItems, $t, $locale } = useNuxtApp();
const headerHeight = useHeaderHeight();
const mobileHeaderHidden = useMobileHeaderHidden();
const isDesktop = useState("layout-isDesktop");
// On desktop use actual header height (no CSS transition needed — headerHeight updates
// every frame via ResizeObserver so the pill follows the nav strip animation precisely).
// On mobile use a fixed 64px / 0 with a CSS transition to match the header slide.
const pillTop = computed(() => {
  return isDesktop.value ? headerHeight.value : mobileHeaderHidden.value ? 0 : 64;
});

useHead({ title: computed(() => $t("events.title")) });

const { data: events } = await useAsyncData("events-list", async () => {
  try {
    const results = await $directus.request(
      $readItems("events", {
        filter: { status: { _eq: "published" } },
        fields: ["id", "title", "slug", "start_date", "end_date", "location", "event_type", { image: ["id", "type"] }],
        sort: ["start_date"],
        limit: -1,
      }),
    );
    return results;
  } catch (e) {
    console.warn("[events] Failed to load events:", e?.message);
    return [];
  }
});

const now = new Date();

// Events currently happening: started but not yet ended
const currentEvents = computed(() =>
  (events.value || []).filter((e) => {
    if (!e.start_date) return false;
    const start = new Date(e.start_date);
    const end = e.end_date ? new Date(e.end_date) : null;
    return start <= now && end && end >= now;
  }),
);

// Strictly future events (start_date > now)
const futureEvents = computed(() => (events.value || []).filter((e) => e.start_date && new Date(e.start_date) > now));

// Past events (end_date < now, or no end_date and start_date < now)
const pastEvents = computed(() =>
  (events.value || []).filter((e) => {
    if (!e.start_date) return false;
    const start = new Date(e.start_date);
    const end = e.end_date ? new Date(e.end_date) : null;
    if (end) return end < now;
    return start < now;
  }),
);

function groupByMonth(evList) {
  const map = new Map();
  for (const ev of evList) {
    const key = getEventMonthKey(ev.start_date);
    const label = formatEventMonth(ev.start_date, $locale);
    if (!key) continue;
    if (!map.has(key)) map.set(key, { monthKey: key, label, events: [] });
    map.get(key).events.push(ev);
  }
  return [...map.values()];
}

const futureGroups = computed(() => groupByMonth(futureEvents.value));
const pastGroups = computed(() => {
  const sorted = [...pastEvents.value].sort((a, b) => new Date(b.start_date) - new Date(a.start_date));
  return groupByMonth(sorted);
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
          if (entry.isIntersecting) activeSection.value = entry.target.id;
        }
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: 0 },
    );
    sections.forEach((s) => sectionObserver.observe(s));
  };
  setTimeout(observe, 100);
});

onUnmounted(() => {
  sectionObserver?.disconnect();
});
</script>

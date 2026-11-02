<template>
  <div class="container mx-auto px-2 py-6 sm:px-4 sm:py-8">
    <header class="mb-10">
      <h1 class="mb-4 font-heading text-4xl font-black text-stats-dark sm:text-6xl">{{ $t("events.title") }}</h1>
      <p class="max-w-3xl text-lg leading-relaxed text-gray">{{ $t("events.hero.description") }}</p>
    </header>

    <!-- Full-width timeline navigation -->
    <nav
      class="slk-timeline-navigation sticky z-10 mb-6 w-full border-b border-(--slk-border) bg-base-100"
      :class="isDesktop ? '' : 'transition-[top] duration-300 ease-in-out'"
      :style="`top: ${pillTop}px`"
    >
      <div
        ref="mobilePillStrip"
        class="flex w-full gap-2 overflow-x-auto py-2"
        style="scrollbar-width: none; -ms-overflow-style: none"
      >
        <a
          v-if="currentEvents.length"
          href="#section-momentan"
          class="slk-timeline-pill"
          :aria-current="activeSection === 'section-momentan' ? 'location' : undefined"
          >{{ $t("events.section.current") }}</a
        >
        <a
          v-for="group in futureGroups"
          :key="group.monthKey"
          :href="`#section-${group.monthKey}`"
          class="slk-timeline-pill"
          :aria-current="activeSection === `section-${group.monthKey}` ? 'location' : undefined"
          >{{ group.label }}</a
        >
        <a
          v-for="group in pastGroups"
          :key="group.monthKey"
          :href="`#section-${group.monthKey}`"
          class="slk-timeline-pill"
          :aria-current="activeSection === `section-${group.monthKey}` ? 'location' : undefined"
          >{{ group.label }}</a
        >
      </div>
    </nav>

    <div class="flex items-start gap-8">
      <!-- Main content -->
      <div class="min-w-0 flex-1">
        <!-- Currently happening -->
        <div
          v-if="currentEvents.length"
          id="section-momentan"
          class="mb-10"
          :style="`scroll-margin-top: ${sectionOffset}px`"
        >
          <h2 class="mb-4 flex items-center border-b border-orange-200 pb-2 text-base font-semibold text-orange-600">
            <span class="inline-block h-2 w-2 animate-pulse rounded-full bg-orange-500"></span>
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
            :id="`section-${group.monthKey}`"
            :key="group.monthKey"
            class="mb-10"
            :style="`scroll-margin-top: ${sectionOffset}px`"
          >
            <h2 class="mb-4 border-b border-gray-200 pb-2 text-base font-semibold text-gray-500">
              {{ group.label }}
            </h2>
            <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <EventCard v-for="event in group.events" :key="event.id" :event="event" />
            </div>
          </div>
        </div>
        <div v-else-if="!currentEvents.length" class="mb-8 text-gray-500 italic">
          {{ $t("events.no_upcoming") }}
        </div>

        <!-- Past events -->
        <div
          v-if="pastGroups.length"
          id="section-vergangen"
          class="mt-10"
          :style="`scroll-margin-top: ${sectionOffset}px`"
        >
          <h2 class="mb-6 border-b border-gray-100 pb-2 text-base font-semibold text-gray-400">
            {{ $t("events.past") }}
          </h2>
          <div
            v-for="group in pastGroups"
            :id="`section-${group.monthKey}`"
            :key="group.monthKey"
            class="mb-10"
            :style="`scroll-margin-top: ${sectionOffset}px`"
          >
            <h2 class="mb-4 border-b border-gray-100 pb-2 text-sm font-semibold text-gray-400">
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

<script setup lang="ts">
import { clientDiagnostic } from "~/shared/securityLog";

import type { PublicEvent } from "~/shared/contracts/content";
import { computed } from "vue";
import { formatEventMonth, getEventMonthKey, getEventPhase } from "~/shared/eventDateTime";
const fetchContent = useContentFetch();

const { $t, $locale } = useNuxtApp();
const { isDesktop, pillTop, sectionOffset, activeSection, mobilePillStrip } = useTimelineNavigation();

usePageSeo({ title: computed(() => $t("events.title")) });

const { data: eventsResult } = await useAsyncData("events-list", async () => {
  try {
    const result = await fetchContent("/api/public/events", {
      query: { excludeInternal: "true", limit: "-1", sort: "start_date" },
    });
    return result;
  } catch {
    clientDiagnostic("app.pages.events.index.degraded", "warn");
    return { events: [] };
  }
});
const events = computed(() => eventsResult.value?.events ?? []);

const now = new Date();

const currentEvents = computed(() =>
  (events.value || []).filter(
    (event) => getEventPhase(event.start_date, event.end_date, event.date_only, now) === "current",
  ),
);
const futureEvents = computed(() =>
  (events.value || []).filter(
    (event) => getEventPhase(event.start_date, event.end_date, event.date_only, now) === "future",
  ),
);
const pastEvents = computed(() =>
  (events.value || []).filter(
    (event) => getEventPhase(event.start_date, event.end_date, event.date_only, now) === "past",
  ),
);

function groupByMonth(evList: PublicEvent[]) {
  const map = new Map<string, { monthKey: string; label: string; events: PublicEvent[] }>();
  for (const ev of evList) {
    const key = getEventMonthKey(ev.start_date);
    const label = formatEventMonth(ev.start_date, $locale);
    if (!key) continue;
    if (!map.has(key)) map.set(key, { monthKey: key, label, events: [] });
    map.get(key)?.events.push(ev);
  }
  return [...map.values()];
}

const futureGroups = computed(() => groupByMonth(futureEvents.value));
const pastGroups = computed(() => {
  const sorted = [...pastEvents.value].sort(
    (a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime(),
  );
  return groupByMonth(sorted);
});
</script>

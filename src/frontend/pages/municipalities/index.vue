<template>
  <div class="municipalities-page px-4 py-8">
    <header class="mb-8">
      <h1 class="mb-4 font-heading text-4xl font-black text-light-green sm:text-6xl">
        <span v-if="selectedCatalogVersion.name === 'beta'"
          >{{ $t("municipalities.heading") }} {{ $t("ranking.current_year", { ":year": 2025 }) }}</span
        >
        <span v-else>{{ $t("municipalities.heading") }} {{ $t("ranking.current_year", { ":year": 2026 }) }}</span>
      </h1>
      <p class="max-w-3xl text-lg leading-relaxed text-gray">{{ $t("municipalities.hero.description") }}</p>
      <div class="mt-6 flex flex-wrap gap-3">
        <CanonicalButton
          :label="$t('municipalities.hero.catalog')"
          href="/measures"
          icon-slug="mdi:clipboard-list-outline"
          color="bright-green"
          text-color="white"
        />
        <CanonicalButton
          :label="$t('stats.measures.title')"
          href="/stats#massnahmenstatistiken"
          icon-slug="mdi:chart-bar"
          color="bright-green"
          text-color="white"
        />
        <CanonicalButton
          :label="$t('stats.participate')"
          href="/mitmachen"
          icon-slug="mdi:account-group-outline"
          color="bright-green"
          text-color="white"
        />
      </div>
      <p class="mt-4 text-xs text-gray-400">
        <ClientOnly>{{ $t("municipalities.last_updated_at") + lastUpdatedAtStr }}</ClientOnly>
      </p>
    </header>

    <!-- Mobile CTA strip (lg:hidden) — above filter -->
    <div class="mb-4 flex flex-col gap-2 lg:hidden">
      <!-- Werde Klimachecker -->
      <button
        class="flex w-full flex-row items-center gap-3 border-2 bg-white p-3 text-left shadow-md"
        style="border-color: #339737"
        @click="openCalMobile"
      >
        <img :src="onboardingAvatarUrl" alt="Otto" class="h-10 w-10 shrink-0 rounded-full object-cover" />
        <div class="min-w-0 flex-1">
          <h2 class="font-heading text-sm leading-tight font-bold" style="color: #339737">
            {{ $t("municipalities.cta.onboarding.title") }}
          </h2>
          <p class="mt-0.5 line-clamp-1 text-xs text-gray-500">{{ $t("municipalities.cta.onboarding.description") }}</p>
        </div>
        <span
          class="shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold text-white"
          style="background-color: #339737"
        >
          {{ $t("municipalities.cta.onboarding.action") }}
        </span>
      </button>
      <!-- Lokalteam gründen -->
      <NuxtLink
        to="/register_localteam"
        class="flex flex-row items-center gap-3 border-2 bg-white p-3 shadow-md"
        style="border-color: #afca0b"
      >
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style="background-color: #afca0b">
          <svg class="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </div>
        <div class="min-w-0 flex-1">
          <h2 class="font-heading text-sm leading-tight font-bold" style="color: #afca0b">
            {{ $t("localteam.create_now") }}
          </h2>
          <p class="mt-0.5 line-clamp-1 text-xs text-gray-500">{{ $t("municipalities.cta.localteam.description") }}</p>
        </div>
        <span
          class="shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold text-white"
          style="background-color: #afca0b"
        >
          {{ $t("municipalities.cta.missing.action") }}
        </span>
      </NuxtLink>
      <!-- Dashboard Stats -->
      <NuxtLink
        to="/stats#massnahmenstatistiken"
        class="flex flex-row items-center gap-3 border-2 bg-white p-3 shadow-md"
        style="border-color: #006e94"
      >
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style="background-color: #006e94">
          <svg class="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
        </div>
        <div class="min-w-0 flex-1">
          <h2 class="font-heading text-sm leading-tight font-bold" style="color: #006e94">
            {{ $t("stats.measures.title") }}
          </h2>
          <p class="mt-0.5 line-clamp-1 text-xs text-gray-500">{{ $t("municipalities.cta.dashboard.description") }}</p>
        </div>
        <span
          class="shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold text-white"
          style="background-color: #006e94"
        >
          {{ $t("municipalities.cta.dashboard.action") }}
        </span>
      </NuxtLink>
    </div>

    <!-- Filter panel -->
    <div class="slk-filter-panel slk-filter-theme-lime mb-6 flex flex-col gap-0 p-3 shadow-md">
      <!-- Collapsible toggle (only shown below xs breakpoint) -->
      <button
        class="slk-filter-panel-icon flex w-full items-center justify-between py-1 text-sm font-medium xs:hidden"
        @click="filterOpen = !filterOpen"
      >
        <span class="flex items-center gap-2">
          <svg class="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M3 4a1 1 0 011-1h16a1 1 0 01.707 1.707L14 12.414V19a1 1 0 01-1.447.894l-4-2A1 1 0 018 17v-4.586L3.293 5.707A1 1 0 013 5V4z"
            />
          </svg>
          <span>{{ $t("generic.filter_and_view") }}</span>
          <span
            v-if="activeFilterCount > 0"
            class="slk-filter-count rounded-full px-1.5 py-0.5 text-xs leading-none font-bold"
            >{{ activeFilterCount }}</span
          >
        </span>
        <svg
          class="h-4 w-4 shrink-0 transition-transform duration-200"
          :class="filterOpen ? 'rotate-180' : ''"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <!-- Filter rows (always visible at xs+, collapsible below xs) -->
      <div v-show="filterOpen" class="xs:block!">
        <!-- Row 1: View toggle + vertical divider + Catalog version -->
        <div class="flex flex-wrap items-center gap-x-3 gap-y-2 py-1.5">
          <!-- View toggle group: icon + buttons stay together -->
          <div class="flex items-center gap-2">
            <svg
              class="slk-filter-panel-icon h-4 w-4 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
              />
            </svg>
            <div class="flex gap-2">
              <button
                class="slk-filter-pill"
                :class="{ 'slk-filter-pill--active': !isMapView }"
                @click="router.replace({ query: { ...route.query, view: undefined } })"
              >
                <svg
                  class="h-3.5 w-3.5 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                {{ $t("municipalities.view.ranking") }}
              </button>
              <button
                class="slk-filter-pill"
                :class="{ 'slk-filter-pill--active': isMapView }"
                @click="router.replace({ query: { ...route.query, view: 'map' } })"
              >
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
                    d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                  />
                </svg>
                {{ $t("municipalities.view.map") }}
              </button>
            </div>
          </div>

          <!-- Vertical divider (hidden when row wraps) -->
          <div class="slk-filter-divider w-px self-stretch" />

          <!-- Catalog version group: icon + buttons stay together -->
          <div class="flex items-center gap-2">
            <svg
              class="slk-filter-panel-icon h-4 w-4 shrink-0"
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
            <div class="flex items-center gap-2">
              <NuxtLink
                :to="{ path: '/municipalities', query: { ...route.query, v: 'v1.0' } }"
                class="slk-filter-pill"
                :class="{ 'slk-filter-pill--active': selectedCatalogVersion.name !== 'beta' }"
                >{{ $t("ranking.current_year", { ":year": 2026 }) }}</NuxtLink
              >
              <NuxtLink
                :to="{ path: '/municipalities', query: { ...route.query, v: 'beta' } }"
                class="slk-filter-pill"
                :class="{ 'slk-filter-pill--active': selectedCatalogVersion.name === 'beta' }"
                >{{ $t("ranking.archive_year", { ":year": 2025 }) }}</NuxtLink
              >
            </div>
          </div>
        </div>

        <div class="slk-filter-rule my-0.5 border-t" />

        <!-- Row 2: Municipality type filter -->
        <div class="grid grid-cols-[1.5rem_1fr] items-start gap-x-2 py-1.5">
          <svg
            class="slk-filter-panel-icon mt-1 h-4 w-4 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M3 4a1 1 0 011-1h16a1 1 0 01.707 1.707L14 12.414V19a1 1 0 01-1.447.894l-4-2A1 1 0 018 17v-4.586L3.293 5.707A1 1 0 013 5V4z"
            />
          </svg>
          <div class="flex flex-wrap items-center gap-2">
            <button
              class="slk-filter-pill"
              :class="{ 'slk-filter-pill--active': selected === 'all' }"
              @click="selected = 'all'"
            >
              <div class="flex shrink-0 gap-0">
                <img
                  class="h-4 w-4"
                  :src="selected === 'all' ? minorCitySelected : minorCityNotSelected"
                  :alt="$t('municipalities.all')"
                />
                <img class="h-4 w-4" :src="selected === 'all' ? majorCitySelected : majorCityNotSelected" />
              </div>
              <span class="font-bold whitespace-nowrap">{{ $t("municipalities.all") }}</span>
            </button>
            <button
              class="slk-filter-pill"
              :class="{ 'slk-filter-pill--active': selected === 'major_city' }"
              @click="selected = 'major_city'"
            >
              <img
                class="h-4 w-4 shrink-0"
                :src="selected === 'major_city' ? majorCitySelected : majorCityNotSelected"
                :alt="$t('municipalities.major_city.plural')"
              />
              <span class="font-bold whitespace-nowrap">{{ $t("municipalities.major_city.plural") }}</span>
            </button>
            <button
              class="slk-filter-pill"
              :class="{ 'slk-filter-pill--active': selected === 'minor_city' }"
              @click="selected = 'minor_city'"
            >
              <img
                class="h-4 w-4 shrink-0"
                :src="selected === 'minor_city' ? minorCitySelected : minorCityNotSelected"
                :alt="$t('municipalities.minor_city.plural')"
              />
              <span class="font-bold whitespace-nowrap">{{ $t("municipalities.minor_city.plural") }}</span>
            </button>
            <span v-if="selected === 'major_city'" class="text-xs text-gray-500 italic">{{
              $t("municipalities.major_city.threshold")
            }}</span>
            <span v-else-if="selected === 'minor_city'" class="text-xs text-gray-500 italic">{{
              $t("municipalities.minor_city.threshold")
            }}</span>
          </div>
        </div>
      </div>
      <!-- /collapsible -->
    </div>

    <!-- Mobile: Single column layout -->
    <div class="block lg:hidden">
      <!-- Conditional Content -->
      <div>
        <section>
          <TheMap
            v-if="isMapView"
            :municipality-scores="filteredMunicipalityScores"
            :catalog-version="selectedCatalogVersion"
          />
          <TheRanking
            v-else
            :municipality-scores="filteredMunicipalityScores"
            :catalog-version="selectedCatalogVersion"
          />
        </section>
      </div>
    </div>

    <!-- Desktop: Two column layout -->
    <div class="hidden w-full lg:grid lg:grid-cols-3 lg:gap-8">
      <!-- Left Column: Municipality Ranking (2/3 width) -->
      <div ref="rankingColumn" class="lg:col-span-2">
        <!-- Conditional Content -->
        <div class="w-full max-w-(--breakpoint-xl)">
          <TheMap
            v-if="isMapView"
            :municipality-scores="filteredMunicipalityScores"
            :catalog-version="selectedCatalogVersion"
          />
          <TheRanking
            v-else
            :municipality-scores="filteredMunicipalityScores"
            :catalog-version="selectedCatalogVersion"
          />
        </div>
      </div>

      <!-- Right Column: Success Projects (1/3 width) -->
      <div
        v-if="projects && projects.length > 0"
        class="mb-3 overflow-y-auto lg:col-span-1"
        :style="{ maxHeight: rankingColumnHeight + 'px' }"
      >
        <div class="sticky">
          <!-- <h2 class="text-2xl font-bold max-w-md mb-6 mx-auto text-center">{{ $t("projects.title")}}</h2> -->
          <div class="mx-auto max-w-md space-y-4">
            <OnboardingBox name="Otto" :avatar-src="onboardingAvatarUrl" />

            <!-- Lokalteam gründen box -->
            <div class="flex h-36 flex-col border-2 bg-white p-4 shadow-xl" style="border-color: #afca0b">
              <div class="flex min-h-0 flex-1 items-center gap-3">
                <div
                  class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
                  style="background-color: #afca0b"
                >
                  <svg
                    class="h-6 w-6 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="1.8"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </div>
                <div class="min-w-0">
                  <h2 class="font-heading text-base leading-tight font-bold" style="color: #afca0b">
                    {{ $t("localteam.create_now") }}
                  </h2>
                  <p class="mt-0.5 line-clamp-2 text-xs text-gray-500">
                    {{ $t("municipalities.cta.localteam.description") }}
                  </p>
                </div>
              </div>
              <NuxtLink
                to="/register_localteam"
                class="mt-2 inline-block w-full rounded-md px-3 py-2 text-center text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style="background-color: #afca0b"
              >
                {{ $t("municipalities.cta.missing.action") }}
              </NuxtLink>
            </div>

            <!-- {{ $t("stats.measures.title") }} box -->
            <div class="flex h-36 flex-col border-2 bg-white p-4 shadow-xl" style="border-color: #006e94">
              <div class="flex min-h-0 flex-1 items-center gap-3">
                <div
                  class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
                  style="background-color: #006e94"
                >
                  <svg
                    class="h-6 w-6 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="1.8"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                </div>
                <div class="min-w-0">
                  <h2 class="font-heading text-base leading-tight font-bold" style="color: #006e94">
                    {{ $t("stats.measures.title") }}
                  </h2>
                  <p class="mt-0.5 line-clamp-2 text-xs text-gray-500">
                    {{ $t("municipalities.cta.dashboard.description") }}
                  </p>
                </div>
              </div>
              <NuxtLink
                to="/stats#massnahmenstatistiken"
                class="mt-2 inline-block w-full rounded-md px-3 py-2 text-center text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style="background-color: #006e94"
              >
                {{ $t("municipalities.cta.dashboard.action") }}
              </NuxtLink>
            </div>

            <ProjectCard
              v-for="project in projects"
              :key="project.id"
              :slug="project.slug"
              :title="project.title"
              :municipality_name="project.municipality_name ?? undefined"
              :state="project.state ?? undefined"
              :abstract="project.abstract ?? undefined"
              :author="project.author ?? undefined"
              :date="new Date(project.date_created ?? 0)"
              :image_id="project.image?.id"
              :image_is_raster="isRaster(project.image?.type)"
              :organisation="project.organisation"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- CTA: Start a new municipality assessment -->
    <div class="mt-12 mb-4 flex flex-col items-center gap-6 rounded-xs bg-rating-3-light p-8 shadow-list sm:flex-row">
      <img src="~/assets/icons/icon_location_green_marker.svg" class="h-14 w-auto shrink-0 opacity-80" />
      <div class="flex-1 text-center sm:text-left">
        <h2 class="mb-2 font-heading text-h2 font-bold text-green">
          {{ $t("municipalities.cta.missing.title") }}
        </h2>
        <p class="mb-4 text-sm text-gray-600">
          {{ $t("municipalities.cta.missing.body") }}
        </p>
        <NuxtLink
          to="/register_localteam"
          class="inline-block rounded-md bg-green px-6 py-2.5 font-semibold text-white transition-colors hover:opacity-90 focus:ring-2 focus:ring-green focus:ring-offset-2 focus:outline-hidden"
        >
          {{ $t("municipalities.cta.missing.action") }}
        </NuxtLink>
      </div>
    </div>

    <!-- Mobile cal.com overlay -->
    <teleport to="body">
      <transition name="mun-cal-fade">
        <div
          v-if="showCalMobile"
          class="fixed inset-0 z-10001 flex items-center justify-center bg-black/60 p-4"
          @click.self="closeCalMobile"
        >
          <div
            class="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl"
          >
            <div class="flex shrink-0 justify-end p-2">
              <button
                class="text-2xl leading-none text-gray-500 hover:text-gray-700"
                :aria-label="$t('generic.close')"
                @click="closeCalMobile"
              >
                ✕
              </button>
            </div>
            <div class="min-h-[400px] flex-1 overflow-y-auto"><CalBookingFrame /></div>
          </div>
        </div>
      </transition>
    </teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, nextTick, watch } from "vue";
import lodash from "lodash";
import { isRaster } from "~/shared/utils";

const majorCitySelected = "/icons/major-city-light.svg";
const majorCityNotSelected = "/icons/major-city-dark.svg";
const minorCitySelected = "/icons/minor-city-light.svg";
const minorCityNotSelected = "/icons/minor-city-dark.svg";

const { $t, $locale } = useNuxtApp();
const runtimeConfig = useRuntimeConfig();
const onboardingAvatarUrl = computed(
  () =>
    `${String(runtimeConfig.public.clientDirectusUrl || "").replace(/\/+$/, "")}/assets/56a814bb-fac4-4b80-88d7-a6fc8bd71580?width=96&height=96`,
);
const rankingColumn = ref<HTMLElement | null>(null);
const rankingColumnHeight = ref(0);

function updateRankingColumnHeight() {
  if (rankingColumn.value) {
    const measured = rankingColumn.value.offsetHeight;
    const minHeight = 500;
    const h = Math.max(measured, minHeight);

    if (h !== rankingColumnHeight.value) {
      rankingColumnHeight.value = h;
    }
  }
}

onMounted(() => {
  // Initial measurement after DOM renders
  void nextTick(updateRankingColumnHeight);

  // Re-measure on window resize (only on client)
  if (import.meta.client) {
    window.addEventListener("resize", updateRankingColumnHeight);
  }
});

// Also re-measure whenever the DOM changes (reactively)
watchEffect(() => {
  void nextTick(updateRankingColumnHeight);
});

//MetaTags
const title = ref($t("municipalities.nav_label"));
useHead({
  title,
});

const route = useRoute();
const router = useRouter();
const isMapView = computed(() => route.query.view === "map"); // Default to map view if no query param or 'map'

const selectedCatalogVersion = ref(await getCatalogVersion(route));
onMounted(() => {
  void setCatalogVersionUrl(route, router, selectedCatalogVersion.value);
});

// Share the complete public score projection with the map and statistics pages.
const { data: rankingData } = await useAsyncData(
  () => `municipalities_ranking_scores_${selectedCatalogVersion.value.name}`,
  () => $fetch(`/api/public/stats/${encodeURIComponent(selectedCatalogVersion.value.name)}`),
);
const municipalityScores = computed(() =>
  (rankingData.value?.scores ?? [])
    .filter((score) => Number(score.percentage_rated) > 0)
    .slice()
    .sort((a, b) => Number(b.score_total) - Number(a.score_total)),
);

const { data: projects } = await useAsyncData("articles_ranking", async () => {
  const result = await $fetch("/api/public/articles", { query: { limit: 100, sort: "-date_created" } });
  return result.articles || [];
});

watch(
  () => route.query.v,
  async (newV, oldV) => {
    if (newV === oldV) return;
    selectedCatalogVersion.value = await getCatalogVersion(route);
  },
);

const majorCityScores = computed(() =>
  getSublist((municipalityScore) => municipalityScore.municipality?.municipality_type === "big_city"),
);
const minorCitiesScores = computed(() =>
  getSublist((municipalityScore) => municipalityScore.municipality?.municipality_type === "small_city"),
);
const filteredMunicipalityScores = computed(() => {
  if (selected.value === "major_city") return majorCityScores.value;
  if (selected.value === "minor_city") return minorCitiesScores.value;
  return municipalityScores.value ?? [];
});

function getSublist(condition: (score: NonNullable<typeof municipalityScores.value>[number]) => boolean) {
  return (municipalityScores.value?.filter(condition) || []).map((item, index) => ({
    ...item,
    rank: index + 1,
  }));
}

const lastUpdatedAtStr = ref("");
onMounted(() => {
  const scores = municipalityScores.value;
  if (!Array.isArray(scores) || scores.length === 0) return;

  // sort by nested municipality.date_updated
  const sorted = lodash.sortBy(scores, (s) => lodash.get(s, "municipality.date_updated"));

  const latest = lodash.get(lodash.last(sorted), "municipality.date_updated");
  if (!latest) return;

  const lastUpdatedAt = new Date(latest);

  lastUpdatedAtStr.value =
    lastUpdatedAt.toLocaleDateString($locale, {
      year: "numeric",
      month: "2-digit",
      day: "numeric",
    }) +
    ", " +
    lastUpdatedAt.toLocaleTimeString($locale);
});

// Toggle between cities, towns, or all — persisted in the URL so catalog changes retain it
const selected = computed({
  get() {
    const v = route.query.filter;
    return v === "major_city" || v === "minor_city" ? v : "all";
  },
  set(val) {
    void router.replace({ query: { ...route.query, filter: val === "all" ? undefined : val } });
  },
});

const filterOpen = ref(false);

// Mobile cal.com overlay
const showCalMobile = ref(false);
function openCalMobile() {
  showCalMobile.value = true;
}
function closeCalMobile() {
  showCalMobile.value = false;
}
watch(showCalMobile, (open) => {
  if (import.meta.client) document.body.style.overflow = open ? "hidden" : "";
});
const activeFilterCount = computed(() => {
  let count = 0;
  if (isMapView.value) count++;
  if (selected.value !== "all") count++;
  if (route.query.v === "beta") count++;
  return count;
});
</script>

<style scoped>
.mun-cal-fade-enter-active,
.mun-cal-fade-leave-active {
  transition: opacity 0.2s;
}
.mun-cal-fade-enter-from,
.mun-cal-fade-leave-to {
  opacity: 0;
}
</style>

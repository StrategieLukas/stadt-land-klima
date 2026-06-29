<template>
  <main class="mx-auto w-full max-w-7xl px-4 py-6">
    <!-- ═══════════════════════════════════════════════════════════
         TOP NAV TILES — anchor navigation
         ═══════════════════════════════════════════════════════════ -->
    <nav class="-mx-4 -mt-6 mb-6 flex md:hidden" aria-label="Sektionen">
      <button
        class="flex flex-1 flex-col items-center justify-center gap-0.5 px-4 py-4 text-center text-white transition-opacity hover:opacity-90 active:opacity-80"
        style="background-color: #006e94"
        @click="scrollToSection('kommunale-statistiken')"
      >
        <svg class="mb-0.5 h-5 w-5 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V10.5z"
          />
        </svg>
        <span class="font-heading text-base font-bold leading-tight">{{ $t("stats.municipal.title") }}</span>
        <span class="hidden text-xs text-white/70 xs:block">{{ $t("stats.municipal.nav_subtitle") }}</span>
      </button>
      <div class="w-px flex-shrink-0" style="background-color: rgba(255, 255, 255, 0.15)"></div>
      <button
        class="flex flex-1 flex-col items-center justify-center gap-0.5 px-4 py-4 text-center text-white transition-opacity hover:opacity-90 active:opacity-80"
        style="background-color: #1a4a6e"
        @click="scrollToSection('massnahmenstatistiken')"
      >
        <svg class="mb-0.5 h-5 w-5 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
        <span class="font-heading text-base font-bold leading-tight">{{ $t("stats.measures.title") }}</span>
        <span class="hidden text-xs text-white/70 xs:block">{{ $t("stats.measures.nav_subtitle") }}</span>
      </button>
    </nav>

    <!-- ═══════════════════════════════════════════════════════════
         ZONE A: Kommunensuche — find a specific city's stats
         ═══════════════════════════════════════════════════════════ -->
    <section id="kommunale-statistiken" class="mb-7 md:overflow-hidden md:rounded-sm md:shadow-list">
      <!-- Hero: mobile = stacked header + search, desktop = side-by-side in dark band -->
      <div class="flex flex-col md:flex-row md:items-stretch">
        <!-- Dark left: icon + title -->
        <div
          class="-mx-4 mb-0 flex items-center gap-3 px-4 py-4 md:mx-0 md:w-[35%] md:flex-shrink-0"
          style="background-color: #006e94"
        >
          <svg
            class="h-5 w-5 flex-shrink-0 text-white/80"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="1.5"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
            />
          </svg>
          <div>
            <h2 class="font-heading text-lg font-bold leading-tight text-white">{{ $t("stats.municipal.title") }}</h2>
            <p class="mt-0.5 text-xs text-white/70">{{ $t("stats.municipal.description") }}</p>
          </div>
        </div>
        <!-- Right: search bar (padded below on mobile, inline on desktop) -->
        <div class="px-1 pb-3 pt-4 md:flex md:flex-1 md:items-center md:px-5 md:py-3">
          <AdministrativeAreaSearchBar base-path="/stats" class="w-full" />
        </div>
      </div>
    </section>

    <!-- ═══════════════════════════════════════════════════════════
         ZONE B: Gesamtstatistik — aggregate data across all cities
         ═══════════════════════════════════════════════════════════ -->
    <section id="massnahmenstatistiken" class="md:mb-8 md:overflow-hidden md:rounded-sm md:shadow-list">
      <!-- Hero row: mobile = stacked, desktop = side-by-side title + filter -->
      <div class="border-gray-200 flex flex-col border-b md:flex-row md:items-stretch">
        <!-- Left: dark title column -->
        <div
          class="-mx-4 mb-0 flex items-center gap-3 px-4 py-4 md:mx-0 md:w-[35%] md:flex-shrink-0"
          style="background-color: #1a4a6e"
        >
          <svg
            class="h-5 w-5 flex-shrink-0 text-white/80"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="1.5"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          <div>
            <h2 class="font-heading text-lg font-bold leading-tight text-white">{{ $t("stats.measures.title") }}</h2>
            <p class="mt-0.5 text-xs text-white/70">{{ $t("stats.measures.description") }}</p>
          </div>
        </div>
        <!-- Right: filter panel -->
        <div class="slk-filter-panel slk-filter-theme-stats flex flex-col gap-0 px-3 py-3 md:flex-1 md:justify-center">
          <!-- Collapsible toggle (only shown below xs breakpoint) -->
          <button
            class="slk-filter-panel-icon flex w-full items-center justify-between py-1 text-sm font-medium xs:hidden"
            @click="filterOpen = !filterOpen"
          >
            <span class="flex items-center gap-2">
              <svg class="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M3 4a1 1 0 011-1h16a1 1 0 01.707 1.707L14 12.414V19a1 1 0 01-1.447.894l-4-2A1 1 0 018 17v-4.586L3.293 5.707A1 1 0 013 5V4z"
                />
              </svg>
              <span>{{ $t("generic.filter") }}</span>
              <span
                v-if="activeFilterCount > 0"
                class="slk-filter-count rounded-full px-1.5 py-0.5 text-xs font-bold leading-none"
                >{{ activeFilterCount }}</span
              >
            </span>
            <svg
              class="h-4 w-4 flex-shrink-0 transition-transform duration-200"
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
          <div v-show="filterOpen" class="xs:!block">
            <!-- Row 0: catalog + type -->
            <div class="grid grid-cols-[1.5rem_1fr] items-center gap-x-3 py-1.5">
              <svg
                class="slk-filter-panel-icon h-4 w-4 flex-shrink-0"
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
              <div class="flex flex-wrap items-center gap-2">
                <button
                  v-for="v in catalogVersions"
                  :key="v.id"
                  class="slk-filter-pill"
                  :class="selectedCatalogVersionId === v.id ? 'slk-filter-pill--active' : ''"
                  @click="onCatalogVersionChange(v.id)"
                >
                  {{ v.name }}
                </button>
                <div class="slk-filter-divider mx-1 hidden w-px self-stretch sm:block" />
                <button
                  v-for="opt in typeOptions"
                  :key="opt.value ?? 'alltype'"
                  class="slk-filter-pill"
                  :class="filterType === opt.value ? 'slk-filter-pill--active' : ''"
                  @click="filterType = opt.value"
                >
                  {{ opt.label }}
                </button>
              </div>
            </div>

            <div class="slk-filter-rule my-0.5 border-t" />

            <!-- Row 1: state dropdown -->
            <div class="grid grid-cols-[1.5rem_1fr] items-start gap-x-3 py-1.5">
              <svg
                class="slk-filter-panel-icon mt-1 h-4 w-4 flex-shrink-0"
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
                <FilterBadgeDropdown
                  label="Alle Bundesländer"
                  :options="availableStates.map((s) => ({ label: s, value: s }))"
                  v-model="filterState"
                  width="min-w-[13rem]"
                  :dark="false"
                />
              </div>
            </div>
          </div>
          <!-- /collapsible -->
        </div>
        <!-- /filter panel right -->
      </div>
      <!-- /hero row -->

      <!-- desktop content padding wrapper -->
      <div class="md:px-4 md:pb-6 md:pt-4">
        <!-- KPI grid — filter-dependent, shown below the filters -->
        <div class="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <template v-if="statsLoading">
            <div
              v-for="i in 5"
              :key="i"
              class="flex flex-col items-center rounded-sm bg-white p-3 text-center shadow-list"
              :class="i === 5 ? 'col-span-2 sm:col-span-1' : ''"
            >
              <div class="bg-gray-200 mb-1 h-8 w-10 animate-pulse rounded"></div>
              <div class="bg-gray-100 mt-1 h-3 w-16 animate-pulse rounded"></div>
            </div>
          </template>
          <template v-else>
            <div class="flex flex-col items-center rounded-sm bg-white p-3 text-center shadow-list">
              <span class="text-2xl font-bold leading-none text-[#1a4a6e]">{{ kpi.totalCompleted }}</span>
              <span class="text-gray-500 mt-1 text-xs leading-tight">{{ $t("stats.kpi.fully_rated") }}</span>
            </div>
            <div class="flex flex-col items-center rounded-sm bg-white p-3 text-center shadow-list">
              <span class="text-2xl font-bold leading-none text-[#1a4a6e]">{{ kpi.totalHalfRatedProgress }}</span>
              <span class="text-gray-500 mt-1 text-xs leading-tight">{{ $t("stats.kpi.in_progress") }}</span>
            </div>
            <div class="flex flex-col items-center rounded-sm bg-white p-3 text-center shadow-list">
              <span class="text-2xl font-bold leading-none text-[#1a4a6e]">{{ kpi.totalMunicipalities }}</span>
              <span class="text-gray-500 mt-1 text-xs leading-tight">{{ $t("stats.kpi.total_municipalities") }}</span>
            </div>
            <div class="flex flex-col items-center rounded-sm bg-white p-3 text-center shadow-list">
              <span class="text-2xl font-bold leading-none text-[#1a4a6e]">{{ kpi.totalMeasures }}</span>
              <span class="text-gray-500 mt-1 text-xs leading-tight">{{ $t("stats.kpi.measures_in_catalog") }}</span>
            </div>
            <div
              class="col-span-2 flex flex-col items-center rounded-sm bg-white p-3 text-center shadow-list sm:col-span-1"
            >
              <span class="text-2xl font-bold leading-none text-[#1a4a6e]">{{
                kpi.totalFilledRatings.toLocaleString("de-DE")
              }}</span>
              <span class="text-gray-500 mt-1 text-xs leading-tight">{{ $t("stats.kpi.completed_ratings") }}</span>
            </div>
          </template>
        </div>

        <!-- Tabs -->
        <div class="border-gray-200 mb-4 flex gap-1 overflow-x-auto border-b">
          <button
            class="flex-shrink-0 whitespace-nowrap border-b-2 px-4 py-2 text-sm font-semibold transition-colors"
            :class="
              activeTab === 'measures'
                ? 'border-gray-700 text-gray-800'
                : 'text-gray-500 hover:text-gray-700 border-transparent'
            "
            @click="activeTab = 'measures'"
          >
            {{ $t("stats.measures.singular_title") }}
          </button>
          <button
            class="flex-shrink-0 whitespace-nowrap border-b-2 px-4 py-2 text-sm font-semibold transition-colors"
            :class="
              activeTab === 'clustering'
                ? 'border-gray-700 text-gray-800'
                : 'text-gray-500 hover:text-gray-700 border-transparent'
            "
            @click="switchToClusteringTab"
          >
            {{ $t("stats.clustering.title") }}
          </button>
          <button
            class="flex-shrink-0 whitespace-nowrap border-b-2 px-4 py-2 text-sm font-semibold transition-colors"
            :class="
              activeTab === 'dominance'
                ? 'border-gray-700 text-gray-800'
                : 'text-gray-500 hover:text-gray-700 border-transparent'
            "
            @click="switchToDominanceTab"
          >
            {{ $t("stats.dominance.tab") }}
          </button>
        </div>

        <!-- TAB: Maßnahmenstatistik -->
        <div v-show="activeTab === 'measures'">
          <!-- Mobile sub-tabs (only shown on small screens) -->
          <div v-if="isSmall" class="border-gray-200 -mx-0 mb-4 flex border-b">
            <button
              class="flex flex-1 flex-col items-center gap-0.5 border-b-2 px-1 py-2 text-xs font-semibold transition-colors"
              :class="
                mobileMeasuresTab === 'selection'
                  ? 'border-[#1a4a6e] text-[#1a4a6e]'
                  : 'text-gray-500 hover:text-gray-700 border-transparent'
              "
              @click="mobileMeasuresTab = 'selection'"
            >
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 3 L12 21 M3 12 L21 12" stroke-width="1.2" />
              </svg>
              Auswahl
            </button>
            <button
              class="flex flex-1 flex-col items-center gap-0.5 border-b-2 px-1 py-2 text-xs font-semibold transition-colors"
              :class="
                mobileMeasuresTab === 'plot'
                  ? 'border-[#1a4a6e] text-[#1a4a6e]'
                  : 'text-gray-500 hover:text-gray-700 border-transparent'
              "
              @click="mobileMeasuresTab = 'plot'"
            >
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              Balkendiagramm
            </button>
            <button
              class="flex flex-1 flex-col items-center gap-0.5 border-b-2 px-1 py-2 text-xs font-semibold transition-colors"
              :class="
                mobileMeasuresTab === 'list'
                  ? 'border-[#1a4a6e] text-[#1a4a6e]'
                  : 'text-gray-500 hover:text-gray-700 border-transparent'
              "
              @click="mobileMeasuresTab = 'list'"
            >
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              Kommunen
            </button>
          </div>

          <!-- Main interactive panel: sunburst (left) + distribution chart (right) -->
          <div class="mb-6 grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
            <!-- Skeleton: sunburst card -->
            <div v-if="statsLoading" class="flex flex-col rounded-sm bg-white p-5 shadow-list">
              <div class="bg-gray-100 border-gray-200 -mx-5 -mt-5 mb-4 rounded-t-sm border-b px-5 py-3">
                <div class="bg-gray-200 mb-1 h-4 w-40 animate-pulse rounded"></div>
                <div class="bg-gray-100 mt-1 h-3 w-56 animate-pulse rounded"></div>
              </div>
              <div class="flex flex-1 items-center justify-center" style="min-height: 300px">
                <div class="bg-gray-200 animate-pulse rounded-full" style="width: 220px; height: 220px"></div>
              </div>
            </div>

            <!-- Skeleton: distribution card -->
            <div v-if="statsLoading" class="flex flex-col rounded-sm bg-white p-5 shadow-list">
              <div class="bg-gray-100 border-gray-200 -mx-5 -mt-5 mb-4 rounded-t-sm border-b px-5 py-3">
                <div class="bg-gray-200 mb-1 h-4 w-48 animate-pulse rounded"></div>
                <div class="bg-gray-100 mt-1 h-3 w-60 animate-pulse rounded"></div>
              </div>
              <div class="flex flex-1 flex-col justify-end gap-2 px-2" style="min-height: 300px">
                <div v-for="i in 7" :key="i" class="flex items-end gap-2">
                  <div class="bg-gray-100 h-3 w-8 flex-shrink-0 animate-pulse rounded"></div>
                  <div
                    class="bg-gray-200 animate-pulse rounded"
                    :style="{ height: '12px', width: `${30 + i * 8}%` }"
                  ></div>
                </div>
              </div>
            </div>

            <!-- Sunburst / List view card -->
            <div
              v-show="!statsLoading && (!isSmall || mobileMeasuresTab === 'selection')"
              class="flex flex-col rounded-sm bg-white p-5 shadow-list"
            >
              <!-- Card header with toggle -->
              <div
                class="bg-gray-100 border-gray-200 -mx-5 -mt-5 mb-4 flex items-center justify-between rounded-t-sm border-b px-5 py-3"
              >
                <div>
                  <h2 class="text-base font-bold">Sektoren &amp; Maßnahmen{{ filterSuffix }}</h2>
                  <p class="text-gray-500 mt-0.5 text-xs">
                    <span v-if="!showListView || isSmall">Klick auf Sektor oder Maßnahme für Details →</span>
                    <span v-else>Sektor oder Maßnahme auswählen für Details →</span>
                  </p>
                </div>
                <!-- Toggle only on non-small screens -->
                <div v-if="!isSmall" role="tablist" class="tabs-boxed tabs ml-3 w-fit flex-shrink-0">
                  <a
                    role="tab"
                    class="tab gap-1.5"
                    :class="{ 'tab-active': !showListView }"
                    @click="showListView = false"
                  >
                    <svg class="h-4 w-4 flex-shrink-0" viewBox="0 0 32 32" fill="currentColor">
                      <path
                        d="M16 2a1 1 0 0 0-1 1v7.09a6 6 0 0 0-2.46 1.043L7.838 6.431a1.455 1.455 0 0 0-2.087.024a14.05 14.05 0 0 0 4.054 22.142a11 11 0 0 0 1.899.768a14.1 14.1 0 0 0 13.844-3.132a1.434 1.434 0 0 0 .028-2.064l-4.699-4.699A6 6 0 0 0 21.91 17H29a1 1 0 0 0 1-1A14.016 14.016 0 0 0 16 2m0 10a4 4 0 1 1-4 4a4.005 4.005 0 0 1 4-4M6.83 8.251l4.296 4.296a5.91 5.91 0 0 0-.011 6.924l-4.277 4.277A12.02 12.02 0 0 1 6.83 8.251m1.423 16.91l4.276-4.276A5.96 5.96 0 0 0 15 21.91v6.042a11.88 11.88 0 0 1-6.747-2.79ZM17 27.956V21.91a6 6 0 0 0 2.46-1.027l4.283 4.282A11.9 11.9 0 0 1 17 27.956M21.91 15A6.01 6.01 0 0 0 17 10.09V4.041A12.02 12.02 0 0 1 27.959 15Z"
                      />
                    </svg>
                    Sunburst
                  </a>
                  <a
                    role="tab"
                    class="tab gap-1.5"
                    :class="{ 'tab-active': showListView }"
                    @click="showListView = true"
                  >
                    <svg
                      class="h-4 w-4 flex-shrink-0"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <line x1="8" y1="6" x2="21" y2="6" />
                      <line x1="8" y1="12" x2="21" y2="12" />
                      <line x1="8" y1="18" x2="21" y2="18" />
                      <circle cx="3.5" cy="6" r="1.5" fill="currentColor" stroke="none" />
                      <circle cx="3.5" cy="12" r="1.5" fill="currentColor" stroke="none" />
                      <circle cx="3.5" cy="18" r="1.5" fill="currentColor" stroke="none" />
                    </svg>
                    Liste
                  </a>
                </div>
              </div>

              <!-- Sunburst (non-small + diagram mode, ref kept alive always) -->
              <div v-show="!isSmall && !showListView" style="height: 420px" class="relative">
                <div class="h-full w-full">
                  <div ref="sunburstContainer" class="h-full w-full"></div>
                </div>
              </div>

              <!-- Desktop/midi list view -->
              <div
                v-show="!isSmall && showListView"
                style="height: 420px"
                class="border-gray-100 flex flex-col overflow-hidden rounded-lg border"
              >
                <button
                  class="border-gray-100 flex w-full flex-shrink-0 items-center gap-2 border-b px-3 py-2 text-left text-sm font-medium transition-colors"
                  :class="!sunburstSelection.type ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'"
                  @click="clearSunburstSelection"
                >
                  <span class="h-5 w-5 flex-shrink-0 opacity-40">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 3 L12 21 M3 12 L21 12" stroke-width="1.2" />
                    </svg>
                  </span>
                  <span class="flex-1 font-semibold">Gesamtbewertung</span>
                  <span
                    v-if="overallMeanScore != null"
                    class="slk-rating-chip flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-bold text-white"
                    :style="{ background: ratingToColor(overallMeanScore), color: ratingTextColor(overallMeanScore) }"
                    >{{ (overallMeanScore * 100).toFixed(0) }}%</span
                  >
                </button>
                <div class="flex-1 overflow-y-auto">
                  <div v-for="sector in allSectorsOrdered" :key="sector.sectorKey">
                    <button
                      class="border-gray-100 flex w-full items-center gap-2 border-b px-3 py-2 text-left text-sm font-semibold transition-colors"
                      :class="
                        sunburstSelection.sectorKey === sector.sectorKey && sunburstSelection.type === 'sector'
                          ? 'bg-blue-50 text-blue-700'
                          : 'hover:bg-gray-50'
                      "
                      @click="onChooserSectorClick(sector)"
                    >
                      <img
                        :src="sectorImages[sector.sectorKey]"
                        class="slk-filter-sector-icon h-5 w-5 flex-shrink-0 opacity-70 mix-blend-multiply grayscale invert"
                      />
                      <span class="flex-1 text-left">{{ shortSectorNames[sector.sectorKey] }}</span>
                      <span
                        v-if="sectorMeanScores.get(sector.sectorKey) != null"
                        class="slk-rating-chip flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-bold text-white"
                        :style="{
                          background: ratingToColor(sectorMeanScores.get(sector.sectorKey)),
                          color: ratingTextColor(sectorMeanScores.get(sector.sectorKey)),
                        }"
                        >{{ (sectorMeanScores.get(sector.sectorKey) * 100).toFixed(0) }}%</span
                      >
                      <svg
                        class="text-gray-400 h-4 w-4 flex-shrink-0 transition-transform duration-150"
                        :class="expandedSectorKey === sector.sectorKey ? 'rotate-180' : ''"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    <div v-show="expandedSectorKey === sector.sectorKey">
                      <button
                        v-for="measure in Object.values(sector.measures)"
                        :key="measure.id"
                        class="border-gray-50 flex w-full items-center gap-2 border-b py-1.5 pl-8 pr-3 text-left text-xs transition-colors"
                        :class="
                          sunburstSelection.measureId === measure.id
                            ? 'bg-blue-50 font-semibold text-blue-700'
                            : 'text-gray-700 hover:bg-gray-50'
                        "
                        @click="onChooserMeasureClick(measure, sector.sectorKey)"
                      >
                        <span class="flex-1 text-left">{{ measure.name }}</span>
                        <span
                          v-if="meanMeasureRatings.get(measure.id) != null"
                          class="slk-rating-chip ml-1 flex-shrink-0 rounded-full px-1.5 py-0.5 text-xs font-bold text-white"
                          :style="{
                            background: ratingToColor(meanMeasureRatings.get(measure.id)),
                            color: ratingTextColor(meanMeasureRatings.get(measure.id)),
                          }"
                          >{{ (meanMeasureRatings.get(measure.id) * 100).toFixed(0) }}%</span
                        >
                        <span v-else class="text-gray-300 ml-1 flex-shrink-0 text-xs">–</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Small-screen hierarchical chooser -->
              <div
                v-show="isSmall"
                style="height: 420px"
                class="border-gray-100 flex flex-col overflow-hidden rounded-lg border"
              >
                <button
                  class="border-gray-100 flex w-full flex-shrink-0 items-center gap-2 border-b px-3 py-2 text-left text-sm font-medium transition-colors"
                  :class="!sunburstSelection.type ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'"
                  @click="clearSunburstSelection"
                >
                  <span class="h-5 w-5 flex-shrink-0 opacity-40">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 3 L12 21 M3 12 L21 12" stroke-width="1.2" />
                    </svg>
                  </span>
                  <span class="flex-1 font-semibold">Gesamtbewertung</span>
                  <span
                    v-if="overallMeanScore != null"
                    class="slk-rating-chip flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-bold text-white"
                    :style="{ background: ratingToColor(overallMeanScore), color: ratingTextColor(overallMeanScore) }"
                    >{{ (overallMeanScore * 100).toFixed(0) }}%</span
                  >
                </button>
                <div class="flex-1 overflow-y-auto">
                  <div v-for="sector in allSectorsOrdered" :key="sector.sectorKey">
                    <button
                      class="border-gray-100 flex w-full items-center gap-2 border-b px-3 py-2 text-left text-sm font-semibold transition-colors"
                      :class="
                        sunburstSelection.sectorKey === sector.sectorKey && sunburstSelection.type === 'sector'
                          ? 'bg-blue-50 text-blue-700'
                          : 'hover:bg-gray-50'
                      "
                      @click="onChooserSectorClick(sector)"
                    >
                      <img
                        :src="sectorImages[sector.sectorKey]"
                        class="slk-filter-sector-icon h-5 w-5 flex-shrink-0 opacity-70 mix-blend-multiply grayscale invert"
                      />
                      <span class="flex-1 text-left">{{ shortSectorNames[sector.sectorKey] }}</span>
                      <span
                        v-if="sectorMeanScores.get(sector.sectorKey) != null"
                        class="slk-rating-chip flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-bold text-white"
                        :style="{
                          background: ratingToColor(sectorMeanScores.get(sector.sectorKey)),
                          color: ratingTextColor(sectorMeanScores.get(sector.sectorKey)),
                        }"
                        >{{ (sectorMeanScores.get(sector.sectorKey) * 100).toFixed(0) }}%</span
                      >
                      <svg
                        class="text-gray-400 h-4 w-4 flex-shrink-0 transition-transform duration-150"
                        :class="expandedSectorKey === sector.sectorKey ? 'rotate-180' : ''"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    <div v-show="expandedSectorKey === sector.sectorKey">
                      <button
                        v-for="measure in Object.values(sector.measures)"
                        :key="measure.id"
                        class="border-gray-50 flex w-full items-center gap-2 border-b py-1.5 pl-8 pr-3 text-left text-xs transition-colors"
                        :class="
                          sunburstSelection.measureId === measure.id
                            ? 'bg-blue-50 font-semibold text-blue-700'
                            : 'text-gray-700 hover:bg-gray-50'
                        "
                        @click="onChooserMeasureClick(measure, sector.sectorKey)"
                      >
                        <span class="flex-1 text-left">{{ measure.name }}</span>
                        <span
                          v-if="meanMeasureRatings.get(measure.id) != null"
                          class="slk-rating-chip ml-1 flex-shrink-0 rounded-full px-1.5 py-0.5 text-xs font-bold text-white"
                          :style="{
                            background: ratingToColor(meanMeasureRatings.get(measure.id)),
                            color: ratingTextColor(meanMeasureRatings.get(measure.id)),
                          }"
                          >{{ (meanMeasureRatings.get(measure.id) * 100).toFixed(0) }}%</span
                        >
                        <span v-else class="text-gray-300 ml-1 flex-shrink-0 text-xs">–</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <!-- Clear selection button -->
              <div class="mt-3 flex items-center justify-center gap-2">
                <template v-if="sunburstSelection.label">
                  <button
                    class="text-gray-400 hover:text-gray-600 px-1 text-xs"
                    title="Zurück (←)"
                    @click="navigateSunburstSelection(-1)"
                  >
                    ◀
                  </button>
                  <button
                    class="inline-flex items-center gap-1.5 rounded-full border-2 border-blue-600 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100"
                    @click="clearSunburstSelection"
                  >
                    <span
                      >{{ sunburstSelection.type === "sector" ? "Sektor" : "Maßnahme" }}:
                      {{ sunburstSelection.label }}</span
                    >
                    <span class="text-sm font-bold leading-none">×</span>
                  </button>
                  <button
                    class="text-gray-400 hover:text-gray-600 px-1 text-xs"
                    title="Vorwärts (→)"
                    @click="navigateSunburstSelection(1)"
                  >
                    ▶
                  </button>
                  <NuxtLink
                    v-if="sunburstSelectionLink"
                    :to="sunburstSelectionLink"
                    class="ml-1 inline-flex items-center gap-1 rounded-full border border-[#1a4a6e] bg-white px-2.5 py-1 text-xs font-semibold text-[#1a4a6e] transition-colors hover:bg-[#1a4a6e] hover:text-white"
                    title="Zur Maßnahmen-Seite"
                  >
                    <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                    Zur Seite
                  </NuxtLink>
                </template>
                <span v-else class="text-gray-400 text-xs">{{ $t("stats.sunburst.click_ring_hint") }}</span>
              </div>
            </div>

            <!-- Distribution chart card -->
            <div
              v-show="!statsLoading && (!isSmall || mobileMeasuresTab === 'plot')"
              class="flex flex-col rounded-sm bg-white p-5 shadow-list"
            >
              <div class="bg-gray-100 border-gray-200 -mx-5 -mt-5 mb-4 rounded-t-sm border-b px-5 py-3">
                <h2 class="text-base font-bold">
                  <span v-if="!sunburstSelection.type">{{
                    $t("stats.histogram.all_municipalities", { ":filter": filterSuffix })
                  }}</span>
                  <span v-else-if="sunburstSelection.type === 'sector'">{{
                    $t("stats.histogram.sector", { ":sector": sunburstSelection.label, ":filter": filterSuffix })
                  }}</span>
                  <span v-else>{{
                    $t("stats.histogram.rating_distribution", { ":label": sunburstSelection.label })
                  }}</span>
                </h2>
                <p class="text-gray-500 mt-0.5 text-xs">
                  <span v-if="!sunburstSelection.type">{{ $t("stats.histogram.total_score_description") }}</span>
                  <span v-else-if="sunburstSelection.type === 'sector'">{{
                    $t("stats.histogram.sector_score_description", {
                      ":sector": shortSectorNames[sunburstSelection.sectorKey] ?? sunburstSelection.sectorKey,
                    })
                  }}</span>
                  <span v-else>{{ $t("stats.histogram.rating_distribution_description") }}</span>
                </p>
              </div>
              <div ref="distPanelContainer" class="w-full flex-1" style="min-height: 360px"></div>
              <!-- Selection marker, matching sunburst badge style -->
              <div class="mt-3 flex items-center justify-center gap-2">
                <template v-if="panelMunFilter.active">
                  <button
                    class="inline-flex items-center gap-1.5 rounded-full border-2 border-blue-600 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100"
                    @click="clearPanelMunFilter"
                  >
                    <span>{{ panelMunFilter.label }}</span>
                    <span class="text-sm font-bold leading-none">×</span>
                  </button>
                </template>
                <span v-else-if="sunburstSelection.type" class="text-gray-400 text-xs">{{
                  $t("stats.histogram.click_bar_hint")
                }}</span>
              </div>
            </div>
          </div>
          <!-- /top row -->

          <!-- Skeleton: municipality list card -->
          <div v-if="statsLoading" class="mb-8 rounded-sm bg-white p-5 shadow-list">
            <div class="bg-gray-100 border-gray-200 -mx-5 -mt-5 mb-4 rounded-t-sm border-b px-5 py-3">
              <div class="bg-gray-200 h-4 w-32 animate-pulse rounded"></div>
            </div>
            <div class="grid grid-cols-1 gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
              <div v-for="i in 10" :key="i" class="border-gray-100 flex items-center gap-3 border-b py-1.5">
                <div class="bg-gray-100 h-3 w-5 flex-shrink-0 animate-pulse rounded"></div>
                <div class="bg-gray-200 h-3 flex-1 animate-pulse rounded"></div>
                <div class="bg-gray-200 h-5 w-10 flex-shrink-0 animate-pulse rounded-full"></div>
              </div>
            </div>
          </div>

          <!-- Municipality list card -->
          <div
            v-show="!statsLoading && (!isSmall || mobileMeasuresTab === 'list')"
            class="mb-8 rounded-sm bg-white p-5 shadow-list"
          >
            <div
              class="bg-gray-100 border-gray-200 -mx-5 -mt-5 mb-4 flex items-center justify-between rounded-t-sm border-b px-5 py-3"
            >
              <h3 class="text-gray-800 text-base font-semibold">
                <span v-if="!panelMunFilter.active">
                  {{ $t("stats.top_10") }}<span v-if="sunburstSelection.label">: {{ sunburstSelection.label }}</span
                  ><span v-else> {{ $t("stats.municipalities") }}{{ filterSuffix }}</span>
                </span>
                <span v-else>{{ $t("stats.municipalities_with", { ":label": panelMunFilter.label }) }}</span>
              </h3>
              <button
                v-if="panelMunFilter.active"
                class="ml-2 flex-shrink-0 text-xs text-blue-600 hover:underline"
                @click="clearPanelMunFilter"
              >
                × {{ $t("stats.filter.clear") }}
              </button>
            </div>
            <div class="grid grid-cols-1 gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
              <div
                v-for="(ms, i) in panelMunicipalities"
                :key="ms.id ?? ms.slug ?? i"
                class="border-gray-100 flex items-center gap-3 border-b py-1.5 last:border-0"
              >
                <span
                  v-if="!panelMunFilter.active"
                  class="text-gray-400 w-5 flex-shrink-0 text-right text-xs font-bold"
                  >{{ i + 1 }}</span
                >
                <NuxtLink
                  :to="ms.slug ? `/municipalities/${ms.slug}` : '#'"
                  class="flex-1 truncate text-sm text-blue-600 hover:text-blue-800 hover:underline"
                  >{{ ms.name }}</NuxtLink
                >
                <span
                  v-if="ms.score_total != null"
                  class="slk-rating-chip flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-bold text-white"
                  :style="{
                    background: ratingToColor(parseFloat(ms.score_total) / 100),
                    color: ratingTextColor(parseFloat(ms.score_total) / 100),
                  }"
                  >{{ parseFloat(ms.score_total).toFixed(1) }}</span
                >
              </div>
              <p v-if="!panelMunicipalities.length" class="text-gray-400 col-span-full py-2 text-xs">
                {{ $t("generic.no_data") }}
              </p>
            </div>
          </div>
        </div>
        <!-- end tab: measures -->

        <!-- TAB: Kommunen-Clustering -->
        <div v-show="activeTab === 'clustering'">
          <div class="mb-8 grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_320px]">
            <!-- Scatter plot -->
            <div class="rounded-xl bg-white p-6 shadow-lg">
              <div class="mb-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 class="text-xl font-bold">{{ $t("stats.clustering.title") }}</h2>
                  <p class="text-gray-500 mt-1 text-sm">{{ $t("stats.clustering.click_hint") }} →</p>
                </div>
                <div class="flex flex-shrink-0 items-center gap-3">
                  <label class="whitespace-nowrap text-sm font-semibold">k =</label>
                  <input v-model.number="kClusters" type="range" min="2" max="10" class="range range-sm w-28" />
                  <span class="w-4 text-sm font-bold">{{ kClusters }}</span>
                  <button class="btn btn-outline btn-sm ml-2" @click="computeClusteringAndRender">
                    {{ $t("stats.analysis.start") }}
                  </button>
                </div>
              </div>
              <!-- Methodology note -->
              <div class="text-gray-400 mb-3 text-xs leading-relaxed">
                <span v-html="$t('stats.clustering.methodology')"></span>
              </div>
              <div ref="clusterContainer" class="w-full" style="min-height: 100px"></div>
              <p v-if="clusteringError" class="mt-2 text-sm text-error">{{ clusteringError }}</p>
            </div>

            <!-- Cluster profile panel -->
            <div class="rounded-sm bg-white p-5 shadow-list">
              <h3 class="mb-3 text-base font-bold">
                <span v-if="!clusterProfile.clusterLabel">{{ $t("stats.clustering.profile") }}</span>
                <span v-else>{{ clusterProfile.clusterLabel }}</span>
              </h3>
              <p v-if="!clusterProfile.clusterLabel" class="text-gray-400 text-sm">
                {{ $t("stats.clustering.empty_profile") }}
              </p>
              <template v-else>
                <p class="text-gray-500 mb-3 text-xs">
                  {{
                    $t("stats.clustering.profile_summary", {
                      ":count": clusterProfile.count,
                      ":score": clusterProfile.avgTotal,
                    })
                  }}
                </p>
                <div class="mb-4 flex flex-col gap-2">
                  <div v-for="sector in sectorOrder" :key="sector" class="flex items-center gap-2">
                    <span
                      class="w-24 flex-shrink-0 truncate text-right text-xs"
                      :style="{ color: sectorColors[sector] }"
                      >{{ shortSectorNames[sector] }}</span
                    >
                    <div class="bg-gray-100 h-3 flex-1 overflow-hidden rounded-full">
                      <div
                        class="h-3 rounded-full transition-all"
                        :style="{
                          width: `${Math.min(100, clusterProfile.sectorMeans[sector] ?? 0)}%`,
                          background: sectorColors[sector],
                        }"
                      ></div>
                    </div>
                    <span class="w-10 flex-shrink-0 font-mono text-xs">{{
                      (clusterProfile.sectorMeans[sector] ?? 0).toFixed(1)
                    }}</span>
                  </div>
                </div>
                <div class="border-t pt-3">
                  <p class="text-gray-600 mb-2 text-xs font-semibold">
                    {{ $t("stats.clustering.municipalities_in_cluster") }}
                  </p>
                  <div class="columns-2 gap-x-3">
                    <NuxtLink
                      v-for="m in clusterProfile.municipalities"
                      :key="m.slug"
                      :to="`/municipalities/${m.slug}`"
                      class="block truncate py-0.5 text-xs text-blue-600 hover:underline"
                      >{{ m.name }}</NuxtLink
                    >
                  </div>
                </div>
              </template>
            </div>
          </div>
        </div>
        <!-- end tab: clustering -->

        <!-- TAB: Paarweiser Vergleich -->
        <div v-show="activeTab === 'dominance'">
          <!-- Method description -->
          <div class="mb-6 rounded-sm bg-white p-5 shadow-list">
            <h2 class="mb-2 text-base font-bold">{{ $t("stats.dominance.title") }}</h2>
            <p class="text-gray-600 mb-2 text-sm leading-relaxed">
              <span v-html="$t('stats.dominance.description_1')"></span>
            </p>
            <p class="text-gray-600 mb-2 text-sm leading-relaxed">
              <span v-html="$t('stats.dominance.description_2')"></span>
            </p>
            <p class="text-gray-400 mb-3 text-xs">{{ $t("stats.dominance.filter_note") }}</p>
            <button class="btn btn-outline btn-sm" @click="computeDominanceAndRender">
              {{ $t("stats.analysis.start") }}
            </button>
          </div>

          <!-- Win rate ranking chart -->
          <div class="mb-6 rounded-sm bg-white p-5 shadow-list">
            <h3 class="mb-1 text-sm font-bold">{{ $t("stats.dominance.win_rate_ranking") }}</h3>
            <p class="text-gray-500 mb-3 text-xs">{{ $t("stats.dominance.win_rate_ranking.description") }}</p>
            <div ref="dominanceRankContainer" class="w-full" style="min-height: 60px"></div>
            <p v-if="dominanceError" class="mt-2 text-sm text-error">{{ dominanceError }}</p>
          </div>

          <!-- Dominance heatmap -->
          <div class="mb-8 rounded-sm bg-white p-5 shadow-list">
            <h3 class="mb-1 text-sm font-bold">{{ $t("stats.dominance.matrix_top_40") }}</h3>
            <p class="text-gray-500 mb-3 text-xs">{{ $t("stats.dominance.matrix.description") }}</p>
            <div ref="dominanceHeatmapContainer" class="w-full overflow-x-auto" style="min-height: 60px"></div>
          </div>

          <!-- Force-directed dominance network -->
          <div class="mb-8 rounded-sm bg-white p-5 shadow-list">
            <h3 class="mb-1 text-sm font-bold">{{ $t("stats.dominance.network") }}</h3>
            <p class="text-gray-500 mb-2 text-xs">{{ $t("stats.dominance.network.description") }}</p>
            <p class="text-gray-400 mb-3 text-xs"><span v-html="$t('stats.dominance.network.note')"></span></p>
            <div ref="dominanceForceContainer" class="w-full" style="min-height: 700px"></div>
          </div>
        </div>
        <!-- end tab: dominance -->
      </div>
      <!-- /desktop content padding -->
    </section>
    <!-- /Gesamtstatistik -->
  </main>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from "vue";
import { Chart, BarController, BarElement, CategoryScale, LinearScale, Title, Tooltip, Legend } from "chart.js";

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Title, Tooltip, Legend);

const { $t, $directus, $readItems } = useNuxtApp();
import { getCatalogVersion } from "~/composables/getCatalogVersion.js";
import { getAllCatalogVersions } from "~/composables/getAllCatalogVersions.js";
import sectorImages from "~/shared/sectorImages.js";
import { isMunicipalityScorePublished } from "~/shared/municipality-score-publishing.js";

const route = useRoute();
const router = useRouter();
const municipalityNameCollator = new Intl.Collator("de-DE", {
  numeric: true,
  sensitivity: "base",
});

function compareByScoreThenName(a, b) {
  const scoreDifference = (b.score_total ?? 0) - (a.score_total ?? 0);
  if (scoreDifference !== 0) return scoreDifference;
  return municipalityNameCollator.compare(a.name ?? "", b.name ?? "");
}

function scrollToSection(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}
const selectedCatalogVersion = ref(await getCatalogVersion($directus, $readItems, route));
const selectedCatalogVersionId = ref(selectedCatalogVersion.value.id);
const catalogVersions = ref(await getAllCatalogVersions($directus, $readItems));

useHead({ title: ref($t("stats.title")) });

// ── Filter state ─────────────────────────────────────────────────────────────
const filterState = ref(null);
const filterType = ref(null);
const filterOpen = ref(false);
const activeFilterCount = computed(() => {
  let count = 0;
  if (filterState.value) count++;
  if (filterType.value) count++;
  return count;
});
const typeOptions = [
  { label: $t("stats.type.all_municipalities"), value: null },
  { label: $t("stats.type.big_cities"), value: "big_city" },
  { label: $t("stats.type.small_cities"), value: "small_city" },
];

const filterSuffix = computed(() => {
  const parts = [];
  if (filterState.value) parts.push(filterState.value);
  if (filterType.value) parts.push(typeOptions.find((o) => o.value === filterType.value)?.label ?? filterType.value);
  return parts.length ? ` (${parts.join(", ")})` : "";
});

// ── Chart/UI state ────────────────────────────────────────────────────────────
// sectorStats is a computed so it reacts to filterState / filterType changes.
// It uses filteredMunScores (already honours all active filters) to populate
// the per-measure rating buckets shown in the distribution panel.
const sectorStats = computed(() => {
  if (!statsData.value) return [];
  const { measures, ratings } = statsData.value;

  // Build localteam → municipality map from FILTERED completed scores only
  const localteamToMunicipality = {};
  filteredMunScores.value.forEach((ms) => {
    const mun = ms.municipality;
    if (mun?.localteam_id) localteamToMunicipality[mun.localteam_id] = { id: mun.id, name: mun.name, slug: mun.slug };
  });

  const sectorData = {};
  measures.forEach((measure) => {
    if (!sectorData[measure.sector]) {
      sectorData[measure.sector] = {
        sectorKey: measure.sector,
        sectorName: sectorNames[measure.sector] || measure.sector,
        measures: {},
      };
    }
    sectorData[measure.sector].measures[measure.id] = {
      id: measure.id,
      measure_id: measure.measure_id,
      name: measure.name,
      slug: measure.slug,
      ratings: { "-1": [], 0: [], 0.25: [], 0.5: [], 0.75: [], 1: [] },
    };
  });

  ratings.forEach((r) => {
    const measure = measures.find((m) => m.id === r.measure_id);
    if (!measure) return;
    const sector = sectorData[measure.sector];
    if (!sector?.measures[measure.id]) return;
    const rk = !r.applicable ? "-1" : r.rating !== null ? String(r.rating) : null;
    if (rk === null) return;
    const mun = localteamToMunicipality[r.localteam_id];
    if (mun) sector.measures[measure.id].ratings[rk].push(mun);
  });

  return Object.values(sectorData);
});

const sunburstContainer = ref(null);
const distPanelContainer = ref(null);
let vegaViewSunburst = null;
let vegaViewDist = null;
const clusterContainer = ref(null);
let vegaViewCluster = null;

const dominanceRankContainer = ref(null);
const dominanceHeatmapContainer = ref(null);
const dominanceError = ref("");
let vegaViewDominance = null;
let vegaViewDominanceHeatmap = null;
const dominanceForceContainer = ref(null);
let vegaViewDominanceForce = null;

const kClusters = ref(4);
const clusteringError = ref("");
const activeSectorFilter = ref("all");
const activeTab = ref("measures");

// Sunburst selection state
const sunburstSelection = ref({ type: null, sectorKey: null, measureId: null, label: "" });
// Mobile sub-tab for the measures panel (only active when isSmall)
const mobileMeasuresTab = ref("selection"); // 'selection' | 'plot' | 'list'
// Municipality panel filter (set when user clicks a bar in the distribution)
const panelMunFilter = ref({
  active: false,
  label: "",
  type: null,
  measureId: null,
  ratingKey: null,
  sectorKey: null,
  binRange: null,
});
// Cluster profile panel
const clusterProfile = ref({ clusterLabel: null, count: 0, avgTotal: "–", sectorMeans: {}, municipalities: [] });
// Raw cluster data for profile lookup (populated after computeClusteringAndRender)
const clusterData = ref([]);

// ── Constants ────────────────────────────────────────────────────────────────
const sectorOrder = ["energy", "transport", "agriculture", "industry", "buildings", "management"];

const sectorNames = {
  energy: $t("measure_sectors.energy.title"),
  transport: $t("measure_sectors.transport.title"),
  agriculture: $t("measure_sectors.agriculture.title"),
  industry: $t("measure_sectors.industry.title"),
  buildings: $t("measure_sectors.buildings.title"),
  management: $t("measure_sectors.management.title"),
};

const shortSectorNames = {
  energy: $t("measure_sectors.energy.title"),
  transport: $t("measure_sectors.transport.title"),
  agriculture: $t("stats.sector_short.agriculture"),
  industry: $t("stats.sector_short.industry"),
  buildings: $t("stats.sector_short.buildings"),
  management: $t("stats.sector_short.management"),
};

const sectorColors = {
  energy: "#F39200",
  transport: "#16BAE7",
  agriculture: "#1EA64A",
  industry: "#6B4C9A",
  buildings: "#E30613",
  management: "#AFCA0B",
};

const ratingColors = {
  "-1": "#9CA3AF",
  0: "#D9000D",
  0.25: "#F27C00",
  0.5: "#FFD400",
  0.75: "#AFCA0B",
  1: "#1DA64A",
};

const ratingLabelsMap = {
  "-1": $t("rating.not_applicable"),
  0: $t("rating.hardly_or_not"),
  0.25: $t("rating.initial_steps"),
  0.5: $t("rating.halfway"),
  0.75: $t("rating.mostly"),
  1: $t("rating.fullfilled"),
};

function getRatingKeys() {
  return selectedCatalogVersion.value.name === "beta"
    ? ["-1", "0", "0.25", "0.75", "1"]
    : ["-1", "0", "0.25", "0.5", "0.75", "1"];
}

function getRatingLabel(rating) {
  return ratingLabelsMap[rating] ?? rating;
}

const vegaColorScale = {
  domain: [-0.1, 0, 0.25, 0.5, 0.75, 1.0],
  range: ["#9CA3AF", "#D9000D", "#F27C00", "#FFD400", "#AFCA0B", "#1DA64A"],
};

function ratingToColor(r) {
  if (r == null || isNaN(r)) return "#9CA3AF";
  const stops = [
    [0, [217, 0, 13]],
    [0.25, [242, 124, 0]],
    [0.5, [255, 212, 0]],
    [0.75, [175, 202, 11]],
    [1, [29, 166, 74]],
  ];
  const clamped = Math.max(0, Math.min(1, r));
  for (let i = 0; i < stops.length - 1; i++) {
    const [t0, c0] = stops[i];
    const [t1, c1] = stops[i + 1];
    if (clamped <= t1) {
      const t = (clamped - t0) / (t1 - t0);
      return `rgb(${Math.round(c0[0] + t * (c1[0] - c0[0]))},${Math.round(c0[1] + t * (c1[1] - c0[1]))},${Math.round(c0[2] + t * (c1[2] - c0[2]))})`;
    }
  }
  return "#1DA64A";
}

function ratingTextColor(r) {
  if (r == null || isNaN(r)) return "#000000";
  return Math.max(0, Math.min(1, r)) < 0.095 ? "#ffffff" : "#000000";
}

function meanSectorScore(sectorKey) {
  const scores = filteredMunScores.value.map((ms) => parseFloat(ms[`score_${sectorKey}`])).filter((v) => !isNaN(v));
  if (!scores.length) return null;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

// ── Computed ─────────────────────────────────────────────────────────────────
const visibleMunicipalityScores = computed(() => {
  if (!statsData.value) return [];
  return statsData.value.municipalityScores.filter((ms) => {
    if (!ms.municipality || !isMunicipalityScorePublished(ms)) return false;
    if (filterState.value && ms.municipality.state !== filterState.value) return false;
    if (filterType.value && ms.municipality.municipality_type !== filterType.value) return false;
    return true;
  });
});

const filteredMunScores = computed(() => visibleMunicipalityScores.value);

const availableStates = computed(() => {
  if (!statsData.value) return [];
  const states = new Set();
  statsData.value.municipalityScores.forEach((ms) => {
    if (ms.municipality?.state) states.add(ms.municipality.state);
  });
  return [...states].sort();
});

const kpi = computed(() => {
  if (!statsData.value) {
    return {
      totalCompleted: 0,
      totalHalfRatedProgress: 0,
      totalMunicipalities: 0,
      totalMeasures: 0,
      totalFilledRatings: 0,
    };
  }
  const { municipalities, measures, ratings } = statsData.value;
  const completed = filteredMunScores.value;
  const halfRatedProgress = visibleMunicipalityScores.value.filter((ms) => {
    const percentage = parseFloat(ms.percentage_rated);
    return !isNaN(percentage) && percentage >= 1 && percentage < 98;
  });
  // Count ratings that are filled (rating != null OR applicable == false) for completed municipalities
  const ltSet = new Set();
  completed.forEach((ms) => {
    if (ms.municipality?.localteam_id) ltSet.add(ms.municipality.localteam_id);
  });
  const filledRatings = ratings.filter(
    (r) => ltSet.has(r.localteam_id) && (r.rating != null || r.applicable === false),
  ).length;
  return {
    totalCompleted: completed.length,
    totalHalfRatedProgress: halfRatedProgress.length,
    totalMunicipalities: municipalities.length,
    totalMeasures: measures.length,
    totalFilledRatings: filledRatings,
  };
});

const top10 = computed(() => {
  const sel = sunburstSelection.value;
  if (sel.type === "sector" && sel.sectorKey) {
    const scoreField = `score_${sel.sectorKey}`;
    return [...filteredMunScores.value]
      .map((ms) => {
        const v = parseFloat(ms[scoreField]);
        return {
          id: ms.municipality?.id,
          name: ms.municipality?.name,
          slug: ms.municipality?.slug,
          score_total: isNaN(v) ? null : v,
        };
      })
      .filter((ms) => ms.score_total != null)
      .sort(compareByScoreThenName)
      .slice(0, 10);
  }
  if (sel.type === "measure" && sel.measureId) {
    const ratingByLtId = new Map();
    statsData.value?.ratings?.forEach((r) => {
      if (r.measure_id === sel.measureId && r.applicable !== false && r.rating != null)
        ratingByLtId.set(r.localteam_id, parseFloat(r.rating));
    });
    return [...filteredMunScores.value]
      .filter((ms) => ms.municipality?.localteam_id && ratingByLtId.has(ms.municipality.localteam_id))
      .map((ms) => {
        const v = ratingByLtId.get(ms.municipality.localteam_id);
        return {
          id: ms.municipality?.id,
          name: ms.municipality?.name,
          slug: ms.municipality?.slug,
          score_total: v * 100,
        };
      })
      .sort(compareByScoreThenName)
      .slice(0, 10);
  }
  return [...filteredMunScores.value]
    .filter((ms) => ms.score_total != null)
    .map((ms) => ({
      id: ms.municipality?.id,
      name: ms.municipality?.name,
      slug: ms.municipality?.slug,
      score_total: parseFloat(ms.score_total),
    }))
    .filter((ms) => !isNaN(ms.score_total))
    .sort(compareByScoreThenName)
    .slice(0, 10);
});

// Municipality list shown in the detail panel — re-derives reactively from filteredMunScores
const panelMunicipalities = computed(() => {
  if (!panelMunFilter.value.active) return top10.value;
  const { type, measureId, ratingKey, sectorKey, binRange } = panelMunFilter.value;
  if (type === "measure-rating" && measureId != null && ratingKey != null) {
    const filteredMunIds = new Set(
      filteredMunScores.value.filter((ms) => ms.municipality?.id).map((ms) => ms.municipality.id),
    );
    for (const sector of sectorStats.value) {
      const m = sector.measures?.[measureId];
      if (m) return (m.ratings[ratingKey] ?? []).filter((mun) => filteredMunIds.has(mun.id));
    }
    return [];
  }
  if (type === "sector-bin" && sectorKey && binRange) {
    const [bin0, bin1] = binRange;
    return filteredMunScores.value
      .filter((ms) => {
        const s = parseFloat(ms[`score_${sectorKey}`]);
        return !isNaN(s) && s >= bin0 && s < bin1 + 0.0001;
      })
      .map((ms) => ({
        id: ms.municipality?.id,
        name: ms.municipality?.name,
        slug: ms.municipality?.slug,
        score_total: parseFloat(ms[`score_${sectorKey}`]),
      }));
  }
  if (type === "global-bin" && binRange) {
    const [bin0, bin1] = binRange;
    return filteredMunScores.value
      .filter((ms) => {
        const s = parseFloat(ms.score_total);
        return !isNaN(s) && s >= bin0 && s < bin1 + 0.0001;
      })
      .map((ms) => ({
        id: ms.municipality?.id,
        name: ms.municipality?.name,
        slug: ms.municipality?.slug,
        score_total: parseFloat(ms.score_total),
      }))
      .sort(compareByScoreThenName);
  }
  return top10.value;
});

const meanMeasureRatings = computed(() => {
  if (!statsData.value) return new Map();
  const { ratings, measures } = statsData.value;
  const completed = filteredMunScores.value;
  if (!completed.length) return new Map();
  const ltSet = new Set();
  completed.forEach((ms) => {
    if (ms.municipality?.localteam_id) ltSet.add(ms.municipality.localteam_id);
  });
  const sums = new Map();
  const counts = new Map();
  ratings.forEach((r) => {
    if (!ltSet.has(r.localteam_id)) return;
    if (!r.applicable) return;
    if (r.rating == null) return;
    const val = parseFloat(r.rating);
    if (isNaN(val)) return;
    const mid = r.measure_id;
    sums.set(mid, (sums.get(mid) ?? 0) + val);
    counts.set(mid, (counts.get(mid) ?? 0) + 1);
  });
  const result = new Map();
  measures.forEach((m) => {
    const s = sums.get(m.id);
    const c = counts.get(m.id);
    result.set(m.id, c ? s / c : null);
  });
  return result;
});

const filteredSectorStats = computed(() => {
  const ordered = sectorOrder.map((k) => sectorStats.value.find((s) => s.sectorKey === k)).filter(Boolean);
  if (activeSectorFilter.value === "all") return ordered;
  return ordered.filter((s) => s.sectorKey === activeSectorFilter.value);
});

// ── Data fetching ────────────────────────────────────────────────────────────
async function fetchStatsForCatalog(catalogVersionId) {
  const [municipalities, municipalityScores, measures, ratings] = await Promise.all([
    $directus.request(
      $readItems("municipalities", { fields: ["id", "name", "slug", "localteam_id", "population"], limit: -1 }),
    ),
    $directus.request(
      $readItems("municipality_scores", {
        fields: [
          "*",
          { municipality: ["id", "name", "slug", "localteam_id", "state", "municipality_type", "population"] },
        ],
        filter: { catalog_version: { _eq: catalogVersionId } },
        limit: -1,
      }),
    ),
    $directus.request(
      $readItems("measures", {
        filter: { catalog_version: { _eq: catalogVersionId } },
        limit: -1,
      }),
    ),
    $directus.request(
      $readItems("ratings_measures", {
        fields: ["measure_id", "rating", "applicable", "localteam_id"],
        filter: { measure_id: { catalog_version: { _eq: catalogVersionId } } },
        limit: -1,
      }),
    ),
  ]);
  return { municipalities, municipalityScores, measures, ratings };
}

const statsData = ref(null);
const statsLoading = ref(true);

// ── Sunburst (Vega-Lite two-layer arc) ───────────────────────────────────────
async function renderSunburst() {
  if (!sunburstContainer.value) return;
  try {
    const { default: vegaEmbed } = await import("vega-embed");
    if (vegaViewSunburst) {
      vegaViewSunburst.finalize();
      vegaViewSunburst = null;
    }
    sunburstContainer.value.innerHTML = "";
    if (!statsData.value?.measures?.length) return;
    const { measures } = statsData.value;
    const mmr = meanMeasureRatings.value;
    const innerRows = [];
    const outerRows = [];
    sectorOrder.forEach((sKey, si) => {
      const sector = sectorStats.value.find((s) => s.sectorKey === sKey);
      if (!sector) return;
      const sectorMeasures = measures.filter((m) => m.sector === sKey);
      if (!sectorMeasures.length) return;
      const measureMeans = sectorMeasures.map((m) => mmr.get(m.id)).filter((v) => v != null);
      const sectorMeanRating = measureMeans.length
        ? measureMeans.reduce((a, b) => a + b, 0) / measureMeans.length
        : null;
      // inner ring theta = sum of weights for this sector (proportional to total weight)
      const sectorWeight = sectorMeasures.reduce((s, m) => s + parseFloat(m.weight ?? 1), 0);
      innerRows.push({
        name: shortSectorNames[sKey] ?? sKey,
        theta: sectorWeight,
        meanRating: sectorMeanRating ?? -0.05,
        order: si,
        sectorKey: sKey,
      });
      sectorMeasures.forEach((m, mi) => {
        const mr = mmr.get(m.id);
        outerRows.push({
          name: m.name,
          sectorName: sectorNames[sKey] ?? sKey,
          theta: parseFloat(m.weight ?? 1),
          meanRatingDisplay: mr ?? -0.05,
          meanRating: mr,
          order: si * 1000 + mi,
          measureId: m.id,
          sectorKey: sKey,
        });
      });
    });
    const sel = sunburstSelection.value;
    const omScore = overallMeanScore.value;
    // Center circle — clickable (clears selection), no text label
    const centerLayers =
      omScore != null
        ? [
            {
              data: { values: [{ v: 1, isCenter: true }] },
              mark: {
                type: "arc",
                innerRadius: 0,
                outerRadius: 48,
                color: ratingToColor(omScore),
                cursor: "pointer",
                stroke: sel.type == null ? "#1d4ed8" : "white",
                strokeWidth: sel.type == null ? 3 : 1,
              },
              encoding: {
                theta: { field: "v", type: "quantitative" },
                tooltip: {
                  value: `Gesamtbewertung: ${(omScore * 100).toFixed(0)}%${sel.type != null ? " — klicken zum Zurücksetzen" : ""}`,
                },
              },
            },
          ]
        : [];
    // Sort so selected arc is rendered last in SVG (on top), preventing adjacent arcs from
    // painting their white stroke over the selected arc's blue highlight stroke.
    const sortedInnerRows =
      sel.type === "sector"
        ? [...innerRows].sort((a, b) => (a.sectorKey === sel.sectorKey ? 1 : b.sectorKey === sel.sectorKey ? -1 : 0))
        : innerRows;
    const sortedOuterRows =
      sel.type === "measure"
        ? [...outerRows].sort((a, b) => (a.measureId === sel.measureId ? 1 : b.measureId === sel.measureId ? -1 : 0))
        : outerRows;
    const spec = {
      $schema: "https://vega.github.io/schema/vega-lite/v6.json",
      width: "container",
      height: 360,
      view: { stroke: null },
      layer: [
        ...centerLayers,
        // Inner ring (sectors) — highlight stroke applied directly (no overlay layer)
        {
          data: { values: sortedInnerRows },
          mark: { type: "arc", innerRadius: 55, outerRadius: 118 },
          encoding: {
            theta: { field: "theta", type: "quantitative", stack: true },
            color: { field: "meanRating", type: "quantitative", scale: vegaColorScale, legend: null },
            order: { field: "order", type: "ordinal" },
            tooltip: [
              { field: "name", title: $t("stats.chart.sector") },
              { field: "meanRating", format: ".3f", title: $t("stats.chart.average_rating") },
            ],
            stroke:
              sel.type === "sector"
                ? { condition: { test: `datum.sectorKey === '${sel.sectorKey}'`, value: "#1d4ed8" }, value: "white" }
                : { value: "white" },
            strokeWidth:
              sel.type === "sector"
                ? { condition: { test: `datum.sectorKey === '${sel.sectorKey}'`, value: 3 }, value: 0.5 }
                : { value: 1 },
          },
        },
        // Outer ring (measures) — highlight stroke applied directly (no overlay layer)
        {
          data: { values: sortedOuterRows },
          mark: { type: "arc", innerRadius: 123, outerRadius: 195 },
          encoding: {
            theta: { field: "theta", type: "quantitative", stack: true },
            color: { field: "meanRatingDisplay", type: "quantitative", scale: vegaColorScale, legend: null },
            order: { field: "order", type: "ordinal" },
            tooltip: [
              { field: "name", title: $t("stats.chart.measure") },
              { field: "sectorName", title: $t("stats.chart.sector") },
              { field: "meanRating", format: ".3f", title: $t("stats.chart.average_rating") },
            ],
            stroke:
              sel.type === "measure"
                ? {
                    condition: { test: `datum.measureId === ${JSON.stringify(sel.measureId)}`, value: "#1d4ed8" },
                    value: "white",
                  }
                : { value: "white" },
            strokeWidth:
              sel.type === "measure"
                ? { condition: { test: `datum.measureId === ${JSON.stringify(sel.measureId)}`, value: 3 }, value: 0.3 }
                : { value: 0.5 },
          },
        },
      ],
      resolve: { scale: { theta: "independent", color: "independent" } },
    };
    const result = await vegaEmbed(sunburstContainer.value, spec, { renderer: "svg", actions: false });
    vegaViewSunburst = result.view;

    // Click handler: update selection, re-render sunburst with highlight + dist panel
    result.view.addEventListener("click", (_event, item) => {
      if (!item?.datum) return;
      const d = item.datum;
      if (d.isCenter) {
        clearSunburstSelection();
        return;
      }
      if (d.measureId) {
        sunburstSelection.value = { type: "measure", sectorKey: d.sectorKey, measureId: d.measureId, label: d.name };
      } else if (d.sectorKey) {
        sunburstSelection.value = { type: "sector", sectorKey: d.sectorKey, measureId: null, label: d.name };
      }
      clearPanelMunFilter();
      nextTick(() => {
        renderSunburst();
        renderDistPanel();
      });
    });
  } catch (e) {
    console.error("Sunburst render error", e);
  }
}

function clearSunburstSelection() {
  sunburstSelection.value = { type: null, sectorKey: null, measureId: null, label: "" };
  clearPanelMunFilter();
  nextTick(() => {
    renderSunburst();
    renderDistPanel();
  });
}

function clearPanelMunFilter() {
  panelMunFilter.value = {
    active: false,
    label: "",
    type: null,
    measureId: null,
    ratingKey: null,
    sectorKey: null,
    binRange: null,
  };
}

// ── Detail panel: distribution chart ─────────────────────────────────────────
async function renderDistPanel() {
  if (!distPanelContainer.value) return;
  const { default: vegaEmbed } = await import("vega-embed");
  if (vegaViewDist) {
    vegaViewDist.finalize();
    vegaViewDist = null;
  }
  distPanelContainer.value.innerHTML = "";

  const sel = sunburstSelection.value;

  if (!sel.type) {
    // Global: score histogram of all filtered municipalities
    const BIN_STEP = 5;
    const scores = filteredMunScores.value
      .filter((ms) => ms.score_total != null)
      .map((ms) => {
        const s = parseFloat(ms.score_total);
        if (isNaN(s)) return null;
        const bin_start = Math.floor(s / BIN_STEP) * BIN_STEP;
        return { score: s, bin_start, bin_end: bin_start + BIN_STEP };
      })
      .filter(Boolean);
    if (!scores.length) return;
    const selectedBin0Global = panelMunFilter.value.type === "global-bin" ? panelMunFilter.value.binRange?.[0] : null;
    const spec = {
      $schema: "https://vega.github.io/schema/vega-lite/v6.json",
      width: "container",
      height: 360,
      data: { values: scores },
      mark: { type: "bar", cursor: "pointer", strokeWidth: 2.5 },
      encoding: {
        x: {
          field: "bin_start",
          bin: "binned",
          type: "quantitative",
          title: $t("stats.chart.total_score_percent"),
          scale: { domain: [0, 100] },
        },
        x2: { field: "bin_end" },
        y: {
          aggregate: "count",
          type: "quantitative",
          title: $t("stats.municipalities"),
          axis: { tickMinStep: 1, format: "d", labelExpr: "datum.value % 1 === 0 ? datum.label : ''" },
        },
        color: {
          field: "bin_start",
          type: "quantitative",
          scale: {
            type: "threshold",
            domain: [25, 50, 75, 100],
            range: ["#D9000D", "#F27C00", "#FFD400", "#AFCA0B", "#1DA64A"],
          },
          legend: null,
        },
        tooltip: [
          { field: "bin_start", title: $t("stats.chart.score_from"), format: ".1f" },
          { field: "bin_end", title: $t("stats.chart.to"), format: ".1f" },
          { aggregate: "count", type: "quantitative", title: $t("stats.municipalities") },
        ],
        stroke:
          selectedBin0Global != null
            ? { condition: { test: `datum.bin_start === ${selectedBin0Global}`, value: "#1d4ed8" }, value: null }
            : { value: null },
      },
    };
    const res = await vegaEmbed(distPanelContainer.value, spec, { renderer: "svg", actions: false });
    vegaViewDist = res.view;
    res.view.addEventListener("click", (_e, item) => {
      if (!item?.datum) return;
      const bin0 = item.datum.bin_start;
      const bin1 = item.datum.bin_end;
      if (bin0 == null) return;
      panelMunFilter.value = {
        active: true,
        label: `Gesamtscore ${bin0}–${bin1}`,
        type: "global-bin",
        measureId: null,
        ratingKey: null,
        sectorKey: null,
        binRange: [bin0, bin1],
      };
      if (isSmall.value) mobileMeasuresTab.value = "list";
      nextTick(() => renderDistPanel());
    });
    return;
  }

  if (sel.type === "sector") {
    // Sector score distribution (binned histogram), clickable bins
    const sKey = sel.sectorKey;
    const BIN_STEP = 5;
    const scores = filteredMunScores.value
      .map((ms) => {
        const s = parseFloat(ms[`score_${sKey}`]);
        if (isNaN(s)) return null;
        const bin_start = Math.floor(s / BIN_STEP) * BIN_STEP;
        return {
          score: s,
          bin_start,
          bin_end: bin_start + BIN_STEP,
          name: ms.municipality?.name,
          slug: ms.municipality?.slug,
        };
      })
      .filter(Boolean);
    if (!scores.length) return;
    const selectedBin0 =
      panelMunFilter.value.type === "sector-bin" && panelMunFilter.value.sectorKey === sKey
        ? panelMunFilter.value.binRange?.[0]
        : null;
    const spec = {
      $schema: "https://vega.github.io/schema/vega-lite/v6.json",
      width: "container",
      height: 360,
      data: { values: scores },
      mark: { type: "bar", cursor: "pointer", strokeWidth: 2.5 },
      encoding: {
        x: {
          field: "bin_start",
          bin: "binned",
          type: "quantitative",
          title: `Score ${shortSectorNames[sKey]}`,
          scale: { domain: [0, 100] },
        },
        x2: { field: "bin_end" },
        y: {
          aggregate: "count",
          type: "quantitative",
          title: $t("stats.municipalities"),
          axis: { tickMinStep: 1, format: "d", labelExpr: "datum.value % 1 === 0 ? datum.label : ''" },
        },
        color: {
          field: "bin_start",
          type: "quantitative",
          scale: {
            type: "threshold",
            domain: [25, 50, 75, 100],
            range: ["#D9000D", "#F27C00", "#FFD400", "#AFCA0B", "#1DA64A"],
          },
          legend: null,
        },
        tooltip: [
          { field: "bin_start", title: $t("stats.chart.score_from"), format: ".1f" },
          { field: "bin_end", title: $t("stats.chart.to"), format: ".1f" },
          { aggregate: "count", type: "quantitative", title: $t("stats.municipalities") },
        ],
        stroke:
          selectedBin0 != null
            ? { condition: { test: `datum.bin_start === ${selectedBin0}`, value: "#1d4ed8" }, value: null }
            : { value: null },
      },
    };
    const res = await vegaEmbed(distPanelContainer.value, spec, { renderer: "svg", actions: false });
    vegaViewDist = res.view;
    // Click on a bin: filter municipality list to that bin
    res.view.addEventListener("click", (_e, item) => {
      if (!item?.datum) return;
      const bin0 = item.datum.bin_start;
      const bin1 = item.datum.bin_end;
      if (bin0 == null) return;
      panelMunFilter.value = {
        active: true,
        label: `${shortSectorNames[sKey]} ${bin0.toFixed(2)}–${bin1.toFixed(2)}`,
        type: "sector-bin",
        measureId: null,
        ratingKey: null,
        sectorKey: sKey,
        binRange: [bin0, bin1],
      };
      if (isSmall.value) mobileMeasuresTab.value = "list";
      nextTick(() => renderDistPanel());
    });
    return;
  }

  if (sel.type === "measure") {
    // Measure: rating distribution (categorical), clickable
    const measureId = sel.measureId;
    const sKey = sel.sectorKey;
    const sector = sectorStats.value.find((s) => s.sectorKey === sKey);
    const measureEntry = sector?.measures?.[measureId];
    if (!measureEntry) return;
    const ratingKeys = getRatingKeys();
    const values = ratingKeys.map((k) => ({
      label: ratingLabelsMap[k] ?? k,
      ratingKey: k,
      count: measureEntry.ratings[k]?.length ?? 0,
      color: ratingColors[k] ?? "#9CA3AF",
      municipalities: measureEntry.ratings[k] ?? [],
    }));
    const selectedRk =
      panelMunFilter.value.type === "measure-rating" && panelMunFilter.value.measureId === measureId
        ? panelMunFilter.value.ratingKey
        : null;
    const spec = {
      $schema: "https://vega.github.io/schema/vega-lite/v6.json",
      width: "container",
      height: 360,
      data: { values },
      mark: { type: "bar", cornerRadiusTopLeft: 3, cornerRadiusTopRight: 3, cursor: "pointer", strokeWidth: 2.5 },
      encoding: {
        x: { field: "label", type: "nominal", sort: null, title: $t("stats.chart.rating"), axis: { labelAngle: -20 } },
        y: {
          field: "count",
          type: "quantitative",
          title: $t("stats.municipalities"),
          axis: { tickMinStep: 1, format: "d", labelExpr: "datum.value % 1 === 0 ? datum.label : ''" },
        },
        color: { field: "color", type: "nominal", scale: null, legend: null },
        tooltip: [
          { field: "label", title: $t("stats.chart.rating") },
          { field: "count", title: $t("stats.municipalities") },
        ],
        stroke: {
          condition: { test: `datum.ratingKey === ${JSON.stringify(selectedRk)}`, value: "#1d4ed8" },
          value: null,
        },
      },
    };
    const res = await vegaEmbed(distPanelContainer.value, spec, { renderer: "svg", actions: false });
    vegaViewDist = res.view;
    // Click on a bar: filter municipality list to that rating
    res.view.addEventListener("click", (_e, item) => {
      if (!item?.datum) return;
      const rk = item.datum.ratingKey;
      if (!rk) return;
      panelMunFilter.value = {
        active: true,
        label: ratingLabelsMap[rk] ?? rk,
        type: "measure-rating",
        measureId,
        ratingKey: rk,
        sectorKey: null,
        binRange: null,
      };
      if (isSmall.value) mobileMeasuresTab.value = "list";
      nextTick(() => renderDistPanel());
    });
  }
}

// ── Arrow-key / button navigation through sectors & measures ─────────────────
const orderedMeasures = computed(() => {
  if (!statsData.value?.measures) return [];
  const result = [];
  sectorOrder.forEach((sKey) => {
    statsData.value.measures.filter((m) => m.sector === sKey).forEach((m) => result.push(m));
  });
  return result;
});

function navigateSunburstSelection(dir) {
  const sel = sunburstSelection.value;
  if (!sel.type) return;
  if (sel.type === "sector") {
    const idx = sectorOrder.indexOf(sel.sectorKey);
    if (idx === -1) return;
    const newIdx = (idx + dir + sectorOrder.length) % sectorOrder.length;
    const newKey = sectorOrder[newIdx];
    sunburstSelection.value = {
      type: "sector",
      sectorKey: newKey,
      measureId: null,
      label: shortSectorNames[newKey] ?? newKey,
    };
  } else {
    const measures = orderedMeasures.value;
    const idx = measures.findIndex((m) => m.id === sel.measureId);
    if (idx === -1) return;
    const newIdx = (idx + dir + measures.length) % measures.length;
    const m = measures[newIdx];
    sunburstSelection.value = { type: "measure", sectorKey: m.sector, measureId: m.id, label: m.name };
  }
  clearPanelMunFilter();
  nextTick(() => {
    renderSunburst();
    renderDistPanel();
  });
}

function handleArrowKey(e) {
  if (activeTab.value !== "measures") return;
  if (!sunburstSelection.value.type) return;
  if (e.key === "ArrowLeft") {
    e.preventDefault();
    navigateSunburstSelection(-1);
  } else if (e.key === "ArrowRight") {
    e.preventDefault();
    navigateSunburstSelection(1);
  }
}

// ── (legacy functions kept for possible reuse but no longer called directly) ──
async function openSectorDistribution() {}
async function openMeasureDistribution() {}
async function renderDistributionChart() {}

// ── (renderHistogram removed — distribution is now inline in the detail panel) ──

function setSectorFilter(key) {
  activeSectorFilter.value = key;
}
// ── Reactive re-render on filter change ──────────────────────────────────────
watch([filterState, filterType], () => {
  nextTick(() => {
    renderSunburst();
    renderDistPanel();
  });
});

function switchToClusteringTab() {
  activeTab.value = "clustering";
}

function switchToDominanceTab() {
  activeTab.value = "dominance";
  nextTick(() => {
    computeDominanceAndRender();
  });
}

// ── Pairwise Dominance Analysis ───────────────────────────────────────────────
async function computeDominanceAndRender() {
  dominanceError.value = "";
  try {
    await nextTick();
    if (!dominanceRankContainer.value || !dominanceHeatmapContainer.value || !dominanceForceContainer.value) {
      dominanceError.value = "Die Diagramm-Container konnten nicht initialisiert werden.";
      return;
    }

    const data = filteredMunScores.value;
    if (data.length < 3) {
      dominanceError.value = "Mindestens 3 Kommunen im aktuellen Filter benötigt.";
      return;
    }

    const { ratings: allRatings, measures: allMeasures } = statsData.value;

    const munData = data.filter((ms) => ms.municipality?.localteam_id);
    const N = munData.length;
    const ltIds = munData.map((ms) => ms.municipality.localteam_id);
    const names = munData.map((ms) => ms.municipality.name);

    // Build rating map per localteam: lt -> { measureId -> numeric 0-1 } (exclude N/A and null)
    const ltSet = new Set(ltIds);
    const ratingMap = {};
    allRatings.forEach((r) => {
      if (!ltSet.has(r.localteam_id)) return;
      if (r.applicable === false || r.rating == null) return;
      const v = parseFloat(r.rating);
      if (isNaN(v)) return;
      if (!ratingMap[r.localteam_id]) ratingMap[r.localteam_id] = {};
      ratingMap[r.localteam_id][r.measure_id] = v;
    });

    // Per-measure rating arrays indexed by municipality
    const measureIds = allMeasures.map((m) => m.id);
    const ratingArrays = measureIds.map((mid) => ltIds.map((lt) => ratingMap[lt]?.[mid] ?? null));

    // wins[i][j] = #measures where municipality i beat j
    // compared[i][j] = #measures where both had a valid rating
    const wins = Array.from({ length: N }, () => new Float32Array(N));
    const compared = Array.from({ length: N }, () => new Float32Array(N));

    for (const ratings of ratingArrays) {
      for (let i = 0; i < N; i++) {
        if (ratings[i] == null) continue;
        for (let j = i + 1; j < N; j++) {
          if (ratings[j] == null) continue;
          compared[i][j]++;
          compared[j][i]++;
          if (ratings[i] > ratings[j]) wins[i][j]++;
          else if (ratings[j] > ratings[i]) wins[j][i]++;
        }
      }
    }

    // Win rate per municipality
    const winRates = Array.from({ length: N }, (_, i) => {
      let totalW = 0,
        totalC = 0;
      for (let j = 0; j < N; j++) {
        totalW += wins[i][j];
        totalC += compared[i][j];
      }
      return totalC > 0 ? totalW / totalC : 0;
    });

    // Sort indices by win rate descending
    const sortedIdx = Array.from({ length: N }, (_, i) => i).sort((a, b) => winRates[b] - winRates[a]);

    // Ranking data for bar chart
    const rankingData = sortedIdx.map((i, rank) => ({
      name: names[i],
      winRate: winRates[i],
      wins: Array.from(wins[i]).reduce((s, v) => s + v, 0),
      losses: Array.from({ length: N }, (_, j) => wins[j][i]).reduce((s, v) => s + v, 0),
      rank: rank + 1,
    }));

    // Top 40 for heatmap, sorted by win rate → topNames defines display order
    const topN = Math.min(40, N);
    const topIdx = sortedIdx.slice(0, topN);
    const topNames = topIdx.map((i) => names[i]);

    const heatmapData = [];
    for (let ii = 0; ii < topN; ii++) {
      for (let jj = 0; jj < topN; jj++) {
        if (ii === jj) continue;
        const i = topIdx[ii],
          j = topIdx[jj];
        const rate = compared[i][j] > 0 ? wins[i][j] / compared[i][j] : 0.5;
        heatmapData.push({ row: names[i], col: names[j], rate });
      }
    }

    const { default: vegaEmbed } = await import("vega-embed");

    // ── Win rate ranking bar chart ─────────────────────────────────────────────
    if (vegaViewDominance) {
      vegaViewDominance.finalize();
      vegaViewDominance = null;
    }
    dominanceRankContainer.value.innerHTML = "";

    const rankSpec = {
      $schema: "https://vega.github.io/schema/vega-lite/v6.json",
      width: "container",
      height: { step: 18 },
      data: { values: rankingData },
      mark: { type: "bar", cornerRadiusEnd: 2 },
      encoding: {
        y: {
          field: "name",
          type: "nominal",
          sort: { field: "winRate", order: "descending" },
          title: null,
          axis: { labelFontSize: 10 },
        },
        x: {
          field: "winRate",
          type: "quantitative",
          title: $t("stats.chart.win_rate"),
          axis: { format: ".0%", labelFontSize: 10 },
          scale: { domain: [0, 1] },
        },
        color: {
          field: "winRate",
          type: "quantitative",
          scale: { domain: [0.25, 0.5, 0.75], range: ["#ef4444", "#f59e0b", "#1d4ed8"] },
          legend: null,
        },
        tooltip: [
          { field: "rank", type: "quantitative", title: $t("stats.chart.rank") },
          { field: "name", title: $t("stats.chart.municipality") },
          { field: "winRate", format: ".1%", title: $t("stats.chart.win_rate") },
          { field: "wins", title: $t("stats.chart.wins") },
          { field: "losses", title: $t("stats.chart.losses") },
        ],
      },
    };

    const r1 = await vegaEmbed(dominanceRankContainer.value, rankSpec, { renderer: "svg", actions: false });
    vegaViewDominance = r1.view;

    // ── Dominance heatmap ──────────────────────────────────────────────────────
    if (vegaViewDominanceHeatmap) {
      vegaViewDominanceHeatmap.finalize();
      vegaViewDominanceHeatmap = null;
    }
    dominanceHeatmapContainer.value.innerHTML = "";

    const step = Math.max(10, Math.floor(500 / topN));
    const heatSpec = {
      $schema: "https://vega.github.io/schema/vega-lite/v6.json",
      width: { step },
      height: { step },
      data: { values: heatmapData },
      mark: { type: "rect" },
      encoding: {
        y: {
          field: "row",
          type: "nominal",
          sort: topNames,
          title: null,
          axis: { labelFontSize: Math.min(10, step - 1) },
        },
        x: {
          field: "col",
          type: "nominal",
          sort: topNames,
          title: null,
          axis: { labelAngle: -45, labelFontSize: Math.min(10, step - 1) },
        },
        color: {
          field: "rate",
          type: "quantitative",
          scale: { domain: [0, 0.5, 1], range: ["#d62728", "#f0f0f0", "#1d4ed8"] },
          legend: { title: $t("stats.chart.win_rate") },
        },
        tooltip: [
          { field: "row", title: $t("stats.chart.row_wins") },
          { field: "col", title: $t("stats.chart.column_loses") },
          { field: "rate", format: ".1%", title: $t("stats.chart.row_win_rate") },
        ],
      },
    };

    const r2 = await vegaEmbed(dominanceHeatmapContainer.value, heatSpec, { renderer: "svg", actions: false });
    vegaViewDominanceHeatmap = r2.view;

    // ── Force-directed graph ──────────────────────────────────────────────────
    if (vegaViewDominanceForce) {
      vegaViewDominanceForce.finalize();
      vegaViewDominanceForce = null;
    }
    dominanceForceContainer.value.innerHTML = "";

    const { forceSimulation, forceManyBody, forceLink, forceCenter, forceCollide } = await import("d3-force");

    const forceNodes = sortedIdx.map((i, pos) => ({
      id: String(pos),
      rank: pos + 1,
      name: names[i],
      winRate: winRates[i],
    }));

    const forceLinks = [];
    for (let ii = 0; ii < N; ii++) {
      for (let jj = ii + 1; jj < N; jj++) {
        const i = sortedIdx[ii];
        const j = sortedIdx[jj];
        if (compared[i][j] === 0) continue;

        const rateIJ = wins[i][j] / compared[i][j];
        const dominance = Math.abs(rateIJ - 0.5) * 2;
        if (dominance < 0.08) continue;

        const winner = rateIJ >= 0.5 ? ii : jj;
        const loser = rateIJ >= 0.5 ? jj : ii;
        const topRate = Math.max(rateIJ, 1 - rateIJ);

        forceLinks.push({
          source: String(winner),
          target: String(loser),
          dominance,
          rate: topRate,
        });
      }
    }

    const visibleLinks = forceLinks.filter((l) => l.rate >= 0.68);
    const containerWidth = dominanceForceContainer.value.clientWidth || 900;
    const width = containerWidth;
    const height = Math.max(700, Math.min(1100, 300 + N * 14));

    const simulation = forceSimulation(forceNodes)
      .force("charge", forceManyBody().strength(-(70 + N * 2.5)))
      .force("center", forceCenter(width / 2, height / 2))
      .force(
        "collide",
        forceCollide()
          .radius((d) => 7 + d.winRate * 7)
          .iterations(2),
      )
      .force(
        "link",
        forceLink(forceLinks)
          .id((d) => d.id)
          .distance((d) => 140 - d.dominance * 95)
          .strength((d) => 0.08 + d.dominance * 0.35),
      )
      .stop();

    for (let i = 0; i < 300; i++) simulation.tick();

    // Normalize positions to fill the canvas
    const xs = forceNodes.map((n) => n.x ?? width / 2);
    const ys = forceNodes.map((n) => n.y ?? height / 2);
    const minX = Math.min(...xs),
      maxX = Math.max(...xs);
    const minY = Math.min(...ys),
      maxY = Math.max(...ys);
    const pad = 60;
    const scale = Math.min((width - 2 * pad) / (maxX - minX || 1), (height - 2 * pad) / (maxY - minY || 1));
    const offX = (width - (maxX - minX) * scale) / 2 - minX * scale;
    const offY = (height - (maxY - minY) * scale) / 2 - minY * scale;
    forceNodes.forEach((n) => {
      n.x = offX + (n.x ?? width / 2) * scale;
      n.y = offY + (n.y ?? height / 2) * scale;
    });

    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", String(height));
    svg.style.display = "block";
    svg.style.background = "white";

    const linksGroup = document.createElementNS(ns, "g");
    const nodesGroup = document.createElementNS(ns, "g");
    const labelsGroup = document.createElementNS(ns, "g");

    visibleLinks.forEach((link) => {
      const source = typeof link.source === "object" ? link.source : forceNodes.find((n) => n.id === link.source);
      const target = typeof link.target === "object" ? link.target : forceNodes.find((n) => n.id === link.target);
      if (!source || !target) return;
      const line = document.createElementNS(ns, "line");
      line.setAttribute("x1", String(source.x));
      line.setAttribute("y1", String(source.y));
      line.setAttribute("x2", String(target.x));
      line.setAttribute("y2", String(target.y));
      line.setAttribute("stroke", "#93c5fd");
      line.setAttribute("stroke-opacity", String(0.1 + (link.rate - 0.68) * 1.4));
      line.setAttribute("stroke-width", String(0.6 + (link.rate - 0.68) * 4));
      linksGroup.appendChild(line);
    });

    const colorForWinRate = (r) => {
      if (r < 0.38) return "#ef4444";
      if (r < 0.5) return "#f59e0b";
      if (r < 0.62) return "#60a5fa";
      return "#1d4ed8";
    };

    forceNodes.forEach((node, idx) => {
      const circle = document.createElementNS(ns, "circle");
      circle.setAttribute("cx", String(node.x));
      circle.setAttribute("cy", String(node.y));
      circle.setAttribute("r", String(4 + node.winRate * 7));
      circle.setAttribute("fill", colorForWinRate(node.winRate));
      circle.setAttribute("fill-opacity", "0.9");
      circle.setAttribute("stroke", "#ffffff");
      circle.setAttribute("stroke-width", "1");

      const title = document.createElementNS(ns, "title");
      title.textContent = `${node.rank}. ${node.name} — Gewinnrate ${(node.winRate * 100).toFixed(1)}%`;
      circle.appendChild(title);
      nodesGroup.appendChild(circle);

      if (idx < forceNodes.length) {
        const label = document.createElementNS(ns, "text");
        label.setAttribute("x", String(node.x + 7));
        label.setAttribute("y", String(node.y - 7));
        label.setAttribute("font-size", "10");
        label.setAttribute("fill", "#374151");
        label.textContent = node.name;
        labelsGroup.appendChild(label);
      }
    });

    svg.appendChild(linksGroup);
    svg.appendChild(nodesGroup);
    svg.appendChild(labelsGroup);
    dominanceForceContainer.value.appendChild(svg);
    vegaViewDominanceForce = null;
  } catch (e) {
    console.error("Dominance analysis error", e);
    dominanceError.value = `Fehler beim Rendern: ${e?.message || e}`;
  }
}
function kMeans(points, k, iters = 100) {
  // k-means++ init
  const centroids = [points[Math.floor(Math.random() * points.length)]];
  while (centroids.length < k) {
    const dists = points.map((p) => Math.min(...centroids.map((c) => (p.x - c.x) ** 2 + (p.y - c.y) ** 2)));
    const sum = dists.reduce((a, b) => a + b, 0);
    if (sum === 0) {
      centroids.push(points[Math.floor(Math.random() * points.length)]);
      continue;
    }
    let r = Math.random() * sum;
    let idx = 0;
    while (r > 0 && idx < dists.length - 1) {
      r -= dists[idx];
      idx++;
    }
    centroids.push(points[idx]);
  }
  let labels = points.map(() => 0);
  for (let iter = 0; iter < iters; iter++) {
    labels = points.map(
      (p) =>
        centroids.reduce(
          (best, c, ci) => {
            const d = (p.x - c.x) ** 2 + (p.y - c.y) ** 2;
            return d < best.d ? { ci, d } : best;
          },
          { ci: 0, d: Infinity },
        ).ci,
    );
    for (let ci = 0; ci < k; ci++) {
      const pts = points.filter((_, i) => labels[i] === ci);
      if (pts.length) {
        centroids[ci] = {
          x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
          y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
        };
      }
    }
  }
  return labels;
}

async function computeClusteringAndRender() {
  clusteringError.value = "";
  if (!clusterContainer.value) return;
  const data = filteredMunScores.value;
  if (!data.length) {
    clusteringError.value = "Keine vollständig bewerteten Kommunen im aktuellen Filter.";
    return;
  }
  if (data.length < kClusters.value + 1) {
    clusteringError.value = `Zu wenige Kommunen (${data.length}) für k=${kClusters.value} Cluster.`;
    return;
  }

  // Build feature matrix: individual measure ratings + log(population)
  const { measures: allMeasures, ratings: allRatings } = statsData.value;

  // Ordered list of measure IDs used as feature columns
  const measureIds = allMeasures.map((m) => m.id);

  // Build lookup: localteam_id -> { measureId -> numeric score (0..1, -1 = N/A, null = missing) }
  const ltRatingMap = {};
  allRatings.forEach((r) => {
    if (!ltRatingMap[r.localteam_id]) ltRatingMap[r.localteam_id] = {};
    ltRatingMap[r.localteam_id][r.measure_id] =
      r.applicable === false ? -1 : r.rating != null ? parseFloat(r.rating) : null;
  });

  const munItems = data
    .filter((ms) => ms.municipality?.localteam_id)
    .map((ms) => {
      const lt = ms.municipality.localteam_id;
      const munRatings = ltRatingMap[lt] ?? {};
      // Measure scores: use actual rating (0..1), 0 for N/A or missing
      const measureVec = measureIds.map((mid) => {
        const v = munRatings[mid];
        if (v == null || isNaN(v) || v < 0) return 0;
        return v;
      });
      return {
        name: ms.municipality.name,
        slug: ms.municipality.slug,
        scoreTotal: parseFloat(ms.score_total) || 0,
        vec: measureVec,
      };
    });

  if (munItems.length < kClusters.value + 1) {
    clusteringError.value = "Zu wenige Datenpunkte.";
    return;
  }

  try {
    const { PCA } = await import("ml-pca");
    const matrix = munItems.map((m) => m.vec);
    const pca = new PCA(matrix, { center: true, scale: false });
    const projected = pca.predict(matrix, { nComponents: 2 }).to2DArray();

    const points = projected.map((row) => ({ x: row[0], y: row[1] }));
    const clusterLabels = kMeans(points, kClusters.value);

    const palette = [
      "#1f77b4",
      "#ff7f0e",
      "#2ca02c",
      "#d62728",
      "#9467bd",
      "#8c564b",
      "#e377c2",
      "#7f7f7f",
      "#bcbd22",
      "#17becf",
    ];
    const rows = munItems.map((m, i) => ({
      name: m.name,
      slug: m.slug,
      x: points[i].x,
      y: points[i].y,
      scoreTotal: m.scoreTotal.toFixed(1),
      cluster: `Cluster ${clusterLabels[i] + 1}`,
    }));

    const clusterDomain = Array.from({ length: kClusters.value }, (_, i) => `Cluster ${i + 1}`);
    const clusterRange = clusterDomain.map((_, i) => palette[i % palette.length]);

    const spec = {
      $schema: "https://vega.github.io/schema/vega-lite/v6.json",
      width: "container",
      height: 460,
      data: { values: rows },
      mark: { type: "point", filled: true, size: 100, opacity: 0.85 },
      encoding: {
        x: { field: "x", type: "quantitative", title: "PC 1", axis: { grid: true } },
        y: { field: "y", type: "quantitative", title: "PC 2", axis: { grid: true } },
        color: {
          field: "cluster",
          type: "nominal",
          scale: { domain: clusterDomain, range: clusterRange },
          legend: { title: $t("stats.chart.cluster") },
        },
        tooltip: [
          { field: "name", type: "nominal", title: $t("stats.chart.municipality") },
          { field: "cluster", type: "nominal", title: $t("stats.chart.cluster") },
          { field: "scoreTotal", type: "nominal", title: "Score (%)" },
          { field: "x", type: "quantitative", title: "PC 1", format: ".3f" },
          { field: "y", type: "quantitative", title: "PC 2", format: ".3f" },
        ],
      },
    };

    const { default: vegaEmbed } = await import("vega-embed");
    if (vegaViewCluster) {
      vegaViewCluster.finalize();
      vegaViewCluster = null;
    }
    clusterContainer.value.innerHTML = "";
    const result = await vegaEmbed(clusterContainer.value, spec, { actions: false, renderer: "svg" });
    vegaViewCluster = result.view;

    // Store rows for profile lookup — keep slug for sector-score lookup
    clusterData.value = rows.map((r, i) => ({
      ...r,
      slug: munItems[i].slug,
    }));

    // Click on a point: show cluster profile
    result.view.addEventListener("click", (_e, item) => {
      if (!item?.datum) return;
      const clickedCluster = item.datum.cluster;
      if (!clickedCluster) return;
      const members = clusterData.value.filter((r) => r.cluster === clickedCluster);
      if (!members.length) return;

      // Look up sector scores from the original filtered data (0-100 scale)
      const slugSet = new Set(members.map((m) => m.slug));
      const memberScores = filteredMunScores.value.filter((ms) => slugSet.has(ms.municipality?.slug));
      const sectorMeans = {};
      sectorOrder.forEach((sk) => {
        const vals = memberScores.map((ms) => parseFloat(ms[`score_${sk}`])).filter((v) => !isNaN(v));
        sectorMeans[sk] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      });

      const totals = members.map((m) => parseFloat(m.scoreTotal)).filter((v) => !isNaN(v));
      const avgTotal = totals.length ? (totals.reduce((a, b) => a + b, 0) / totals.length).toFixed(1) : "–";
      clusterProfile.value = {
        clusterLabel: clickedCluster,
        count: members.length,
        avgTotal,
        sectorMeans,
        municipalities: members.map((m) => ({ name: m.name, slug: m.slug })),
      };
    });
  } catch (e) {
    console.error("Cluster error", e);
    clusteringError.value = `Fehler: ${e.message}`;
  }
}

// ── Small-screen hierarchical chooser ───────────────────────────────────────
const isSmall = ref(false);
function updateIsSmall() {
  isSmall.value = window.innerWidth < 640;
}
const expandedSectorKey = ref(null);
const showListView = ref(false);

const allSectorsOrdered = computed(() =>
  sectorOrder.map((k) => sectorStats.value.find((s) => s.sectorKey === k)).filter(Boolean),
);

const sunburstSelectionLink = computed(() => {
  const sel = sunburstSelection.value;
  if (!sel.type) return null;
  if (sel.type === "sector") return `/measures?sector=${sel.sectorKey}`;
  if (sel.type === "measure" && sel.sectorKey) {
    // Find measure slug from sectorStats
    const sector = sectorStats.value.find((s) => s.sectorKey === sel.sectorKey);
    const measure = sector?.measures?.[sel.measureId];
    if (measure?.slug) return `/measures/${measure.slug}`;
    // Fallback: link to sector page if no slug
    return `/measures?sector=${sel.sectorKey}`;
  }
  return null;
});

const sectorMeanScores = computed(() => {
  const mmr = meanMeasureRatings.value;
  const result = new Map();
  for (const sector of sectorStats.value) {
    const vals = Object.keys(sector.measures)
      .map((id) => mmr.get(id))
      .filter((v) => v != null);
    result.set(sector.sectorKey, vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null);
  }
  return result;
});

const overallMeanScore = computed(() => {
  const scores = [...sectorMeanScores.value.values()].filter((v) => v != null);
  return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
});

// Keep expandedSectorKey in sync when selection changes via keyboard / sunburst click
watch(
  sunburstSelection,
  (sel) => {
    expandedSectorKey.value = sel.sectorKey ?? null;
  },
  { deep: true },
);

// Re-render when switching away from small mode
watch(isSmall, (small) => {
  if (!small)
    nextTick(() => {
      renderSunburst();
      renderDistPanel();
    });
});

// Re-render sunburst when switching to diagram view (container was hidden when last render ran)
watch(showListView, (listView) => {
  if (!listView) nextTick(() => renderSunburst());
});

// On mobile, re-render the plot when switching to the 'plot' tab because the container was
// hidden (display:none) when Vega last rendered, causing it to measure 0 width.
watch(mobileMeasuresTab, (tab) => {
  if (tab === "plot") nextTick(() => renderDistPanel());
  if (tab === "selection") nextTick(() => renderSunburst());
});

function onChooserSectorClick(sector) {
  const key = sector.sectorKey;
  // Toggle expand; always update selection
  expandedSectorKey.value = expandedSectorKey.value === key ? null : key;
  sunburstSelection.value = { type: "sector", sectorKey: key, measureId: null, label: shortSectorNames[key] ?? key };
  clearPanelMunFilter();
  if (isSmall.value) {
    mobileMeasuresTab.value = "plot";
  } else {
    // Switch to sunburst view so it's visible when we re-render
    showListView.value = false;
  }
  nextTick(() => {
    renderSunburst();
    renderDistPanel();
  });
}

function onChooserMeasureClick(measure, sectorKey) {
  sunburstSelection.value = { type: "measure", sectorKey, measureId: measure.id, label: measure.name };
  clearPanelMunFilter();
  if (isSmall.value) {
    mobileMeasuresTab.value = "plot";
  } else {
    // Switch to sunburst view so it's visible when we re-render
    showListView.value = false;
  }
  nextTick(() => {
    renderSunburst();
    renderDistPanel();
  });
}

// ── Lifecycle ────────────────────────────────────────────────────────────────
onMounted(async () => {
  updateIsSmall();
  window.addEventListener("resize", updateIsSmall);
  window.addEventListener("keydown", handleArrowKey);

  statsData.value = await fetchStatsForCatalog(selectedCatalogVersion.value.id);
  statsLoading.value = false;

  nextTick(() => {
    renderSunburst();
    renderDistPanel();
  });
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", updateIsSmall);
  window.removeEventListener("keydown", handleArrowKey);
  if (vegaViewSunburst) vegaViewSunburst.finalize();
  if (vegaViewCluster) vegaViewCluster.finalize();
  if (vegaViewDist) vegaViewDist.finalize();
  if (vegaViewDominance) vegaViewDominance.finalize();
  if (vegaViewDominanceHeatmap) vegaViewDominanceHeatmap.finalize();
  if (vegaViewDominanceForce) vegaViewDominanceForce.finalize();
});

// ── Catalog version change ───────────────────────────────────────────────────
async function onCatalogVersionChange(newId) {
  const newVersion = catalogVersions.value.find((v) => v.id === newId);
  if (!newVersion) return;
  selectedCatalogVersionId.value = newId;
  selectedCatalogVersion.value = newVersion;
  router.replace({ query: { ...route.query, v: newVersion.name } });
  filterState.value = null;
  filterType.value = null;
  statsLoading.value = true;
  statsData.value = await fetchStatsForCatalog(newVersion.id);
  statsLoading.value = false;
  if (vegaViewSunburst) {
    vegaViewSunburst.finalize();
    vegaViewSunburst = null;
  }
  if (vegaViewCluster) {
    vegaViewCluster.finalize();
    vegaViewCluster = null;
  }
  if (vegaViewDist) {
    vegaViewDist.finalize();
    vegaViewDist = null;
  }
  sunburstSelection.value = { type: null, sectorKey: null, measureId: null, label: "" };
  expandedSectorKey.value = null;
  panelMunFilter.value = {
    active: false,
    label: "",
    type: null,
    measureId: null,
    ratingKey: null,
    sectorKey: null,
    binRange: null,
  };
  nextTick(() => {
    renderSunburst();
    renderDistPanel();
  });
}
</script>

<template>
  <div class="container mx-auto px-4 py-8">
    <header class="mb-10">
      <h1 class="mb-4 font-heading text-4xl font-black text-light-blue sm:text-6xl">
        {{ $t("tour.what_is_project") }}
      </h1>
      <p class="max-w-3xl text-lg leading-relaxed text-gray">{{ $t("tour.about_projects") }}</p>
      <div class="mt-6 flex flex-wrap gap-3">
        <CanonicalButton
          :label="$t('projects.submit.cta')"
          href="/projects/submit"
          icon-slug="mdi:send-outline"
          color="blue"
          text-color="white"
        />
        <CanonicalButton
          v-for="tour in featuredTours"
          :key="tour.id"
          :href="`/projects/tours/${tour.slug}`"
          :label="tour.title"
          icon-slug="mdi:map-marker-path"
          color="blue"
          text-color="white"
        />
      </div>
    </header>

    <h2 id="database" class="mb-5 font-heading text-3xl font-bold text-stats-dark">{{ $t("tour.database") }}</h2>

    <!-- Filter + Sort bar -->
    <div class="slk-filter-panel slk-filter-theme-blue mb-6 flex flex-col gap-0 p-3 shadow-md">
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
          <span>{{ $t("generic.filter_and_sort") }}</span>
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

      <div v-if="tourOptions.length > 0" class="pb-2 xs:hidden">
        <FilterBadgeDropdown
          v-model="selectedTour"
          :label="$t('tour.filter_all')"
          :options="tourOptions"
          width="min-w-60"
        />
      </div>

      <!-- Filter rows (always visible at xs+, collapsible below xs) -->
      <div v-show="filterOpen" class="xs:block!">
        <!-- Filter row -->
        <div class="grid grid-cols-[1.5rem_1fr] items-start gap-x-2 py-1.5">
          <!-- Filter icon -->
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
          <div class="flex flex-wrap gap-2">
            <FilterBadgeDropdown
              v-model="selectedState"
              :label="$t('filters.all_states')"
              :options="stateOptions"
              width="min-w-52"
            />
            <FilterBadgeDropdown
              v-model="selectedSector"
              :label="$t('measure_sectors.all')"
              :options="sectorOptions"
              width="min-w-44"
            />
            <FilterBadgeDropdown
              v-if="orgOptions.length > 0"
              v-model="selectedOrgId"
              :label="$t('filters.all_organisations')"
              :options="orgOptions"
              width="min-w-48"
            />
            <div v-if="tourOptions.length > 0" class="hidden xs:block">
              <FilterBadgeDropdown
                v-model="selectedTour"
                :label="$t('tour.filter_all')"
                :options="tourOptions"
                width="min-w-60"
              />
            </div>
            <FilterBadgeBoolean v-model="filterAutonomous" :label="$t('projects.filters.autonomous')" />
            <FilterBadgeBoolean v-model="filterProfitable" :label="$t('projects.filters.profitable')" />
            <FilterBadgeBoolean v-model="filterRoleModel" :label="$t('projects.filters.role_model')" />
            <FilterBadgeBoolean v-model="filterAcceptance" :label="$t('projects.filters.acceptance')" />
          </div>
        </div>

        <div class="slk-filter-rule my-0.5 border-t" />

        <div class="grid grid-cols-[1.5rem_1fr] items-center gap-x-2 py-1.5">
          <svg
            class="slk-filter-panel-icon h-4 w-4"
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
          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              class="slk-filter-pill"
              :class="!isMapView ? 'slk-filter-pill--active' : ''"
              @click="router.replace({ query: { ...route.query, view: undefined } })"
            >
              {{ $t("generic.view.list") }}
            </button>
            <button
              type="button"
              class="slk-filter-pill"
              :class="isMapView ? 'slk-filter-pill--active' : ''"
              @click="router.replace({ query: { ...route.query, view: 'map' } })"
            >
              {{ $t("municipalities.view.map") }}
            </button>
          </div>
        </div>

        <div class="slk-filter-rule my-0.5 border-t" />

        <!-- Sort row -->
        <div class="grid grid-cols-[1.5rem_1fr] items-center gap-x-2 py-1.5">
          <!-- Sort icon -->
          <svg
            class="slk-filter-panel-icon h-4 w-4 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 6h18M7 12h10M11 18h2" />
          </svg>
          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              :class="['slk-filter-pill', sortOrder === 'date' ? 'slk-filter-pill--active' : '']"
              @click="sortOrder = 'date'"
            >
              {{ $t("projects.sort.newest_first") }}
            </button>
            <button
              type="button"
              :class="['slk-filter-pill', sortOrder === 'savings' ? 'slk-filter-pill--active' : '']"
              @click="sortOrder = 'savings'"
            >
              {{ $t("projects.sort.highest_savings") }}
            </button>
          </div>
        </div>
      </div>
      <!-- /collapsible -->
    </div>

    <div v-if="filteredProjects.length === 0 && !isMapView">
      {{ selectedTour ? $t("tour.no_published_projects") : $t("projects.empty_placeholder") }}
    </div>

    <div v-if="isMapView" class="h-[65vh] min-h-112 overflow-hidden rounded-xl border border-solid-stats-dark-20">
      <ClientOnly v-if="mapProjects.length">
        <ProjectsMap :projects="mapProjects" />
        <template #fallback
          ><p class="p-6">{{ $t("tour.map_unavailable") }}</p></template
        >
      </ClientOnly>
      <p v-else class="p-6 text-gray">{{ $t("projects.map.empty") }}</p>
    </div>

    <div v-else class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      <div v-for="project in filteredProjects" :key="project.id" class="relative">
        <span
          v-if="project.profile_stage === 'preview'"
          class="absolute top-3 right-3 z-10 rounded-full bg-white px-3 py-1 text-xs font-bold text-stats-dark shadow-sm"
        >
          {{ $t("tour.preview") }}
        </span>
        <ProjectCard
          :slug="project.slug"
          :title="project.title"
          :municipality_name="project.municipality_name ?? undefined"
          :state="project.state ?? undefined"
          :abstract="project.abstract ?? undefined"
          :author="project.author ?? undefined"
          :date="project.date_created ? new Date(project.date_created) : null"
          :image_id="project.image?.id"
          :image_is_raster="project.image ? isRaster(project.image.type) : false"
          :image_credits="project.image_credits || null"
          :organisation="project.organisation"
          :measures="(project.measures || []).flatMap((m) => (m.measures_id ? [m.measures_id] : []))"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { isRaster } from "~/shared/utils";
import { pointLatLng } from "~/shared/tour";
const fetchContent = useContentFetch();

const { $t, $translateDynamic } = useNuxtApp();
const route = useRoute();
const router = useRouter();
const isMapView = computed(() => route.query.view === "map");

// Use server routes — $directus is only available during SSR, not on client
const { data: projectList } = await useAsyncData("articles-index", async () => {
  const result = await fetchContent("/api/public/articles");
  return result.articles ?? [];
});

// Municipality locations are already included in article data via the municipality relation
const municipalityLocations = computed(() => {
  const seen = new Map<string, NonNullable<NonNullable<typeof projectList.value>[number]["municipality"]>>();
  for (const project of projectList.value ?? []) {
    const m = project.municipality;
    if (m?.id && !seen.has(m.id)) {
      seen.set(m.id, m);
    }
  }
  return [...seen.values()];
});

const { data: tourData } = await useAsyncData("project-tour-options", async () => {
  return await fetchContent("/api/public/projects-tours");
});

const featuredTours = computed(() => (tourData.value?.series ?? []).filter((tour) => tour.featured_on_projects));
const tourProjectIds = computed(() => {
  const ids = new Map<string, Set<number>>();
  for (const link of tourData.value?.links ?? []) {
    if (!ids.has(link.series)) ids.set(link.series, new Set());
    ids.get(link.series)?.add(link.article);
  }
  return ids;
});
const tourOptions = computed(() =>
  (tourData.value?.series ?? []).map((series) => ({ label: series.title, value: series.slug })),
);
const selectedTour = computed({
  get: () => (typeof route.query.tour === "string" ? route.query.tour : null),
  set: (tour) => {
    void router.replace({ query: { ...route.query, tour: tour || undefined } });
  },
});

// ── Filter state ────────────────────────────────────────────────────────────
const selectedState = ref<string | null>(null);
const selectedSector = ref<string | null>(null);
const selectedOrgId = ref<string | null>(null);
const selectedMunicipality = computed(() => {
  const value = route.query.municipality;
  return typeof value === "string" && value.trim() ? value.trim() : null;
});
const filterAutonomous = ref(false);
const filterProfitable = ref(false);
const filterRoleModel = ref(false);
const filterAcceptance = ref(false);

// ── Sort state ──────────────────────────────────────────────────────────────
const sortOrder = ref("date"); // 'date' | 'savings'

// ── Filter panel collapsible ─────────────────────────────────────────────────
const filterOpen = ref(false);
const activeFilterCount = computed(() => {
  let count = 0;
  if (selectedState.value) count++;
  if (selectedSector.value) count++;
  if (selectedOrgId.value) count++;
  if (selectedMunicipality.value) count++;
  if (selectedTour.value) count++;
  if (isMapView.value) count++;
  if (filterAutonomous.value) count++;
  if (filterProfitable.value) count++;
  if (filterRoleModel.value) count++;
  if (filterAcceptance.value) count++;
  if (sortOrder.value !== "date") count++;
  return count;
});

// ── Static dropdown options ─────────────────────────────────────────────────
const stateOptions = [
  "Baden-Württemberg",
  "Bayern",
  "Berlin",
  "Brandenburg",
  "Bremen",
  "Hamburg",
  "Hessen",
  "Mecklenburg-Vorpommern",
  "Niedersachsen",
  "Nordrhein-Westfalen",
  "Rheinland-Pfalz",
  "Saarland",
  "Sachsen",
  "Sachsen-Anhalt",
  "Schleswig-Holstein",
  "Thüringen",
].map((s) => ({ label: s, value: s }));

const sectorValues = [
  "Abfallwirtschaft",
  "Finanzierung",
  "Gebäude",
  "Governance",
  "Industrie",
  "Kraftstoffe",
  "LULUCF",
  "Landwirtschaft",
  "Sonstiges",
  "Strom",
  "Verkehr",
  "Wärme",
];

const sectorKeyMap: Record<string, string> = {
  Abfallwirtschaft: "waste_management",
  Finanzierung: "financing",
  Gebäude: "buildings",
  Governance: "governance",
  Industrie: "industry",
  Kraftstoffe: "fuels",
  LULUCF: "lulucf",
  Landwirtschaft: "agriculture",
  Sonstiges: "other",
  Strom: "electricity",
  Verkehr: "transport",
  Wärme: "heating",
};

const sectorOptions = computed(() =>
  sectorValues.map((value) => ({
    label: $translateDynamic(`projects.sector.${sectorKeyMap[value]}`),
    value,
  })),
);

// ── Organisation options derived from loaded data (no extra API call) ────────
const orgOptions = computed(() => {
  if (!projectList.value) return [];
  const seen = new Set();
  const opts: { label: string; value: string }[] = [];
  for (const a of projectList.value) {
    if (a.organisation && !seen.has(a.organisation.id)) {
      seen.add(a.organisation.id);
      opts.push({ label: a.organisation.name, value: String(a.organisation.id) });
    }
  }
  return opts.sort((a, b) => a.label.localeCompare(b.label));
});

// ── Savings sort weight ──────────────────────────────────────────────────────
const savingsWeight: Record<string, number> = { very_high: 2, high: 1 };
function getSavingsWeight(level: string | null) {
  return savingsWeight[level ?? ""] ?? 0;
}

// ── Filtered + sorted list ───────────────────────────────────────────────────
const filteredProjects = computed(() => {
  if (!projectList.value) return [];

  const filtered = projectList.value.filter((a) => {
    if (selectedState.value !== null && a.state !== selectedState.value) return false;
    if (selectedSector.value !== null && !(a.sectors ?? []).includes(selectedSector.value)) return false;
    if (selectedOrgId.value !== null && String(a.organisation?.id) !== selectedOrgId.value) return false;
    if (selectedMunicipality.value !== null && a.municipality_name !== selectedMunicipality.value) return false;
    if (selectedTour.value) {
      const series = tourData.value?.series.find((item) => item.slug === selectedTour.value);
      if (!series || !tourProjectIds.value.get(series.id)?.has(a.id)) return false;
    }
    if (filterAutonomous.value && !a.can_do_autonomously) return false;
    if (filterProfitable.value && !a.is_profitable) return false;
    if (filterRoleModel.value && !(a.public_impact_effects ?? []).includes("role_model")) return false;
    if (filterAcceptance.value && !(a.public_impact_effects ?? []).includes("increase_acceptance")) return false;
    return true;
  });

  if (sortOrder.value === "savings") {
    filtered.sort((a, b) => {
      const diff = getSavingsWeight(b.ghg_savings_level) - getSavingsWeight(a.ghg_savings_level);
      if (diff !== 0) return diff;
      return new Date(b.date_created ?? 0).getTime() - new Date(a.date_created ?? 0).getTime();
    });
  }
  // 'date' order already comes from the server sort: "-date_created"

  return filtered;
});

const mapProjects = computed(() =>
  filteredProjects.value.flatMap((project) => {
    const linkedMunicipality = project.municipality;
    let municipality = linkedMunicipality?.geolocation ? linkedMunicipality : null;
    if (!municipality && project.municipality_name) {
      const matches = (municipalityLocations.value ?? []).filter(
        (item) => item.name === project.municipality_name && (!project.state || item.state === project.state),
      );
      if (matches.length === 1) municipality = matches[0] ?? null;
    }
    const point = pointLatLng(municipality?.geolocation);
    return point
      ? [
          {
            id: project.id,
            slug: project.slug,
            title: project.title,
            municipalityName: municipality?.name ?? "",
            point,
          },
        ]
      : [];
  }),
);

// ── Meta ─────────────────────────────────────────────────────────────────────
const title = ref($t("projects.title"));
usePageSeo({ title });
</script>

<template>
  <div class="container mx-auto px-4 py-8">
    <h1 class="center text-4xl font-bold mb-6" style="color: #006e94;">{{ $t("projects.title") }}</h1>

    <!-- Filter + Sort bar -->
    <div class="shadow-md flex flex-col gap-0 mb-6 p-3" style="background-color: #E8F7FD;">

      <!-- Collapsible toggle (only shown below xs breakpoint) -->
      <button class="flex xs:hidden w-full items-center justify-between py-1 text-sm font-medium text-[#16BAE7]" @click="filterOpen = !filterOpen">
        <span class="flex items-center gap-2">
          <svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 01.707 1.707L14 12.414V19a1 1 0 01-1.447.894l-4-2A1 1 0 018 17v-4.586L3.293 5.707A1 1 0 013 5V4z" />
          </svg>
          <span>{{ $t("generic.filter_and_sort") }}</span>
          <span v-if="activeFilterCount > 0" class="bg-[#16BAE7] text-white text-xs rounded-full px-1.5 py-0.5 font-bold leading-none">{{ activeFilterCount }}</span>
        </span>
        <svg class="w-4 h-4 flex-shrink-0 transition-transform duration-200" :class="filterOpen ? 'rotate-180' : ''" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <!-- Filter rows (always visible at xs+, collapsible below xs) -->
      <div v-show="filterOpen" class="xs:!block">

      <!-- Filter row -->
      <div class="grid grid-cols-[1.5rem_1fr] gap-x-2 items-start py-1.5">
        <!-- Filter icon -->
        <svg class="w-4 h-4 flex-shrink-0 mt-1" style="color: #16BAE7;" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 01.707 1.707L14 12.414V19a1 1 0 01-1.447.894l-4-2A1 1 0 018 17v-4.586L3.293 5.707A1 1 0 013 5V4z" />
        </svg>
        <div class="flex flex-wrap gap-2">
          <FilterBadgeDropdown
            :label="$t('filters.all_states')"
            :options="stateOptions"
            v-model="selectedState"
            width="min-w-[13rem]"
          />
          <FilterBadgeDropdown
            :label="$t('measure_sectors.all')"
            :options="sectorOptions"
            v-model="selectedSector"
            width="min-w-[11rem]"
          />
          <FilterBadgeDropdown
            v-if="orgOptions.length > 0"
            :label="$t('filters.all_organisations')"
            :options="orgOptions"
            v-model="selectedOrgId"
            width="min-w-[12rem]"
          />
          <FilterBadgeBoolean :label="$t('projects.filters.autonomous')" v-model="filterAutonomous" />
          <FilterBadgeBoolean :label="$t('projects.filters.profitable')" v-model="filterProfitable" />
          <FilterBadgeBoolean :label="$t('projects.filters.role_model')" v-model="filterRoleModel" />
          <FilterBadgeBoolean :label="$t('projects.filters.acceptance')" v-model="filterAcceptance" />
        </div>
      </div>

      <div class="border-t border-[#16BAE7]/20 my-0.5" />

      <!-- Sort row -->
      <div class="grid grid-cols-[1.5rem_1fr] gap-x-2 items-center py-1.5">
        <!-- Sort icon -->
        <svg class="w-4 h-4 flex-shrink-0" style="color: #16BAE7;" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3 6h18M7 12h10M11 18h2" />
        </svg>
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            @click="sortOrder = 'date'"
            :class="[
              'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border transition-colors whitespace-nowrap',
              sortOrder === 'date'
                ? 'bg-[#16BAE7] text-white border-[#16BAE7]'
                : 'bg-white text-[#16BAE7] border-[#16BAE7] hover:bg-[#E8F7FD]'
            ]"
          >
            {{ $t("projects.sort.newest_first") }}
          </button>
          <button
            type="button"
            @click="sortOrder = 'savings'"
            :class="[
              'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border transition-colors whitespace-nowrap',
              sortOrder === 'savings'
                ? 'bg-[#16BAE7] text-white border-[#16BAE7]'
                : 'bg-white text-[#16BAE7] border-[#16BAE7] hover:bg-[#E8F7FD]'
            ]"
          >
            {{ $t("projects.sort.highest_savings") }}
          </button>
        </div>
      </div>

      </div><!-- /collapsible -->
    </div>

    <div v-if="filteredProjects.length === 0">
      {{ $t('projects.empty_placeholder') }}
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <ProjectCard
        v-for="(project, index) in filteredProjects"
        :key="index"
        :slug="project.slug"
        :title="project.title"
        :municipality_name="project.municipality_name"
        :state="project.state"
        :abstract="project.abstract"
        :author="project.author"
        :date="project.date_created ? new Date(project.date_created) : null"
        :image_id="project.image?.id"
        :image_is_raster="project.image ? isRaster(project.image.type) : false"
        :organisation="project.organisation"
        :measures="(project.measures || []).map(m => m.measures_id).filter(Boolean)"
      />
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { isRaster } from "~/shared/utils";
const { $directus, $readItems, $t } = useNuxtApp();
const route = useRoute();

const { data: projectList } = await useAsyncData("articles-index", () => {
  return $directus.request(
    $readItems("articles", {
      fields: [
        "slug",
        "title",
        "abstract",
        "author",
        "date_created",
        "municipality_name",
        "state",
        "sectors",
        "can_do_autonomously",
        "is_profitable",
        "public_impact_effects",
        "ghg_savings_level",
        { image: ["id", "type"] },
        { organisation: ["id", "name", "logo"] },
        { measures: [{ measures_id: ["id", "measure_id", "name", "slug"] }] },
      ],
      sort: "-date_created",
      limit: -1,
    })
  );
});

// ── Filter state ────────────────────────────────────────────────────────────
const selectedState    = ref(null);
const selectedSector   = ref(null);
const selectedOrgId    = ref(null);
const selectedMunicipality = computed(() => {
  const value = route.query.municipality;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
});
const filterAutonomous = ref(false);
const filterProfitable = ref(false);
const filterRoleModel  = ref(false);
const filterAcceptance = ref(false);

// ── Sort state ──────────────────────────────────────────────────────────────
const sortOrder = ref('date'); // 'date' | 'savings'

// ── Filter panel collapsible ─────────────────────────────────────────────────
const filterOpen = ref(false);
const activeFilterCount = computed(() => {
  let count = 0;
  if (selectedState.value) count++;
  if (selectedSector.value) count++;
  if (selectedOrgId.value) count++;
  if (selectedMunicipality.value) count++;
  if (filterAutonomous.value) count++;
  if (filterProfitable.value) count++;
  if (filterRoleModel.value) count++;
  if (filterAcceptance.value) count++;
  if (sortOrder.value !== 'date') count++;
  return count;
});

// ── Static dropdown options ─────────────────────────────────────────────────
const stateOptions = [
  'Baden-Württemberg', 'Bayern', 'Berlin', 'Brandenburg', 'Bremen',
  'Hamburg', 'Hessen', 'Mecklenburg-Vorpommern', 'Niedersachsen',
  'Nordrhein-Westfalen', 'Rheinland-Pfalz', 'Saarland', 'Sachsen',
  'Sachsen-Anhalt', 'Schleswig-Holstein', 'Thüringen',
].map(s => ({ label: s, value: s }));

const sectorValues = [
  'Abfallwirtschaft', 'Finanzierung', 'Gebäude', 'Governance', 'Industrie',
  'Kraftstoffe', 'LULUCF', 'Landwirtschaft', 'Sonstiges', 'Strom', 'Verkehr', 'Wärme',
];

const sectorKeyMap = {
  Abfallwirtschaft: 'waste_management',
  Finanzierung: 'financing',
  Gebäude: 'buildings',
  Governance: 'governance',
  Industrie: 'industry',
  Kraftstoffe: 'fuels',
  LULUCF: 'lulucf',
  Landwirtschaft: 'agriculture',
  Sonstiges: 'other',
  Strom: 'electricity',
  Verkehr: 'transport',
  Wärme: 'heating',
};

const sectorOptions = computed(() =>
  sectorValues.map(value => ({
    label: $t(`projects.sector.${sectorKeyMap[value]}`),
    value,
  }))
);

// ── Organisation options derived from loaded data (no extra API call) ────────
const orgOptions = computed(() => {
  if (!projectList.value) return [];
  const seen = new Set();
  const opts = [];
  for (const a of projectList.value) {
    if (a.organisation && !seen.has(a.organisation.id)) {
      seen.add(a.organisation.id);
      opts.push({ label: a.organisation.name, value: a.organisation.id });
    }
  }
  return opts.sort((a, b) => a.label.localeCompare(b.label));
});

// ── Savings sort weight ──────────────────────────────────────────────────────
const savingsWeight = { very_high: 2, high: 1 };
function getSavingsWeight(level) {
  return savingsWeight[level] ?? 0;
}

// ── Filtered + sorted list ───────────────────────────────────────────────────
const filteredProjects = computed(() => {
  if (!projectList.value) return [];

  const filtered = projectList.value.filter(a => {
    if (selectedState.value  !== null && a.state !== selectedState.value) return false;
    if (selectedSector.value !== null && !(a.sectors ?? []).includes(selectedSector.value)) return false;
    if (selectedOrgId.value  !== null && a.organisation?.id !== selectedOrgId.value) return false;
    if (selectedMunicipality.value !== null && a.municipality_name !== selectedMunicipality.value) return false;
    if (filterAutonomous.value && !a.can_do_autonomously) return false;
    if (filterProfitable.value && !a.is_profitable) return false;
    if (filterRoleModel.value  && !(a.public_impact_effects ?? []).includes('role_model')) return false;
    if (filterAcceptance.value && !(a.public_impact_effects ?? []).includes('increase_acceptance')) return false;
    return true;
  });

  if (sortOrder.value === 'savings') {
    filtered.sort((a, b) => {
      const diff = getSavingsWeight(b.ghg_savings_level) - getSavingsWeight(a.ghg_savings_level);
      if (diff !== 0) return diff;
      return new Date(b.date_created) - new Date(a.date_created);
    });
  }
  // 'date' order already comes from the server sort: "-date_created"

  return filtered;
});

// ── Meta ─────────────────────────────────────────────────────────────────────
const title = ref($t("projects.title"));
useHead({ title });
</script>

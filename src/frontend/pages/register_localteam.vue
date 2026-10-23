<template>
  <div class="mx-auto max-w-3xl px-2 py-8 xs:px-4">
    <NuxtLink to="/municipalities" class="font-heading text-h4 text-light-blue">
      ← {{ $t("municipalities.back_to_overview") }}
    </NuxtLink>

    <div class="mt-6">
      <h1 class="mb-2 font-heading text-h1 font-bold text-green">{{ $t("localteam.create") }}</h1>
      <p class="text-gray-600 mb-6">
        {{ $t("localteam.register.intro") }}
      </p>

      <!-- Step indicator -->
      <div class="mb-6 flex select-none items-center gap-2 xs:gap-3">
        <!-- Step 1 -->
        <div class="flex items-center gap-1.5 xs:gap-2">
          <div
            class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors"
            :class="selectedArea ? 'bg-green text-white' : 'bg-green text-white'"
          >
            <svg v-if="selectedArea" class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
            </svg>
            <span v-else>1</span>
          </div>
          <span class="hidden text-sm font-medium xs:inline" :class="selectedArea ? 'text-gray-400' : 'text-gray-800'">
            {{ $t("localteam.register.step.select_municipality") }}
          </span>
        </div>
        <div class="flex-1 border-t-2" :class="selectedArea ? 'border-green' : 'border-gray-200'" />
        <!-- Step 2 -->
        <div class="flex items-center gap-1.5 xs:gap-2">
          <div
            class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors"
            :class="
              registrationSuccess
                ? 'bg-green text-white'
                : selectedArea
                  ? 'bg-green text-white'
                  : 'bg-gray-200 text-gray-400'
            "
          >
            <svg v-if="registrationSuccess" class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
            </svg>
            <span v-else>2</span>
          </div>
          <span
            class="hidden text-sm font-medium xs:inline"
            :class="registrationSuccess ? 'text-gray-400' : selectedArea ? 'text-gray-800' : 'text-gray-400'"
          >
            {{ $t("localteam.register.step.contact_details") }}
          </span>
        </div>
        <div class="flex-1 border-t-2" :class="registrationSuccess ? 'border-green' : 'border-gray-200'" />
        <!-- Step 3 -->
        <div class="flex items-center gap-1.5 xs:gap-2">
          <div
            class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors"
            :class="registrationSuccess ? 'bg-green text-white' : 'bg-gray-200 text-gray-400'"
          >
            <svg v-if="registrationSuccess" class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
            </svg>
            <span v-else>3</span>
          </div>
          <span
            class="hidden text-sm font-medium xs:inline"
            :class="registrationSuccess ? 'font-semibold text-green' : 'text-gray-400'"
          >
            {{ $t("localteam.register.step.get_started") }}
          </span>
        </div>
      </div>

      <!-- Step 1: No municipality selected yet → show search -->
      <div v-if="!selectedArea">
        <div class="rounded-sm bg-white p-4 shadow-list sm:p-8">
          <h2 class="mb-1 font-heading text-h2 font-bold text-green">{{ $t("localteam.register.select.title") }}</h2>
          <p class="text-gray-500 mb-5 text-sm">
            {{ $t("localteam.register.select.description") }}
          </p>
          <AdministrativeAreaSearchBar
            ref="searchBarRef"
            reasonable-munips-to-rate="include"
            :route-builder="handleAreaSelect"
          />
        </div>
      </div>

      <!-- Step 2: Municipality selected → mini-map + form or already-exists notice -->
      <div v-else class="space-y-6">
        <!-- Mini-map for geolocation validation -->
        <div class="overflow-hidden rounded-sm shadow-list">
          <div class="bg-gray-50 border-gray-200 flex items-center gap-2 border-b px-4 py-3">
            <svg class="h-4 w-4 flex-shrink-0 text-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <span class="text-gray-700 text-sm font-medium">
              {{ $t("localteam.register.selected_municipality") }}:
              <strong class="text-green">{{ selectedArea.name }}</strong>
              <span v-if="selectedArea.prefix" class="text-gray-500 font-normal"> ({{ selectedArea.prefix }})</span>
            </span>
          </div>

          <!-- Map -->
          <ClientOnly>
            <div v-if="areaGeoData" class="h-56">
              <AdministrativeAreaMap
                :geo-center="areaGeoData.geo_center"
                :geo-area="areaGeoData.geo_area"
                :administrative-area-name="selectedArea.name"
              />
            </div>
            <div v-else-if="geoLoading" class="bg-gray-100 flex h-56 items-center justify-center">
              <SlkFlowerSpinner :size="32" />
            </div>
            <div v-else class="bg-gray-100 flex h-24 items-center justify-center">
              <span class="text-gray-400 text-sm italic">{{ $t("map.not_available") }}</span>
            </div>
          </ClientOnly>

          <!-- Bottom bar: verify -->
          <div class="bg-gray-50 border-gray-200 text-gray-500 flex items-center gap-1.5 border-t px-4 py-3 text-sm">
            <svg class="h-4 w-4 flex-shrink-0 text-green" fill="currentColor" viewBox="0 0 20 20">
              <path
                fill-rule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clip-rule="evenodd"
              />
            </svg>
            {{ $t("localteam.register.verify_municipality") }}
          </div>
        </div>

        <!-- Already has a local team → contact prompt -->
        <!-- Case 1: Current backend catalog rating is published and complete -->
        <div v-if="ratingState === 'complete'" class="rounded-sm bg-white p-4 shadow-list sm:p-8">
          <div class="mb-5 flex items-start gap-3 sm:gap-4">
            <div class="bg-green-100 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full">
              <svg class="h-5 w-5 text-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <h2 class="text-gray-800 mb-1 font-heading text-h2 font-bold">{{ $t("rating.completed") }}</h2>
              <p class="text-gray-600 text-sm">
                <span
                  v-html="sanitizeHtml($t('localteam.register.completed.body', { ':name': selectedArea.name }))"
                ></span>
              </p>
            </div>
          </div>
          <div class="flex flex-col gap-3 sm:flex-row">
            <CanonicalButton
              v-if="existingSlug"
              :href="`/municipalities/${existingSlug}`"
              :label="$t('rating.view')"
              icon-slug="icon_login_arrow"
              color="green"
              class="flex-1"
            />
            <CanonicalButton
              :href="`/contact?title=${encodeURIComponent($t('localteam.support.contact_title', { ':name': selectedArea.name }))}&type=cooperation&content=${encodeURIComponent($t('localteam.support.contact_content', { ':name': selectedArea.name }))}`"
              :label="$t('generic.contact')"
              icon-slug="icon_login_arrow"
              color="blue"
              class="flex-1"
            />
          </div>
          <button
            v-if="!hasQueryParams"
            type="button"
            class="mt-4 block text-sm text-light-blue hover:underline"
            @click="resetSelection"
          >
            {{ $t("localteam.register.select_other_municipality") }}
          </button>
        </div>

        <!-- Case 2: Localteam exists and the current rating has been started -->
        <div v-else-if="ratingState === 'in-progress'" class="rounded-sm bg-white p-4 shadow-list sm:p-8">
          <div class="mb-5 flex items-start gap-3 sm:gap-4">
            <div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-yellow-100">
              <svg class="h-5 w-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <h2 class="text-gray-800 mb-1 font-heading text-h2 font-bold">
                {{ $t("localteam.active_rating_in_progress") }}
              </h2>
              <p class="text-gray-600 text-sm">
                <span
                  v-html="sanitizeHtml($t('localteam.register.in_progress.body', { ':name': selectedArea.name }))"
                ></span>
              </p>
            </div>
          </div>
          <div class="flex flex-col gap-3 sm:flex-row">
            <CanonicalButton
              :href="`/contact?title=${encodeURIComponent($t('localteam.contact_title', { ':name': selectedArea.name }))}&type=cooperation&content=${encodeURIComponent($t('localteam.contact_content', { ':name': selectedArea.name }))}`"
              :label="$t('generic.contact')"
              icon-slug="icon_login_arrow"
              color="blue"
              class="flex-1"
            />
          </div>
          <button
            v-if="!hasQueryParams"
            type="button"
            class="mt-4 block text-sm text-light-blue hover:underline"
            @click="resetSelection"
          >
            {{ $t("localteam.register.select_other_municipality") }}
          </button>
        </div>

        <!-- Case 3: Localteam exists, but the current rating has not been started -->
        <div v-else-if="ratingState === 'not-started'" class="rounded-sm bg-white p-4 shadow-list sm:p-8">
          <div class="mb-5 flex items-start gap-3 sm:gap-4">
            <div class="bg-gray-100 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full">
              <svg class="text-gray-600 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <h2 class="text-gray-800 mb-1 font-heading text-h2 font-bold">
                {{ $t("localteam.active_rating_not_started") }}
              </h2>
              <p class="text-gray-600 text-sm">
                <span
                  v-html="sanitizeHtml($t('localteam.register.not_started.body', { ':name': selectedArea.name }))"
                ></span>
              </p>
            </div>
          </div>
          <div class="flex flex-col gap-3 sm:flex-row">
            <CanonicalButton
              :href="`/contact?title=${encodeURIComponent($t('localteam.contact_title', { ':name': selectedArea.name }))}&type=cooperation&content=${encodeURIComponent($t('localteam.contact_content', { ':name': selectedArea.name }))}`"
              :label="$t('generic.contact')"
              icon-slug="icon_login_arrow"
              color="blue"
              class="flex-1"
            />
          </div>
          <button
            v-if="!hasQueryParams"
            type="button"
            class="mt-4 block text-sm text-light-blue hover:underline"
            @click="resetSelection"
          >
            {{ $t("localteam.register.select_other_municipality") }}
          </button>
        </div>

        <!-- Registration form -->
        <RegisterMunicipalityForm
          v-else
          :municipality-name="selectedArea.name"
          :ars="selectedArea.ars"
          :population="selectedArea.population ?? null"
          :state="selectedArea.state ?? null"
          :geolocation="areaGeoData?.geo_center ?? null"
          :can-change="!hasQueryParams"
          @change-municipality="resetSelection"
          @success="registrationSuccess = true"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { sanitizeHtml } from "~/utils/sanitizeHtml";
import { ref, computed, onMounted, watch } from "vue";

import { AreaSchema, type Area } from "~/shared/contracts/search";
import { parseGeoData } from "~/shared/contracts/geometry";
import type { AreaResult } from "~/types/components/navigation";
import { singleRouteValue } from "~/shared/routeValues";
const route = useRoute();
const { $stadtlandzahlAPI, $t } = useNuxtApp();

// --- Query-param pre-fill ---
const hasQueryParams = computed(() => !!route.query.ars);

// --- Selected area state ---
interface AreaInfo {
  name: string;
  ars: string;
  prefix?: string | undefined;
  population?: number | null | undefined;
  state?: string | null | undefined;
}

const registrationSuccess = ref(false);
const selectedArea = ref<AreaInfo | null>(null);
const existingSlug = ref<string | null>(null);
const existingPercentageRated = ref<number | null>(null);
const existingScorePublished = ref(false);
const hasExistingTeam = ref(false);
const areaGeoData = ref<{
  geo_center: import("geojson").Point | null;
  geo_area: import("geojson").GeoJsonObject | null;
} | null>(null);
const geoLoading = ref(false);

const ratingState = computed<"none" | "not-started" | "in-progress" | "complete">(() => {
  if (!hasExistingTeam.value) return "none";
  if (existingScorePublished.value && Number(existingPercentageRated.value) >= 100) return "complete";
  if (Number(existingPercentageRated.value ?? 0) > 0) return "in-progress";
  return "not-started";
});

const searchBarRef = ref<{ focus: () => void } | null>(null);

function handleAreaSelect(area: AreaResult): null {
  void selectArea(AreaSchema.parse(area));
  return null;
}

async function selectArea(area: Area) {
  selectedArea.value = {
    name: area.name,
    ars: area.ars,
    prefix: area.prefix ?? undefined,
    population: area.population ?? null,
    state: area.state ?? null,
  };
  // Collect slugs from the stadtlandzahl search result — these are Directus municipality slugs
  // associated to this ARS. We must still check whether each one has a localteam_id.
  const existingSlugs: string[] = (area.stadtlandklimaDataAll ?? []).flatMap((d) => (d.slug ? [d.slug] : []));
  const teamInfo = await checkExistingLocalteam(area.ars, existingSlugs);
  applyTeamInfo(teamInfo);
  await fetchGeoData(area.ars);
}

function resetSelection() {
  selectedArea.value = null;
  existingSlug.value = null;
  existingPercentageRated.value = null;
  existingScorePublished.value = false;
  hasExistingTeam.value = false;
  areaGeoData.value = null;
  void nextTick(() => searchBarRef.value?.focus());
}

async function checkExistingLocalteam(
  ars: string,
  _slugs: string[] = [],
): Promise<{ hasTeam: boolean; slug: string | null; percentageRated: number | null; published: boolean }> {
  try {
    // Use server route — $directus is only available during SSR, not on client
    const result = await $fetch("/api/register-check", {
      query: { ars },
    });
    return result as { hasTeam: boolean; slug: string | null; percentageRated: number | null; published: boolean };
  } catch {
    return { hasTeam: false, slug: null, percentageRated: null, published: false };
  }
}

function applyTeamInfo(teamInfo: {
  hasTeam: boolean;
  slug: string | null;
  percentageRated: number | null;
  published: boolean;
}) {
  existingSlug.value = teamInfo.slug;
  existingPercentageRated.value = teamInfo.percentageRated;
  existingScorePublished.value = teamInfo.published;
  hasExistingTeam.value = teamInfo.hasTeam;
}

async function fetchGeoData(ars: string) {
  if (!$stadtlandzahlAPI) return null;
  geoLoading.value = true;
  try {
    const data = await $stadtlandzahlAPI.fetchStatsByARS(ars);
    if (data?.geo_center || data?.geo_area) {
      areaGeoData.value = {
        geo_center: data.geo_center ? { type: "Point", coordinates: [data.geo_center.lon, data.geo_center.lat] } : null,
        geo_area: parseGeoData(data.geo_area),
      };
    }
    // Enrich selectedArea with state/population from the full API response.
    // The search GraphQL query doesn't include these fields, so we fill them here.
    if (selectedArea.value && data) {
      if (!selectedArea.value.state && data.state) {
        selectedArea.value = { ...selectedArea.value, state: data.state };
      }
      if (!selectedArea.value.population && data.data_products?.population_data?.population) {
        selectedArea.value = { ...selectedArea.value, population: data.data_products.population_data.population };
      }
    }
    return data;
  } catch {
    // geo data optional — form still works without it
    return null;
  } finally {
    geoLoading.value = false;
  }
}

// --- Initialise from ARS query param ---
async function initFromQueryParams(ars: string, name?: string) {
  // Reset state before loading new area
  selectedArea.value = { name: name ?? ars, ars };
  existingSlug.value = null;
  existingPercentageRated.value = null;
  existingScorePublished.value = false;
  hasExistingTeam.value = false;
  areaGeoData.value = null;

  // Resolve the ARS through StadtLandZahl first. Its catalog data provides the
  // authoritative municipality slug even for older Directus records without ARS.
  // URL-provided slugs are deliberately ignored because they can be stale or forged.
  const data = await fetchGeoData(ars);
  if (data?.name && selectedArea.value) {
    selectedArea.value = {
      ...selectedArea.value,
      name: data.name,
      ars: data.ars ?? ars,
      prefix: data.prefix ?? undefined,
    };
  }
  const trustedSlugs = (data?.stadtlandklima_data ?? []).flatMap((item) => (item.slug ? [item.slug] : []));
  const teamInfo = await checkExistingLocalteam(ars, trustedSlugs);
  applyTeamInfo(teamInfo);
}

onMounted(() => {
  const ars = singleRouteValue(route.query.ars);
  if (ars) void initFromQueryParams(ars, singleRouteValue(route.query.name));
});

watch(
  () => route.query.ars,
  (ars) => {
    if (singleRouteValue(ars)) {
      void initFromQueryParams(singleRouteValue(ars)!, singleRouteValue(route.query.name));
    } else {
      resetSelection();
    }
  },
);

// Meta
useHead({ title: $t("localteam.create") });
</script>

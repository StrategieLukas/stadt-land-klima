<template>
  <!-- Content when municipality data is available -->
  <div>
    <!-- Mobile: Single column layout -->
    <div class="block w-full flex-col justify-center lg:hidden">
      <div class="mb-8">
        <ItemRanking :municipality-score="municipalityScore" />
      </div>
      <div class="mb-4">
        <div role="tablist" class="slk-chart-tabs tabs tabs-box w-fit">
          <a
            role="tab"
            class="tab gap-1.5"
            :class="{ 'tab-active': activeTab === 'polar' }"
            @click="activeTab = 'polar'"
          >
            <svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="12,2 22,8.5 22,15.5 12,22 2,15.5 2,8.5" />
              <polygon points="12,6 18,9.5 18,14.5 12,18 6,14.5 6,9.5" />
              <line x1="12" y1="2" x2="12" y2="22" />
              <line x1="2" y1="8.5" x2="22" y2="8.5" />
              <line x1="2" y1="15.5" x2="22" y2="15.5" />
            </svg>
            {{ $t("municipality.chart.polar") }}
          </a>
          <a
            role="tab"
            class="tab gap-1.5"
            :class="{ 'tab-active': activeTab === 'treemap' }"
            @click="activeTab = 'treemap'"
          >
            <svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="2" width="9" height="20" rx="1" />
              <rect x="13" y="2" width="9" height="9" rx="1" />
              <rect x="13" y="13" width="9" height="9" rx="1" />
            </svg>
            {{ $t("generic.view.treemap") }}
          </a>
        </div>
        <div class="slk-chart-panel mt-4 rounded-box border-base-300 bg-base-100 p-6">
          <MunicipalityPolarChart
            v-if="activeTab === 'polar'"
            :sub-scores="subScores"
            :name-municipality="municipality.name"
          />
          <MunicipalityTreeMap
            v-if="activeTab === 'treemap'"
            :ratings-by-sector="ratingsBySector"
            :name-municipality="municipality.name"
          />
          <MunicipalityTreemapLegend v-if="activeTab === 'treemap'" />
          <p
            v-if="activeTab === 'treemap'"
            class="mx-auto mt-3 text-center text-xs text-gray-500 italic"
            style="max-width: 50vw"
          >
            {{ $t("municipality.chart.treemap.description") }}
          </p>
        </div>
      </div>
      <p class="mt-0 mb-4 text-center text-xs">
        <ClientOnly>
          {{ $t("municipalities.last_updated_at") + formatLastUpdated(municipality.date_updated ?? "", $locale) }}
        </ClientOnly>
      </p>

      <div class="mx-auto mb-8 flex justify-center">
        <ImplementationTrafficLight v-if="activeTab === 'polar'" />
      </div>

      <!-- Mobile: Infos zur Kommune -->
      <div class="mb-4">
        <DetailMunicipalityQuickInfoDesktop :municipality-score="municipalityScore" />
      </div>

      <!-- Mobile: Participate Section -->
      <div
        v-if="municipality.public_contact"
        class="collapse-plus collapse mb-4 rounded-xs p-2 px-0 shadow-list md:px-2"
      >
        <input type="checkbox" name="sectors-accordion" autocomplete="off" />
        <div class="collapse-title flex items-center gap-4 px-2 md:px-4">
          <img src="~/assets/icons/icon_team.svg" class="h-auto w-12 opacity-50 md:w-14 lg:w-18" />
          <h2 class="font-heading text-h2 leading-none text-green">
            {{ $t("municipality.participate_heading") }}
          </h2>
        </div>
        <div class="collapse-content px-2 md:px-4">
          <div class="has-long-links prose" v-html="sanitizeHtml(sanitizedPublicContact)"></div>
        </div>
      </div>

      <!-- Mobile: Statistics Section Link -->
      <NuxtLink
        :to="`/data/${municipality.ars}`"
        class="slk-municipality-cta slk-municipality-cta--stats mb-4 flex items-center gap-4 rounded-xs bg-blue-100 p-5 px-6 text-sm font-medium text-blue-600 shadow-list hover:bg-blue-200"
      >
        <img
          src="~/assets/icons/icon_evaluation_criteria.svg"
          alt=""
          class="slk-municipality-cta-icon slk-theme-icon--light h-auto w-12 opacity-50 md:w-14 lg:w-18"
        />
        <img
          src="~/assets/icons/icon_evaluation_criteria-dark.svg"
          alt=""
          class="slk-municipality-cta-icon slk-theme-icon--dark h-auto w-12 opacity-50 md:w-14 lg:w-18"
        />
        <h2 class="font-heading text-h2">{{ $t("stats.title") }} →</h2>
      </NuxtLink>

      <!-- Mobile: Kommunalwahl Question Generation Link -->
      <NuxtLink
        :to="`/elections/${municipality.slug}`"
        class="slk-municipality-cta slk-municipality-cta--elections flex items-center gap-3 rounded-xs bg-rating-3-light p-5 px-6 text-sm font-medium text-green shadow-list hover:bg-rating-3/50"
      >
        <img
          src="~/assets/icons/icon_politics.svg"
          alt=""
          class="slk-municipality-cta-icon slk-theme-icon--light h-auto w-12 opacity-50 md:w-14 lg:w-18"
        />
        <img
          src="~/assets/icons/icon_politics-dark.svg"
          alt=""
          class="slk-municipality-cta-icon slk-theme-icon--dark h-auto w-12 opacity-50 md:w-14 lg:w-18"
        />
        <h3 class="font-heading text-h2">
          {{
            $t("local_elections.title", {
              ":year": municipalElectionYear ?? "",
            })
          }}
          →
        </h3>
      </NuxtLink>

      <DetailMunicipalitySectorCards :municipality-score="municipalityScore" :ratings-by-sector="ratingsBySector" />

      <!-- Mobile: Associated Projects Link -->
      <NuxtLink
        v-if="municipalityProjects && municipalityProjects.length > 0"
        :to="{ path: '/projects', query: { municipality: municipality.name } }"
        class="mt-4 flex items-center gap-3 rounded-xs bg-very-light-blue p-5 px-6 text-sm font-medium text-stats-dark shadow-list hover:bg-blue-100"
      >
        <img src="~/assets/icons/icon_approved.svg" class="h-auto w-12 opacity-50 md:w-14 lg:w-18" />
        <h3 class="font-heading text-h2">
          {{ $t("projects.title") }}
          →
        </h3>
      </NuxtLink>
    </div>

    <!-- Desktop: Two column layout -->
    <div class="hidden w-full lg:grid lg:grid-cols-3 lg:gap-8">
      <!-- Left Column: Main content (2/3 width) -->
      <div class="lg:col-span-2">
        <div class="mb-8">
          <item-ranking :municipality-score="municipalityScore" />
        </div>
        <div class="mb-4">
          <div role="tablist" class="slk-chart-tabs tabs tabs-box w-fit">
            <a
              role="tab"
              class="tab gap-1.5"
              :class="{ 'tab-active': activeTab === 'polar' }"
              @click="activeTab = 'polar'"
            >
              <svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="12,2 22,8.5 22,15.5 12,22 2,15.5 2,8.5" />
                <polygon points="12,6 18,9.5 18,14.5 12,18 6,14.5 6,9.5" />
                <line x1="12" y1="2" x2="12" y2="22" />
                <line x1="2" y1="8.5" x2="22" y2="8.5" />
                <line x1="2" y1="15.5" x2="22" y2="15.5" />
              </svg>
              {{ $t("municipality.chart.polar") }}
            </a>
            <a
              role="tab"
              class="tab gap-1.5"
              :class="{ 'tab-active': activeTab === 'treemap' }"
              @click="activeTab = 'treemap'"
            >
              <svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="2" y="2" width="9" height="20" rx="1" />
                <rect x="13" y="2" width="9" height="9" rx="1" />
                <rect x="13" y="13" width="9" height="9" rx="1" />
              </svg>
              {{ $t("generic.view.treemap") }}
            </a>
          </div>
          <div class="slk-chart-panel mt-4 rounded-box border-base-300 bg-base-100 p-6">
            <MunicipalityPolarChart
              v-if="activeTab === 'polar'"
              :sub-scores="subScores"
              :name-municipality="municipality.name"
            />
            <MunicipalityTreeMap
              v-if="activeTab === 'treemap'"
              :ratings-by-sector="ratingsBySector"
              :name-municipality="municipality.name"
            />
            <MunicipalityTreemapLegend v-if="activeTab === 'treemap'" />
            <p
              v-if="activeTab === 'polar'"
              class="mx-auto mt-3 text-center text-xs text-gray-500 italic"
              style="max-width: 50vw"
            >
              {{ $t("municipality.chart.polar.description") }}
            </p>
            <p
              v-else-if="activeTab === 'treemap'"
              class="mx-auto mt-3 text-center text-xs text-gray-500 italic"
              style="max-width: 50vw"
            >
              {{ $t("municipality.chart.treemap.description") }}
            </p>
          </div>
        </div>
        <div class="mx-auto mb-8 flex justify-center">
          <implementation-traffic-light v-if="activeTab === 'polar'" />
        </div>

        <!-- Notice about current developments, if it exists -->
        <div
          v-if="municipality.overall_status_comment"
          class="collapse-plus collapse mb-4 rounded-xs p-2 px-0 shadow-list md:px-2"
        >
          <input type="checkbox" name="sectors-accordion" autocomplete="off" />
          <div class="collapse-title flex items-center gap-4 px-2 md:px-4">
            <img
              src="~/assets/icons/icon_info.svg"
              alt=""
              class="slk-sector-detail-icon slk-theme-icon--light h-auto w-12 opacity-50 md:w-14 lg:w-18"
            />
            <img
              src="~/assets/icons/icon_info-dark.svg"
              alt=""
              class="slk-sector-detail-icon slk-theme-icon--dark h-auto w-12 opacity-50 md:w-14 lg:w-18"
            />
            <h2 class="font-heading text-h2 leading-none text-green">
              {{ $t("municipality.overall_status_heading") }}
            </h2>
          </div>
          <div class="collapse-content px-2 md:px-4">
            <div class="has-long-links prose" v-html="sanitizeHtml(sanitizedOverallStatusComment)"></div>
          </div>
        </div>

        <DetailMunicipalitySectorCards :municipality-score="municipalityScore" :ratings-by-sector="ratingsBySector" />
      </div>

      <!-- Right Column: Info and Projects (1/3 width) -->
      <div class="pb-4 lg:col-span-1">
        <div class="sticky top-24 space-y-6">
          <!-- Municipality Quick Info -->
          <DetailMunicipalityQuickInfoDesktop :municipality-score="municipalityScore" />

          <!-- Statistics Section Link -->
          <NuxtLink
            :to="municipality.ars ? `/data/${municipality.ars}` : '/data'"
            class="slk-municipality-cta slk-municipality-cta--stats flex items-center gap-3 rounded-xs bg-blue-100 p-5 px-6 text-sm font-medium text-blue-600 shadow-list hover:bg-blue-200"
          >
            <img
              src="~/assets/icons/icon_evaluation_criteria.svg"
              alt=""
              class="slk-municipality-cta-icon slk-theme-icon--light h-6 w-6 opacity-60"
            />
            <img
              src="~/assets/icons/icon_evaluation_criteria-dark.svg"
              alt=""
              class="slk-municipality-cta-icon slk-theme-icon--dark h-6 w-6 opacity-60"
            />
            <h3 class="font-heading text-h3">{{ $t("stats.title") }} →</h3>
          </NuxtLink>

          <!-- Kommunalwahl Question Generation Link -->
          <NuxtLink
            :to="`/elections/${municipality.slug}`"
            class="slk-municipality-cta slk-municipality-cta--elections flex items-center gap-3 rounded-xs bg-rating-3-light p-5 px-6 text-sm font-medium text-green shadow-list hover:bg-rating-3/50"
          >
            <img
              src="~/assets/icons/icon_politics.svg"
              alt=""
              class="slk-municipality-cta-icon slk-theme-icon--light h-6 w-6 opacity-60"
            />
            <img
              src="~/assets/icons/icon_politics-dark.svg"
              alt=""
              class="slk-municipality-cta-icon slk-theme-icon--dark h-6 w-6 opacity-60"
            />
            <h3 class="font-heading text-h3">
              {{
                $t("local_elections.title", {
                  ":year": municipalElectionYear ?? "",
                })
              }}
              →
            </h3>
          </NuxtLink>

          <!-- Participate Section -->
          <div v-if="municipality?.public_contact" class="collapse-plus collapse rounded-xs p-2 shadow-list md:px-2">
            <input type="checkbox" name="contact-accordion" autocomplete="off" />
            <div class="collapse-title flex items-center gap-3 px-2 md:px-4">
              <img src="~/assets/icons/icon_team.svg" class="h-6 w-6 opacity-60" />
              <h3 class="font-heading text-h3 text-green">
                {{ $t("municipality.participate_heading") }}
              </h3>
            </div>
            <div class="collapse-content px-2 md:px-4">
              <div class="has-long-links prose prose-sm max-w-none" v-html="sanitizeHtml(sanitizedPublicContact)"></div>
            </div>
          </div>

          <!-- Associated Projects -->
          <div
            v-if="municipalityProjects && municipalityProjects.length > 0"
            class="collapse-plus collapse rounded-xs p-2 shadow-list md:px-2"
          >
            <div class="mb-4 flex items-center gap-3 p-3">
              <img
                src="~/assets/icons/icon_invest.svg"
                alt=""
                class="slk-sector-detail-icon slk-theme-icon--light h-6 w-6 opacity-60"
              />
              <img
                src="~/assets/icons/icon_invest-dark.svg"
                alt=""
                class="slk-sector-detail-icon slk-theme-icon--dark h-6 w-6 opacity-60"
              />
              <h3 class="font-heading text-h3 text-green">{{ $t("projects.title") }}</h3>
            </div>
            <div class="space-y-4">
              <ProjectCard
                v-for="project in municipalityProjects"
                :key="project.id"
                :slug="project.slug"
                :title="project.title"
                :municipality_name="project.municipality_name ?? undefined"
                :state="project.state ?? undefined"
                :abstract="project.abstract ?? undefined"
                :author="project.author ?? undefined"
                :date="project.date"
                :image_id="project.image_id ?? undefined"
                :image_is_raster="project.image_is_raster ?? undefined"
                :organisation="project.organisation"
              />
            </div>
          </div>

          <!-- Last Update Info -->
          <div v-if="municipality?.date_updated" class="rounded-xs p-2 shadow-list md:px-4">
            <div class="flex items-center gap-2 text-sm text-gray-600">
              <img
                src="~/assets/icons/icon_info.svg"
                alt=""
                class="slk-sector-detail-icon slk-theme-icon--light h-4 w-4 opacity-60"
              />
              <img
                src="~/assets/icons/icon_info-dark.svg"
                alt=""
                class="slk-sector-detail-icon slk-theme-icon--dark h-4 w-4 opacity-60"
              />
              <ClientOnly>
                <span>{{
                  $t("municipalities.last_updated_at") + formatLastUpdated(municipality.date_updated ?? "", $locale)
                }}</span>
              </ClientOnly>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { clientFailure } from "~/shared/securityLog";

import type { Project } from "~/types/components/content";
import type { MunicipalityScore, RatingsBySector } from "~/types/components/municipality";

import type { PropType } from "vue";

import { ref, onMounted, computed } from "vue";
import lodash from "lodash";
import MarkdownIt from "markdown-it";
import { sanitizeHtml } from "~/utils/sanitizeHtml";

import { isRaster, formatLastUpdated, getStateMunicipalElectionYear } from "~/shared/utils";
const fetchContent = useContentFetch();

const md = new MarkdownIt({
  html: false, // XSS safety
  linkify: true, // Linkify the text
  breaks: true,
});

const municipalElectionYear = computed(() => {
  return getStateMunicipalElectionYear(municipality?.state);
});

const _range = lodash.range.bind(lodash);
const { $t, $locale } = useNuxtApp();

const props = defineProps({
  municipalityScore: {
    type: Object as PropType<MunicipalityScore>,
    required: true,
  },
  ratingsBySector: {
    type: Object as PropType<RatingsBySector>,
    required: true,
  },
});

const municipalityScore = props.municipalityScore;
const municipality = municipalityScore.municipality;
const subScores = createSubScoreObject(municipalityScore);

const sanitizedPublicContact = computed(() => sanitizeHtml(md.render(municipality.public_contact ?? "")));
const sanitizedOverallStatusComment = computed(() =>
  sanitizeHtml(md.render(municipality.overall_status_comment ?? "")),
);

// Tab state
const activeTab = ref("polar");

// Fetch projects associated with this municipality
const municipalityProjects = ref<Project[]>([]);
const loadingProjects = ref(false);

// Defensive check for municipality data
const hasMunicipalityData = computed(() => {
  return municipality && typeof municipality === "object";
});

onMounted(async () => {
  // Fetch municipality projects
  if (hasMunicipalityData.value) {
    await fetchMunicipalityProjects();
  }
});

async function fetchMunicipalityProjects() {
  if (!municipality?.slug) return;

  loadingProjects.value = true;
  try {
    const { articles } = await fetchContent("/api/public/articles", {
      query: { municipality: municipality.name, limit: 5, sort: "-date_created" },
    });
    municipalityProjects.value = articles.map((article) => ({
      ...article,
      date: article.date_created,
      image_id: article.image?.id ?? null,
      image_is_raster: isRaster(article.image?.type),
      measures: article.measures?.flatMap((link) => (link.measures_id ? [link.measures_id] : [])) ?? [],
    }));
  } catch (err) {
    clientFailure("app.components.DetailMunicipality.fetchMunicipalityProjects.failed", err);
    municipalityProjects.value = [];
  } finally {
    loadingProjects.value = false;
  }
}

function createSubScoreObject(municipalityScore: MunicipalityScore) {
  const temp: Record<string, number> = {};
  for (const [key, value] of Object.entries(municipalityScore)) {
    if (key.includes("score")) {
      temp[key] = Number(value);
    }
  }
  return temp;
}
</script>

<style lang=""></style>

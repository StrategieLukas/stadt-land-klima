<template lang="">
  <!-- Content when municipality data is available -->
  <div>
    <!-- Mobile: Single column layout -->
    <div class="block lg:hidden w-full flex-col justify-center">
      <div class="mb-8">
        <item-ranking :municipality="municipality" />
      </div>
      <div class="mb-4">
        <municipality-polar-chart :sub-scores="subScores" :name-municipality="municipality.name" />
      </div>
      <p class="mb-4 mt-0 text-center text-xs">
        {{ $t("municipalities.last_updated_at") + safeFormatLastUpdated(municipality.date_updated, $locale) }}
      </p>
      <div class="mx-auto mb-8 flex justify-center">
        <implementation-traffic-light />
      </div>

      <!-- Mobile: About Section -->
      <div v-if="municipality.description" class="collapse-plus collapse rounded-sm p-2 px-0 shadow-list md:px-2 mb-4">
        <input type="checkbox" name="sectors-accordion" checked="checked" autocomplete="off" />
        <div class="collapse-title flex items-center gap-4 px-2 md:px-4">
          <img src="~/assets/icons/icon_location.svg" class="h-auto w-12 opacity-50 md:w-14 lg:w-18" />
          <h2 class="font-heading text-h2 leading-none text-green">
            {{ $t("municipality.about_heading", { ":name": municipality.name }) }}
          </h2>
        </div>
        <div class="collapse-content px-2 md:px-4">
          <div class="has-long-links prose" v-html="sanitizeHtml(linkifyStr(municipality.description))"></div>
        </div>
      </div>

      <!-- Mobile: Participate Section -->
      <div v-if="municipality.public_contact" class="collapse-plus collapse rounded-sm p-2 px-0 shadow-list md:px-2 mb-4">
        <input type="checkbox" name="sectors-accordion" autocomplete="off" />
        <div class="collapse-title flex items-center gap-4 px-2 md:px-4">
          <img src="~/assets/icons/icon_team.svg" class="h-auto w-12 opacity-50 md:w-14 lg:w-18" />
          <h2 class="font-heading text-h2 leading-none text-green">
            {{ $t("municipality.participate_heading") }}
          </h2>
        </div>
        <div class="collapse-content px-2 md:px-4">
          <div class="has-long-links prose" v-html="sanitizeHtml(linkifyStr(municipality.public_contact))"></div>
        </div>
      </div>

      <!-- Mobile: Measures -->
      <div
        v-for="(sectorRatings, sector) in sortedRatings"
        :key="sector"
        class="collapse-plus collapse rounded-sm p-2 px-0 shadow-list md:px-2 mb-4"
      >
        <input type="checkbox" name="sectors-accordion" autocomplete="off" />
        <div class="collapse-title flex items-start gap-4 px-2 md:px-4">
          <img :src="sectorImages[sector]" class="h-auto w-12 opacity-50 md:w-14 lg:w-18" />
          <div class="grow">
            <h2 class="mb-2 font-heading text-h2 leading-none text-green">
              {{ $t(`measure_sectors.${sector}.title`) }}
            </h2>
            <ProgressBar :score-total="Math.round(Number(municipality['score_' + sector]) * 10) / 10" layout="compact" />
          </div>
        </div>
        <div class="collapse-content px-2 md:px-4">
          <h3 class="mb-2 font-heading text-h2 text-black">
            {{ $t("measure_sector.measures_in_detail") }}
          </h3>
          <ul class="mb-2 flex items-end justify-center gap-4">
            <li v-for="(rating, _) in [0,1,2,3,null]" :key="`rating-image-${rating}`" class="flex flex-col items-center">
              <img :src="ratingIcons[rating]" class="h-auto w-5" />
              <div class="text-sm">{{ $t(rating === null ? 'measure_rating.not_applicable_caption' : `measure_rating.${rating}_caption`) }}</div>
            </li>
          </ul>
          <ul class="mb-8 divide-y-2 divide-slate-300">
            <li v-for="item in sectorRatings" :key="item.id">
              <div class="collapse-plus collapse rounded-none">
                <input type="checkbox" :name="`rating-${item.id}-accordion`" autocomplete="off"/>
                <div :class="[ratingColor[ratingIndex(item.rating)], ratingHeaderOpacity[ratingIndex(item.rating)], 'collapse-title flex items-center justify-stretch gap-3 p-3 px-2 pr-6 md:px-4']">
                  <div class="shrink-0">
                    <img :src="ratingIcons[ratingIndex(item.rating)]" class="my-auto h-auto w-5" />
                  </div>
                  <h3 class="font-heading text-h3 font-medium">
                    {{ item.measure.name }}
                  </h3>
                </div>
                <div :class="[ratingColor[ratingIndex(item.rating)], ratingTextOpacity[ratingIndex(item.rating)], 'collapse-content md:px-12 lg:px-12']">
                  <MeasureDetails :measure_rating="item" :municipality="municipality" />
                </div>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>

    <!-- Desktop: Two column layout -->
    <div class="hidden lg:grid lg:grid-cols-3 lg:gap-8 w-full">
      <!-- Left Column: Main content (2/3 width) -->
      <div class="lg:col-span-2">
        <div class="mb-8">
          <item-ranking :municipality="municipality" />
        </div>
        <div class="mb-4">
          <municipality-polar-chart :sub-scores="subScores" :name-municipality="municipality.name" />
        </div>
        <div class="mx-auto mb-8 flex justify-center">
          <implementation-traffic-light />
        </div>

        <!-- Notice about current developments, if it exists -->
        <div v-if="municipality.overall_status_comment" class="collapse-plus collapse rounded-sm p-2 px-0 shadow-list md:px-2 mb-4">
          <input type="checkbox" name="sectors-accordion" autocomplete="off" />
          <div class="collapse-title flex items-center gap-4 px-2 md:px-4">
            <img src="~/assets/icons/icon_info.svg" class="h-auto w-12 opacity-50 md:w-14 lg:w-18" />
            <h2 class="font-heading text-h2 leading-none text-green">
              {{ $t("municipality.overall_status_heading") }}
            </h2>
          </div>
          <div class="collapse-content px-2 md:px-4">
            <div class="has-long-links prose" v-html="sanitizeHtml(linkifyStr(municipality.overall_status_comment))"></div>
          </div>
        </div>

        <!-- Measures -->
        <div
          v-for="(sectorRatings, sector) in sortedRatings"
          :key="sector"
          class="collapse-plus collapse rounded-sm p-2 px-0 shadow-list md:px-2 mb-4"
        >
          <input type="checkbox" name="sectors-accordion" autocomplete="off" />
          <div class="collapse-title flex items-start gap-4 px-2 md:px-4">
            <img :src="sectorImages[sector]" class="h-auto w-12 opacity-50 md:w-14 lg:w-18" />
            <div class="grow">
              <h2 class="mb-2 font-heading text-h2 leading-none text-green">
                {{ $t(`measure_sectors.${sector}.title`) }}
              </h2>
              <ProgressBar :score-total="Math.round(Number(municipality['score_' + sector]) * 10) / 10" layout="compact" />
            </div>
          </div>
          <div class="collapse-content px-2 md:px-4">
            <h3 class="mb-2 font-heading text-h2 text-black">
              {{ $t("measure_sector.measures_in_detail") }}
            </h3>
            <ul class="mb-2 flex items-end justify-center gap-4">
              <li v-for="(rating, _) in [0,1,2,3,null]" :key="`rating-image-${rating}`" class="flex flex-col items-center">
                <img :src="ratingIcons[rating]" class="h-auto w-5" />
                <div class="text-sm">{{ $t(rating === null ? 'measure_rating.not_applicable_caption' : `measure_rating.${rating}_caption`) }}</div>
              </li>
            </ul>
            <ul class="mb-8 divide-y-2 divide-slate-300">
              <li v-for="item in sectorRatings" :key="item.id">
                <div class="collapse-plus collapse rounded-none">
                  <input type="checkbox" :name="`rating-${item.id}-accordion`" autocomplete="off"/>
                  <div :class="[ratingColor[ratingIndex(item.rating)], ratingHeaderOpacity[ratingIndex(item.rating)], 'collapse-title flex items-center justify-stretch gap-3 p-3 px-2 pr-6 md:px-4']">
                    <div class="shrink-0">
                      <img :src="ratingIcons[ratingIndex(item.rating)]" class="my-auto h-auto w-5" />
                    </div>
                    <h3 class="font-heading text-h3 font-medium">
                      {{ item.measure.name }}
                    </h3>
                  </div>
                  <div :class="[ratingColor[ratingIndex(item.rating)], ratingTextOpacity[ratingIndex(item.rating)], 'collapse-content md:px-12 lg:px-12']">
                    <MeasureDetails :measure_rating="item" :municipality="municipality" />
                  </div>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Right Column: Info and Projects (1/3 width) -->
      <div class="lg:col-span-1">
        <div class="sticky top-8 space-y-6">
          <!-- Municipality Quick Info -->
<!-- Municipality Quick Info -->
<div class="rounded-sm shadow-list">
  <!-- Header with collapse toggle -->
  <div class="collapse collapse-plus rounded-sm">
    <input
      v-if="municipality?.description"
      type="checkbox"
      name="municipality-description"
      autocomplete="off"
    />
    <div class="collapse-title flex items-center justify-between px-6 py-4">
      <div class="flex items-center gap-2">
        <img src="~/assets/icons/icon_location.svg" class="h-6 w-6 opacity-60" />
        <h3 class="font-heading text-h3 text-green">Infos zur Kommune</h3>
      </div>
    </div>

    <!-- Collapsible description only -->
    <div
      v-if="municipality?.description"
      class="collapse-content px-6 pb-4"
    >
      <div
        class="has-long-links prose prose-sm max-w-none"
        v-html="sanitizeHtml(linkifyStr(municipality.description))"
      ></div>
    </div>
  </div>

  <!-- Info grid (always visible, outside collapse) -->
  <div class="px-6 pb-6 space-y-3">
    <div
      v-if="municipality?.state && municipality.state !== 'Berlin' && municipality.state !== 'Hamburg'"
      class="flex items-center justify-between"
    >
      <div class="flex items-center gap-2">
        <img src="~/assets/icons/icon_location.svg" class="h-5 w-5 opacity-60" />
        <span class="text-sm text-gray-700">{{ $t("state") }}</span>
      </div>
      <span class="text-sm font-medium text-gray-900">{{ municipality.state }}</span>
    </div>

    <div v-if="municipality?.population" class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <img src="~/assets/icons/icon_team.svg" class="h-5 w-5 opacity-60" />
        <span class="text-sm text-gray-700">{{ $t("municipality.population") }}</span>
      </div>
      <span class="text-sm font-bold text-gray-900">{{ municipality.population.toLocaleString() }}</span>
    </div>

    <div v-if="municipality?.party_mayor" class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <img src="~/assets/icons/icon_politics.svg" class="h-5 w-5 opacity-60" />
        <span class="text-sm text-gray-700">{{ $t("municipality.mayor") }}</span>
      </div>
      <span v-if="municipality.party_mayor" class="text-sm font-bold text-gray-900">
        {{ municipality.mayor }} ({{ municipality.party_mayor }})
      </span>
      <span v-else class="text-sm font-bold text-gray-900">{{ municipality.party_mayor }}</span>
    </div>

    <div v-if="municipality?.municipality_type" class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <div v-if="municipality.municipality_type === 'big_city'" v-html="majorCityIcon" class="h-5 w-5 opacity-60"></div>
        <div v-else v-html="minorCityIcon" class="h-5 w-5 opacity-60"></div>
        <span class="text-sm text-gray-700">{{ $t("municipality.municipality_type") }}</span>
      </div>
      <span class="text-sm font-bold text-gray-900">
        {{ municipality.municipality_type === 'big_city'
          ? $t("municipality.municipality_type.major_city")
          : $t("municipality.municipality_type.minor_city") }}
      </span>
    </div>

    <div v-if="municipality?.score_total">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <img src="~/assets/icons/icon_evaluation_criteria.svg" class="h-5 w-5 opacity-60" />
          <span class="text-sm font-medium text-gray-700">{{ $t("municipality.overall_score") }}</span>
        </div>
        <span class="text-sm font-bold" :class="`text-${getScoreColor(municipality.score_total)}`">
          {{ Math.round(Number(municipality.score_total) * 10) / 10 }}%
        </span>
      </div>
    </div>
  </div>
</div>





          <!-- Participate Section -->
          <div v-if="municipality?.public_contact" class="collapse-plus collapse rounded-sm p-2 px-0 shadow-list md:px-2">
            <input type="checkbox" name="contact-accordion" autocomplete="off" />
            <div class="collapse-title flex items-center gap-3 px-2 md:px-4">
              <img src="~/assets/icons/icon_team.svg" class="h-6 w-6 opacity-60" />
              <h3 class="font-heading text-h3 text-green">
                {{ $t("municipality.participate_heading") }}
              </h3>
            </div>
            <div class="collapse-content px-2 md:px-4">
              <div class="has-long-links prose prose-sm max-w-none" v-html="sanitizeHtml(linkifyStr(municipality.public_contact))"></div>
            </div>
          </div>

          <!-- Associated Projects -->
          <div v-if="municipalityProjects && municipalityProjects.length > 0" class="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <div class="flex items-center gap-3 mb-4">
              <img src="~/assets/icons/icon_invest.svg" class="h-6 w-6 opacity-60" />
              <h3 class="font-heading text-h3 text-green">{{ $t("projects.title") }}</h3>
            </div>
            <div class="space-y-4">
              <ProjectCard 
                v-for="project in municipalityProjects" 
                :key="project.id"
                :slug="project.slug"
                :title="project.title"
                :municipality_name="project.municipality_name"
                :state="project.state"
                :abstract="project.abstract"
                :author="project.author"
                :date="new Date(project.date_created)"
                :image_id="project.image"
                :organisation="project.organisation"
              />
            </div>
          </div>

          <!-- Last Update Info -->
          <div v-if="municipality?.date_updated" class="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div class="flex items-center gap-2 text-sm text-gray-600">
              <img src="~/assets/icons/icon_info.svg" class="h-4 w-4 opacity-60" />
              <span>{{ $t("municipalities.last_updated_at") + safeFormatLastUpdated(municipality.date_updated, $locale) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import lodash from "lodash";
import sanitizeHtml from "sanitize-html";
import linkifyStr from "linkify-string";
import sectorImages from "../shared/sectorImages.js";
import ratingIcons, { ratingIndex } from "../shared/ratingIcons.js";
import { formatLastUpdated, getScoreColor } from "../shared/utils.js";
import { ratingColor, ratingTextOpacity, ratingHeaderOpacity } from "../shared/ratingColors.js";
import ProjectCard from "~/components/ProjectCard.vue";
import ProgressBar from "~/components/ProgressBar.vue";

const { range } = lodash;
const { $t, $locale, $directus, $readItems } = useNuxtApp();

// Dynamic SVG imports for city type icons
const majorCityIcon = ref('');
const minorCityIcon = ref('');

const props = defineProps({
  municipality: {
    type: Object,
    required: true,
  },
  sortedRatings: {
    type: Object,
    required: true,
  },
});

const municipality = props.municipality;
const subScores = createSubScoreObject(municipality);

// Safe date formatting function
const safeFormatLastUpdated = (dateString, locale) => {
  try {
    if (!dateString) return 'Unbekannt';
    return formatLastUpdated(dateString, locale);
  } catch (error) {
    console.warn('Failed to format date:', error);
    return 'Unbekannt';
  }
};

// Fetch projects associated with this municipality
const municipalityProjects = ref([]);
const loadingProjects = ref(false);

// Defensive check for municipality data
const hasMunicipalityData = computed(() => {
  return municipality && typeof municipality === 'object';
});

onMounted(async () => {
  // Load SVG icons
  try {
    majorCityIcon.value = (await import('~/assets/images/major-city-dark.svg?raw')).default;
    minorCityIcon.value = (await import('~/assets/images/minor-city-dark.svg?raw')).default;
  } catch (error) {
    console.warn('Failed to load SVG icons:', error);
  }
  
  // Fetch municipality projects
  if (hasMunicipalityData.value) {
    await fetchMunicipalityProjects();
  }
});

async function fetchMunicipalityProjects() {
  if (!municipality?.slug) return;
  
  loadingProjects.value = true;
  try {
    const articles = await $directus.request(
      $readItems("articles", {
        fields: [
          "id",
          "slug",
          "title",
          "image",
          "abstract",
          "author",
          "date_created",
          "municipality_name",
          "state",
          "organisation"
        ],
        filter: {
          municipality_name: { _eq: municipality.name }
        },
        sort: "-date_created",
        limit: 5, // Limit to 5 most recent projects
      })
    );

    // Get organisation details if articles have organisations
    const orgIds = [...new Set(
      articles
        .map(article => {
          const org = article.organisation;
          if (org == null) return null;
          return typeof org === 'object' ? org.key : org;
        })
        .filter(id => id != null)
    )];

    let organisations = [];
    if (orgIds.length > 0) {
      organisations = await $directus.request(
        $readItems("organisations", {
          fields: ["id", "name", "logo", "link"],
          filter: { id: { _in: orgIds } }
        })
      );
    }

    const orgMap = new Map(organisations.map(org => [org.id, org]));

    municipalityProjects.value = articles.map(article => {
      const orgRaw = article.organisation;
      if (orgRaw == null) return { ...article, organisation: null };
      const orgId = typeof orgRaw === 'object' ? orgRaw.key : orgRaw;
      return {
        ...article,
        organisation: orgMap.get(orgId) || null
      };
    });
  } catch (err) {
    console.error("❌ Failed to fetch municipality projects:", err);
    municipalityProjects.value = [];
  } finally {
    loadingProjects.value = false;
  }
}

function createSubScoreObject(municipality) {
  const temp = {};
  for (const [key, value] of Object.entries(municipality)) {
    if (key.includes("score")) {
      temp[key] = Number(value);
    }
  }
  return temp;
}

</script>

<style lang=""></style>

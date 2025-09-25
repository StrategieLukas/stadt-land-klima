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
        {{ $t("municipalities.last_updated_at") + formatLastUpdated(municipality.date_updated, $locale) }}
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
          <div class="has-long-links prose" v-html="sanitizeHtml(saneLinkifyStr(municipality.description))"></div>
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
          <div class="has-long-links prose" v-html="sanitizeHtml(saneLinkifyStr(municipality.public_contact))"></div>
        </div>
      </div>

      <DetailMunicipalitySectorCards :municipality="municipality" :sortedRatings="sortedRatings"/>
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
            <div class="has-long-links prose" v-html="sanitizeHtml(saneLinkifyStr(municipality.overall_status_comment))"></div>
          </div>
        </div>

        <DetailMunicipalitySectorCards :municipality="municipality" :sortedRatings="sortedRatings"/>
      </div>

      <!-- Right Column: Info and Projects (1/3 width) -->
      <div class="lg:col-span-1 pb-4">
        <div class="sticky top-8 space-y-6">

          <!-- Municipality Photo -->
          <div v-if="municipality.photo" class="p-2 rounded-sm shadow-list">
            <SmartImg
              :assetId="municipality.photo"
              :alt="municipality.name"
              fit="cover"
              sizes="(max-width: 768px) 312px, 400px" 
              format="webp" 
              img-class="object-cover w-full h-full"
            />
            <div v-if="municipality.photo_attribution" class="px-4 py-2 text-sm text-gray-600">
              {{ municipality.photo_attribution }}
            </div>
          </div>

          <!-- Municipality Quick Info -->
          <DetailMunicipalityQuickInfoDesktop :municipality="municipality"/>

          <!-- Participate Section -->
          <div v-if="municipality?.public_contact" class="collapse-plus collapse rounded-sm p-2 shadow-list md:px-2">
            <input type="checkbox" name="contact-accordion" autocomplete="off" />
            <div class="collapse-title flex items-center gap-3 px-2 md:px-4">
              <img src="~/assets/icons/icon_team.svg" class="h-6 w-6 opacity-60" />
              <h3 class="font-heading text-h3 text-green">
                {{ $t("municipality.participate_heading") }}
              </h3>
            </div>
            <div class="collapse-content px-2 md:px-4">
              <div class="has-long-links prose prose-sm max-w-none" v-html="sanitizeHtml(saneLinkifyStr(municipality.public_contact))"></div>
            </div>
          </div>

          <!-- Associated Projects -->
          <div v-if="municipalityProjects && municipalityProjects.length > 0" class="collapse-plus collapse rounded-sm p-2 shadow-list md:px-2">
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
          <div v-if="municipality?.date_updated" class="rounded-sm p-2 shadow-list md:px-4">
            <div class="flex items-center gap-2 text-sm text-gray-600">
              <img src="~/assets/icons/icon_info.svg" class="h-4 w-4 opacity-60" />
              <span>{{ $t("municipalities.last_updated_at") + formatLastUpdated(municipality.date_updated, $locale) }}</span>
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
import { formatLastUpdated, saneLinkifyStr } from "../shared/utils.js";
import ProjectCard from "~/components/ProjectCard.vue";
import ProgressBar from "~/components/ProgressBar.vue";
import DetailMunicipalitySectorCards from "~/components/DetailMunicipalitySectorCards.vue"
import DetailMunicipalityQuickInfoDesktop from "~/components/DetailMunicipalityQuickInfoDesktop.vue"

const { range } = lodash;
const { $t, $locale, $directus, $readItems } = useNuxtApp();

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

// Fetch projects associated with this municipality
const municipalityProjects = ref([]);
const loadingProjects = ref(false);

// Defensive check for municipality data
const hasMunicipalityData = computed(() => {
  return municipality && typeof municipality === 'object';
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

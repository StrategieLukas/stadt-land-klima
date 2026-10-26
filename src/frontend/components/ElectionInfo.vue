<template>
  <div class="mx-auto max-w-4xl px-4 py-8">
    <!-- Header -->
    <div class="mb-8 rounded-2xl border border-solid-gray-10 bg-white p-8 shadow-list">
      <h1 class="mb-4 text-h2 font-bold text-stats-dark">
        {{ $t("election_info.title_for", { ":name": municipalityScore.municipality.name }) }}
      </h1>
      <p class="mb-4 text-lg text-mid-gray">
        {{ $t("election_info.intro_prefix") }}
        <span class="font-semibold text-stats-dark">{{ $t("election_info.improvement_potential") }}</span>
        {{ $t("election_info.intro_suffix") }}
      </p>
      <p class="mb-2 text-mid-gray">
        {{ $t("election_info.method") }}
      </p>
      <p class="text-mid-gray">
        {{ $t("election_info.usage_hint") }}
      </p>

      <div v-if="usingFallbackCatalog" class="mt-6 alert alert-warning">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-5 w-5 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.167 1.732-3l-5.48-6.76c-.54-.676-1.598-.676-2.138 0l-5.48 6.76c-.77 1.833.262 3 1.732 3z"
          />
        </svg>
        <span>{{
          $t("election_info.fallback_catalog", {
            ":old": municipalityScore.catalog_version.name,
            ":current": currentCatalogVersion.name,
          })
        }}</span>
      </div>

      <div class="mt-6 flex justify-center">
        <button
          class="btn rounded-lg px-6 py-3 font-semibold text-white transition-transform btn-primary hover:scale-105"
          @click="fetchPDF()"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="mr-2 inline h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          {{ $t("generic.generate_pdf") }}
        </button>
      </div>
    </div>

    <!-- Measures List -->
    <div class="space-y-6">
      <div
        v-for="(measure, index) in sortedMeasures.slice(0, 10)"
        :key="measure.measure_id"
        class="rounded-xl border border-solid-gray-10 bg-white p-6 shadow-list transition-shadow hover:shadow-xl"
      >
        <!-- Measure Header -->
        <div class="mb-4 flex items-start justify-between">
          <div class="flex-1">
            <h3 class="flex items-center gap-3 text-xl font-bold text-stats-dark">
              <span
                class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-stats-dark text-sm font-bold text-white"
              >
                {{ index + 1 }}
              </span>
              {{ measure.name }}
              <span class="ml-2 text-sm font-normal text-mid-gray">({{ measure.measure_id }})</span>
            </h3>
          </div>
        </div>

        <!-- Measure Content -->
        <div class="space-y-4">
          <!-- Benefit Description -->
          <div
            v-if="measure.description_benefit"
            class="prose max-w-none text-mid-gray"
            v-html="sanitizeHtml(md.render(measure.description_benefit))"
          ></div>

          <!-- Current Progress -->
          <div v-if="measure.currentProgress" class="rounded-lg border border-solid-gray-10 bg-mild-white p-4">
            <p class="mb-1 font-semibold text-stats-dark">{{ $t("election_info.current_status") }}</p>
            <p class="text-mid-gray">{{ measure.currentProgress }}</p>
          </div>

          <!-- Political Demand -->
          <div v-if="measure.politicalDemand" class="rounded-lg border border-solid-gray-10 bg-mild-white p-4">
            <p class="mb-1 font-semibold text-stats-dark">{{ $t("election_info.political_demand") }}</p>
            <p class="text-mid-gray">{{ measure.politicalDemand }}</p>
          </div>

          <!-- Contribution Description -->
          <div
            v-if="measure.description_contribution"
            class="rounded-lg border border-solid-ff-green-20 bg-solid-ff-green-05 p-4"
          >
            <p class="mb-1 font-semibold text-ff-green">{{ $t("election_info.contribution") }}</p>
            <div
              class="prose max-w-none text-mid-gray"
              v-html="sanitizeHtml(md.render(measure.description_contribution))"
            ></div>
          </div>
        </div>

        <!-- Link to Municipality -->
        <div class="mt-4 flex justify-end border-t border-solid-gray-10 pt-4">
          <NuxtLink
            :to="`/municipalities/${municipalityScore.municipality.slug}?v=${municipalityScore.catalog_version.name}#measure-${measure.measure_id}`"
            class="btn gap-2 btn-outline text-stats-dark btn-secondary btn-sm hover:bg-solid-light-green-10"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
            {{ $t("election_info.to_rating") }}
          </NuxtLink>
        </div>
      </div>
    </div>

    <!-- Bottom PDF Button -->
    <div class="mt-8 flex justify-center py-4">
      <button
        class="btn rounded-lg px-6 py-3 font-semibold text-white transition-transform btn-primary hover:scale-105"
        @click="fetchPDF()"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="mr-2 inline h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        {{ $t("generic.generate_pdf") }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { clientFailure } from "~/shared/securityLog";

import type { NumericValue } from "~/shared/domain";

import type { PropType } from "vue";
import type { MunicipalityScore, MeasureRating } from "~/types/components/municipality";
import type { Catalog } from "~/shared/contracts/search";

import MarkdownIt from "markdown-it";
import { sanitizeHtml } from "~/utils/sanitizeHtml";
import measureCurrentProgressStrings from "~/assets/measure-current-progress-strings.json";
import measurePoliticalDemandStrings from "~/assets/measure-political-demand-strings.json";

const { $t } = useNuxtApp();
const md = new MarkdownIt();

const props = defineProps({
  municipalityScore: {
    type: Object as PropType<MunicipalityScore>,
    required: true,
  },
  ratingsMeasures: {
    type: Object as PropType<MeasureRating[]>,
    required: true,
  },
  usingFallbackCatalog: {
    type: Boolean as PropType<boolean | undefined>,
    default: false,
  },
  currentCatalogVersion: {
    type: Object as PropType<Catalog>,
    required: true,
  },
});

const sortedMeasures = props.ratingsMeasures
  .filter((item) => item.applicable === true && item.rating !== null)
  .map((item) => {
    const rating = parseFloat(String(item.rating)) || 0;
    const weight = Number(item.measure?.weight) || 0;
    const feasibilityPolitical = parseFloat(String(item.measure?.feasibility_political)) || 0;
    const feasibilityEconomical = parseFloat(String(item.measure?.feasibility_economical)) || 0;

    const potential = (1 - rating) * weight;
    const difficulty = (feasibilityPolitical + feasibilityEconomical) / 2;

    return {
      measure_id: item.measure?.measure_id || "",
      name: item.measure?.name || "",
      sector: item.measure?.sector || "",
      potential,
      weight,
      rating: item.rating,
      impact: item.measure?.impact ?? null,
      feasibility_political: feasibilityPolitical,
      feasibility_economical: feasibilityEconomical,
      difficulty: difficulty,
      description_benefit: item.measure?.description_benefit,
      description_contribution: item.measure?.description_contribution,
      currentProgress: fetchCurrentProgressString(item.measure?.measure_id, item.rating),
      politicalDemand: fetchPoliticalDemandString(item.measure?.measure_id, item.rating),
    };
  })
  // Filter out measures that have no corresponding text (i.e. old BETA measures that have been removed)
  .filter((item) => item.currentProgress && item.politicalDemand)
  .sort((a, b) => {
    // Sort by potential descending
    if (b.potential !== a.potential) return b.potential - a.potential;

    // Tiebreaker: difficulty ascending
    if (a.difficulty !== b.difficulty) return a.difficulty - b.difficulty;

    // Final tiebreaker: measure_id alphabetically
    return a.measure_id.localeCompare(b.measure_id);
  });

function fetchCurrentProgressString(measureId: string, rating: NumericValue) {
  // Fetch base String from map
  const rawString =
    (measureCurrentProgressStrings as Record<string, Record<string, string>>)[measureId]?.[String(rating)] || "";

  // Replace dynamic labels with their values
  return rawString.replaceAll("[MUNICIPALITY]", props.municipalityScore.municipality.name);
}

function fetchPoliticalDemandString(measureId: string, rating: NumericValue) {
  // Fetch base String from map
  const rawString =
    (measurePoliticalDemandStrings as Record<string, Record<string, string>>)[measureId]?.[String(rating)] || "";

  // Replace dynamic labels with their values
  return rawString.replaceAll("[MUNICIPALITY]", props.municipalityScore.municipality.name);
}

const municipality = props.municipalityScore.municipality;

async function fetchPDF() {
  try {
    const response = await $fetch<Blob>("/api/election-pdf", {
      responseType: "blob",
      method: "POST",
      body: {
        municipalitySlug: municipality.slug,
        catalogVersion: props.municipalityScore.catalog_version.name,
        measures: sortedMeasures.slice(0, 10),
      },
    });

    const blob = new Blob([response], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  } catch (err) {
    clientFailure("app.components.ElectionInfo.fetchPDF.failed", err);
  }
}
</script>

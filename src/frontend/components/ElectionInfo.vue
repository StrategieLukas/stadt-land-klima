<template>
  <div class="elections-flow mx-auto max-w-4xl py-8 text-(--slk-text)">
    <!-- Header -->
    <header class="mb-8">
      <h1 class="mb-4 font-heading text-4xl font-black text-stats-dark sm:text-6xl">
        {{ $t("election_info.title_for", { ":name": municipalityScore.municipality.name }) }}
      </h1>
      <p class="mb-4 max-w-3xl text-lg leading-relaxed text-gray">
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

      <div class="mt-6 flex">
        <PdfExportForm
          action="/api/election-pdf"
          :request="{
            municipalitySlug: municipality.slug,
            catalogVersion: props.municipalityScore.catalog_version.name,
            measures: sortedMeasures.slice(0, 10),
          }"
        >
          <CanonicalButton
            type="submit"
            :label="$t('generic.generate_pdf')"
            icon-slug="mdi:file-pdf-box"
            color="dark"
          />
        </PdfExportForm>
      </div>
    </header>

    <!-- Measures List -->
    <div class="space-y-6">
      <div
        v-for="(measure, index) in sortedMeasures.slice(0, 10)"
        :key="measure.measure_id"
        class="border border-(--slk-border) bg-(--slk-surface) p-4 sm:p-6"
      >
        <!-- Measure Header -->
        <div class="mb-4 flex items-start justify-between">
          <div class="flex-1">
            <h2 class="flex flex-wrap items-center gap-3 text-xl font-bold text-(--slk-text-strong)">
              <span
                class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-stats-dark text-sm font-bold text-white"
              >
                {{ index + 1 }}
              </span>
              {{ measure.name }}
              <span class="ml-2 text-sm font-normal text-mid-gray">({{ measure.measure_id }})</span>
            </h2>
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
          <div v-if="measure.currentProgress" class="border-t border-(--slk-border) pt-4">
            <p class="mb-1 font-semibold text-stats-dark">{{ $t("election_info.current_status") }}</p>
            <p class="text-mid-gray">{{ measure.currentProgress }}</p>
          </div>

          <!-- Political Demand -->
          <div v-if="measure.politicalDemand" class="border-t border-(--slk-border) pt-4">
            <p class="mb-1 font-semibold text-stats-dark">{{ $t("election_info.political_demand") }}</p>
            <p class="text-mid-gray">{{ measure.politicalDemand }}</p>
          </div>

          <!-- Contribution Description -->
          <div v-if="measure.description_contribution" class="border-t border-(--slk-border) pt-4">
            <p class="mb-1 font-semibold text-(--slk-text-strong)">{{ $t("election_info.contribution") }}</p>
            <div
              class="prose max-w-none text-mid-gray"
              v-html="sanitizeHtml(md.render(measure.description_contribution))"
            ></div>
          </div>
        </div>

        <!-- Link to Municipality -->
        <div class="mt-4 flex justify-end border-t border-solid-gray-10 pt-4">
          <CanonicalButton
            :href="`/municipalities/${municipalityScore.municipality.slug}?v=${encodeURIComponent(municipalityScore.catalog_version.name)}#measure-${measure.measure_id}`"
            :label="$t('election_info.to_rating')"
            icon-slug="mdi:arrow-right"
            color="dark"
          />
        </div>
      </div>
    </div>

    <!-- Bottom PDF Button -->
    <div class="mt-8 flex justify-center py-4">
      <PdfExportForm
        action="/api/election-pdf"
        :request="{
          municipalitySlug: municipality.slug,
          catalogVersion: props.municipalityScore.catalog_version.name,
          measures: sortedMeasures.slice(0, 10),
        }"
      >
        <CanonicalButton type="submit" :label="$t('generic.generate_pdf')" icon-slug="mdi:file-pdf-box" color="dark" />
      </PdfExportForm>
    </div>
  </div>
</template>

<script setup lang="ts">
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
</script>

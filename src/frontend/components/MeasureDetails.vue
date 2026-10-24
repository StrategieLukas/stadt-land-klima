<template>
  <!-- Invisible div just to carry the ref needed for the observer -->
  <div ref="measureDetailsSection"></div>

  <StaticMeasureDetails :measure="measure_rating.measure" />

  <div v-if="measure_rating.applicable" class="mb-4 border-gray-300">
    <div v-if="measure_rating.current_progress" class="mb-4 border-t-4 p-4">
      <h3 class="mb-3 text-h3 font-bold text-black">
        {{ $t("ratings_measure.achievement_heading") }}
      </h3>

      <div
        class="has-long-links prose whitespace-pre-line"
        v-html="sanitizeHtml(saneLinkifyStr(measure_rating.current_progress))"
      />
    </div>
    <div v-if="measure_rating.source" class="mb-4 border-t-4 p-4">
      <h3 class="mb-3 text-h3 font-bold text-black">
        {{ $t("ratings_measure.source_heading") }}
      </h3>

      <div
        class="has-long-links prose whitespace-pre-line"
        v-html="sanitizeHtml(saneLinkifyStr(measure_rating.source))"
      />
    </div>
    <dl v-if="measure_rating.date_updated" class="mt-2 flex flex-row gap-2 px-4 text-sm">
      <dt class="font-bold">{{ $t("ratings_measure.last_updated") }}:</dt>
      <ClientOnly>
        <dd>{{ formatLastUpdated(measure_rating.date_updated, $locale) }}</dd>
      </ClientOnly>
    </dl>
  </div>

  <div v-if="!measure_rating.applicable" class="mb-4 border-t-4 border-gray-300 p-4">
    <div v-if="measure_rating.why_not_applicable">
      <h3 class="mb-3 text-h3 font-bold text-black">
        {{ $t("ratings_measure.why_not_applicable_heading") }}
      </h3>

      <div
        class="has-long-links prose whitespace-pre-line"
        v-html="sanitizeHtml(saneLinkifyStr(measure_rating.why_not_applicable))"
      />
    </div>
  </div>

  <div class="mb-4 border-t-4 border-gray-300 p-4">
    <NuxtLink
      :to="`/measures/${measure_rating.measure.slug}?v=${municipalityScore.catalog_version.name}`"
      class="text-black underline"
      target="measure"
    >
      {{ $t("municipality_rating.link_to_measure") }} ({{ measure_rating.measure.measure_id }})↗
    </NuxtLink>
    <NuxtLink
      :to="`/contact?title=${encodeURIComponent(measure_rating.measure.measure_id + ': ' + measure_rating.measure.name)}&type=suggestion&content=${encodeURIComponent('Maßnahme: ' + measure_rating.measure.measure_id + '\nKommune: ' + municipality.name + '\nLink: /municipalities/' + municipality.slug + '?v=' + municipalityScore.catalog_version.name + '#measure-' + measure_rating.measure.measure_id + '\n\nMein Hinweis:\n')}`"
      class="ml-4 text-black underline"
      target="feedback"
    >
      <div class="mt-2 flex flex-row gap-2">
        <img
          src="~/assets/icons/icon_hint.svg"
          alt=""
          class="slk-sector-detail-icon slk-theme-icon--light h-auto w-5 opacity-50"
        />
        <img
          src="~/assets/icons/icon_hint-dark.svg"
          alt=""
          class="slk-sector-detail-icon slk-theme-icon--dark h-auto w-5 opacity-50"
        />
        {{ $t("feedback.link.feedback_on_rating") }} ↗
      </div>
    </NuxtLink>
  </div>

  <!-- Examples of other Municipalities, that have implemented this measure better (if not best rating) -->
  <div v-if="Number(measure_rating.rating) < 1" class="mt-4 border-t-4 border-gray-300 p-4">
    <h3 class="mb-3 text-h3 font-bold text-black">{{ $t("measure_rating.better_examples.title") }}:</h3>

    <p v-if="loadingExamples">{{ $t("generic.loading") }}</p>

    <ul v-else-if="similarExamples.length > 0" class="mt-4 space-y-2">
      <li v-for="example in similarExamples" :key="example.municipality.id" class="flex items-center space-x-2">
        <img :src="ratingIcons[ratingIndex(example.rating) ?? 'null']" alt="rating icon" class="h-4 w-4" />
        <NuxtLink
          :href="`/municipalities/${example.municipality.slug}?v=${municipalityScore.catalog_version.name}#measure-${measure_rating.measure.measure_id}`"
          class="text-black underline"
          target="_blank"
        >
          {{ example.municipality.name }} ↗
        </NuxtLink>
      </li>
    </ul>

    <p v-else class="text-sm text-gray-500 italic">{{ $t("measure_rating.better_examples.not_found") }}.</p>
  </div>
</template>
<script setup lang="ts">
import type { Municipality, MeasureRating, MunicipalityScore } from "~/types/components/municipality";
import { parseGeoCenter } from "~/shared/contracts/geometry";
import type { NumericValue } from "~/shared/domain";

import type { PropType } from "vue";

import { defineProps, onMounted, onBeforeUnmount, ref } from "vue";
import { formatLastUpdated, saneLinkifyStr } from "~/shared/utils";
import { sanitizeHtml } from "~/utils/sanitizeHtml";
import { calculateAndAddSimilarityScores } from "~/shared/compareMunicipalities";
import { isMunicipalityScoreComplete } from "~/shared/municipality-score-publishing";
import ratingIcons, { ratingIndex } from "~/shared/ratingIcons";
type SimilarExample = {
  rating: string | number | null;
  municipality: Omit<Municipality, "geolocation"> & { lat: number | null; lon: number | null };
  similarityScore: number;
};

const { $t, $locale } = useNuxtApp();
const props = defineProps({
  measure_rating: {
    type: Object as PropType<MeasureRating>,
    required: true,
  },
  municipalityScore: {
    type: Object as PropType<MunicipalityScore>,
    required: true,
  },
});

const municipality = props.municipalityScore.municipality;
const measureDetailsSection = ref<HTMLElement | null>(null);
const hasFetched = ref(false);
let observer: IntersectionObserver | null = null;

// Register an observer that triggers the fetch for the similar municipalities when this MeasureDetails-object is expanded/uncollapsed
// However, if this MeasureDetails has a perfect rating, skip all this (no need to provide better examples when already at max rating)
onMounted(async () => {
  await nextTick();

  if (!measureDetailsSection.value || Number(props.measure_rating.rating) >= 1) return;

  observer = new IntersectionObserver(
    (entries) => {
      const entry = entries[0];
      if (entry?.isIntersecting && !hasFetched.value) {
        hasFetched.value = true;
        void fetchSimilarExamples(props.measure_rating.measure.id, props.measure_rating.rating);
        observer?.disconnect();
      }
    },
    {
      threshold: 0.01,
    },
  );

  observer.observe(measureDetailsSection.value);
});

onBeforeUnmount(() => {
  if (observer) observer?.disconnect();
});

// Load the similar municipalities when the element comes into view
// But only once and cache the result in case user collapses/uncollapses the content again
const similarExamples = ref<SimilarExample[]>([]);
const loadingExamples = ref(false);

async function fetchSimilarExamples(measureId: string, currentRating: NumericValue) {
  console.log("Fetching similar examples...");
  loadingExamples.value = true;

  // Step 1: Check if we are the highest rating and then return immediately
  const higherRatings = getHigherRatings(currentRating);
  if (higherRatings.length === 0) {
    loadingExamples.value = false;
    return [];
  }

  // Step 2: Fetch better ratings
  const { ratings: rawRatingResultsBeforeFilter } = await $fetch("/api/public/measure-ratings", {
    query: { measureId },
  });

  // Client-side filter: published score for this catalog version.
  // this is a workaround because adding the filters with _some does not work for some reason...
  const rawRatingResults = (rawRatingResultsBeforeFilter ?? [])
    .filter((row) => higherRatings.includes(String(row.rating)))
    .filter((row) => {
      const scores = row?.localteam_id?.municipality_id?.[0]?.scores ?? [];
      return scores.some((s) => {
        const cv = s.catalog_version;
        return cv === props.municipalityScore.catalog_version.id && isMunicipalityScoreComplete(s);
      });
    });

  // Step 3: Transform better ratings to have the hierarchy we expect
  const betterMunicipalities = rawRatingResults.flatMap((r) => {
    const m = r.localteam_id?.municipality_id?.[0];
    if (!m) return [];

    const { geolocation, ...rest } = m; // drop geolocation
    return [
      {
        rating: r.rating,
        municipality: {
          ...rest,
          lat: geolocation?.coordinates[1] ?? null,
          lon: geolocation?.coordinates[0] ?? null,
        },
      },
    ];
  });

  // Step 4: Calculate similarity to current municipality
  const betterMunicipalitiesWithSimiliarityScore = calculateAndAddSimilarityScores(
    {
      ...props.municipalityScore.municipality,
      geolocation: parseGeoCenter(props.municipalityScore.municipality.geolocation),
    },
    betterMunicipalities,
  );

  // Step 5: Sort by "best rating for this measure", and then for highest similarity among those.
  const finalSorted = betterMunicipalitiesWithSimiliarityScore
    .sort((a, b) => {
      const r1 = parseFloat(String(a.rating ?? 0));
      const r2 = parseFloat(String(b.rating ?? 0));
      if (r2 !== r1) return r2 - r1;
      return (b.similarityScore ?? 0) - (a.similarityScore ?? 0);
    })
    .slice(0, 5);

  loadingExamples.value = false;
  similarExamples.value = finalSorted;
  return finalSorted;
}

// Tragically, rating is a string and not a number, so can't filter with a "gt_"-clause :(
function getHigherRatings(currentRating: NumericValue) {
  const knownRatings = [0, 0.25, 0.5, 0.75, 1]; // ordered list
  const current = Number(currentRating);

  return knownRatings.filter((r) => r > current).map(String); // convert back to string
}
</script>

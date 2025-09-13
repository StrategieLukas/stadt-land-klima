<template>
  <div class="py-4" ref="measureDetailsSection">

    <h3 class="mb-3 text-h3 font-bold text-black">
      {{ t("measure.description_about_heading") }}
    </h3>

    <div v-if="measure_rating.measure.translations[0].description_about" class="mb-2 flex flex-row measure_ratings-start gap-4">
      <figure class="mt-0 flex shrink-0 flex-col">
        <img src="~/assets/icons/icon_info.svg" alt="" class="h-auto w-10 opacity-50" />
      </figure>
      <div class="has-long-links prose" v-html="sanitizeHtml(measure_rating.measure.translations[0].description_about)" />
    </div>
  </div>

  <div v-if="measure_rating.measure.translations[0].description_evaluation_criteria" class="py-4">
    <h3 class="mb-3 text-h3 font-bold text-black">
      {{ t("measure.evaluation_criteria_heading") }}
    </h3>

    <div class="mb-2 flex flex-row measure_ratings-start gap-4">
      <figure class="mt-0 flex shrink-0 flex-col">
        <img src="~/assets/icons/icon_evaluation_criteria.svg" alt="" class="h-auto w-10 opacity-50" />
      </figure>

      <div class="has-long-links prose" v-html="measure_rating.measure.translations[0].description_evaluation_criteria" />
    </div>
  </div>

  <div class="py-4">
    <h3 class="mb-3 text-h3 font-bold text-black">
      {{ t("measure.feasibility_heading") }}
    </h3>

    <div class="grid max-w-md grid-cols-3 justify-between gap-4">
      <FeasibilityBarChart
        key="impact"
        class="xs:mr-auto"
        icon="/assets/icons/icon_impact.svg"
        :label="t('measure.impact_label')"
        :value="Number(measure_rating.measure.impact)"
      />

      <FeasibilityBarChart
        key="politics"
        class="xs:mx-auto"
        icon="/assets/icons/icon_politics.svg"
        :label="t('measure.feasibility_political_label')"
        :value="Number(measure_rating.measure.feasibility_political)"
      />

      <FeasibilityBarChart
        key="invest"
        class="xs:ml-auto"
        icon="/assets/icons/icon_invest.svg"
        :label="t('measure.feasibility_economical_label')"
        :value="Number(measure_rating.measure.feasibility_economical)"
      />
    </div>
  </div>

  <div v-if="measure_rating.applicable">
    <div v-if="measure_rating.current_progress" class="mb-4">
      <h4 class="mb-2 font-bold text-black">
        {{ t("ratings_measure.achievement_heading") }}
      </h4>

      <div class="has-long-links prose whitespace-pre-line" v-html="saneLinkifyStr(measure_rating.current_progress)" />
    </div>
    <div v-if="measure_rating.source">
      <h4 class="mb-2 font-bold text-black">
        {{ t("ratings_measure.source_heading") }}
      </h4>

      <div class="has-long-links prose whitespace-pre-line" v-html="saneLinkifyStr(measure_rating.source)" />
    </div>
    <dl v-if="measure_rating.date_updated" class="mt-2 flex flex-row gap-2 text-sm">
      <dt class="font-bold">{{ t("ratings_measure.last_updated") }}:</dt>
      <dd>{{ formatLastUpdated(measure_rating.date_updated, locale) }}</dd>
    </dl>
  </div>

  <div v-if="!measure_rating.applicable">
    <div v-if="measure_rating.why_not_applicable">
      <h4 class="mb-2 font-bold text-black">
        {{ t("ratings_measure.why_not_applicable_heading") }}
      </h4>

      <div class="has-long-links prose whitespace-pre-line" v-html="saneLinkifyStr(measure_rating.why_not_applicable)" />
    </div>
  </div>

  <div class="mt-8">
    <NuxtLink
      :to="`/measures/sectors/${measure_rating.measure.sector}#measure-${measure_rating.measure.slug}`"
      class="text-black underline"
      target="measure"
    >
      {{ t("municipality_rating.link_to_measure") }} ↗
    </NuxtLink>
  </div>

  <!-- Examples of other Municipalities, that have implemented this measure better (if not best rating) -->
  <div v-if="measure_rating.rating < 1" class="mt-4">
    <h3 class="mb-3 text-h3 font-bold text-black">
      {{ t("measure_rating.better_examples.title") }}:
    </h3>

    <p v-if="loadingExamples">{{ t("loading") }}...</p>

    <ul v-else-if="similarExamples.length > 0" class="space-y-2 mt-4">
      <li
        v-for="example in similarExamples"
        :key="example.municipality.id"
        class="flex items-center space-x-2"
      >
        <img
          :src="ratingIcons[ratingIndex(example.rating)]"
          alt="rating icon"
          class="w-4 h-4"
        />
        <NuxtLink
          v-if="municipality"
          :to="`/municipalities/${example.municipality.slug}`"
          class="text-black underline"
        >
          {{ example.municipality.translations[0].name }} ↗
        </NuxtLink>
      </li>
    </ul>

    <p v-else class="text-sm text-gray-500 italic">{{ t("measure_rating.better_examples.not_found") }}.</p>
  </div>


</template>
<script setup>
  import { defineProps } from "vue";
  import sanitizeHtml from "sanitize-html";
  import { formatLastUpdated, saneLinkifyStr } from "../shared/utils.js";
  import { calculateAndAddSimilarityScores } from "../shared/compareMunicipalities.js";
  import ratingIcons, { ratingIndex } from "../shared/ratingIcons.js";
  import { onMounted, onBeforeUnmount, ref } from "vue";

  const { $directus, $readItems } = useNuxtApp();
  const { t } = useI18n();
  const props = defineProps({
    measure_rating: {
      type: Object,
      required: true,
    },
    municipality: {
      type: Object,
      required: false,
    },
  });


  const measureDetailsSection = ref(null);
  const hasFetched = ref(false);
  let observer = null;

  // Register an observer that triggers the fetch for the similar municipalities when this MeasureDetails-object is expanded/uncollapsed
  // However, if this MeasureDetails has a perfect rating, skip all this (no need to provide better examples when already at max rating)
  onMounted(async () => {
    await nextTick();

    if (!measureDetailsSection.value || props.measure_rating.rating >= 1) return;

    observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && !hasFetched.value) {
          hasFetched.value = true;
          fetchSimilarExamples(props.measure_rating.measure.id, props.measure_rating.rating);
          observer.disconnect();
        }
      },
      {
        threshold: 0.01,
      }
    );

    observer.observe(measureDetailsSection.value);
  });

  onBeforeUnmount(() => {
    if (observer) observer.disconnect();
  });


  // Load the similar municipalities when the element comes into view
  // But only once and cache the result in case user collapses/uncollapses the content again
  const similarExamples = ref([])
  const loadingExamples = ref(false)

  async function fetchSimilarExamples(measureId, currentRating) {
    loadingExamples.value = true;

    // Step 1: Check if we are the highest rating and then return immediately
    const higherRatings = getHigherRatings(currentRating);
    if (higherRatings.length === 0) {
      loadingExamples.value = false;
      return [];
    }

    // Step 2: Fetch better ratings
    const rawRatingResults = await $directus.request(
      $readItems('ratings_measures', {
        filter: {
          measure_id: { _eq: measureId },
          status: { _eq: 'published' },
          rating: { _in: higherRatings },
        },
        fields: ['rating', { localteam_id: ["municipality_name", { municipality_id: ['id', 'name', 'slug', 'state', 'party_mayor', 'population', 'geolocation']}]}],
        limit: -1,
      })
    );

    // Step 3: Transform better ratings to have the hierarchy we expect
    const betterMunicipalities = rawRatingResults.map(r => {
      const m = r.localteam_id.municipality_id[0];

      const { geolocation, ...rest } = m; // drop geolocation
      return {
        rating: r.rating,
        municipality: {
          ...rest,
          lat: geolocation ? geolocation.coordinates[1] : null,
          lon: geolocation ? geolocation.coordinates[0] : null
        }
      };
    });


    // Step 4: Calculate similarity to current municipality
    const betterMunicipalitiesWithSimiliarityScore = calculateAndAddSimilarityScores(props.municipality, betterMunicipalities);

    // Step 5: Sort by "best rating for this measure", and then for highest similarity among those.
    const finalSorted = betterMunicipalitiesWithSimiliarityScore
      .sort((a, b) => {
        const r1 = parseFloat(a.rating ?? 0);
        const r2 = parseFloat(b.rating ?? 0);
        if (r2 !== r1) return r2 - r1;
        return (b.similarityScore ?? 0) - (a.similarityScore ?? 0);
      })
      .slice(0, 5);

    loadingExamples.value = false;
    similarExamples.value = finalSorted;
    return finalSorted;
  }



  // Tragically, rating is a string and not a number, so can't filter with a "gt_"-clause :(
  function getHigherRatings(currentRating) {
    const knownRatings = [0, 0.3333, 0.6666, 1]; // ordered list
    const current = Number(currentRating);

    return knownRatings.filter(r => r > current).map(String); // convert back to string
  }


</script>

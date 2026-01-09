<template>
  <!-- Invisible div just to carry the ref needed for the observer -->
  <div ref="measureDetailsSection"></div>

  <StaticMeasureDetails :measure="measure_rating.measure" />

  <div v-if="measure_rating.applicable" class="border-gray-300 mb-4">
    <div v-if="measure_rating.current_progress" class="p-4 border-t-4 mb-4">
      <h3 class="mb-3 text-h3 font-bold text-black">
        {{ $t("ratings_measure.achievement_heading") }}
      </h3>

      <div class="has-long-links prose whitespace-pre-line" v-html="saneLinkifyStr(measure_rating.current_progress)" />
    </div>
    <div v-if="measure_rating.source" class="p-4 border-t-4 mb-4">
      <h3 class="mb-3 text-h3 font-bold text-black">
        {{ $t("ratings_measure.source_heading") }}
      </h3>

      <div class="has-long-links prose whitespace-pre-line" v-html="saneLinkifyStr(measure_rating.source)" />
    </div>
    <dl v-if="measure_rating.date_updated" class="px-4 mt-2 flex flex-row gap-2 text-sm">
      <dt class="font-bold">{{ $t("ratings_measure.last_updated") }}:</dt>
      <ClientOnly>
        <dd>{{ formatLastUpdated(measure_rating.date_updated, $locale) }}</dd>
      </ClientOnly>
    </dl>
  </div>

  <div v-if="!measure_rating.applicable" class="border-t-4 border-gray-300 p-4 mb-4">
    <div v-if="measure_rating.why_not_applicable">
      <h3 class="mb-3 text-h3 font-bold text-black">
        {{ $t("ratings_measure.why_not_applicable_heading") }}
      </h3>

      <div class="has-long-links prose whitespace-pre-line" v-html="saneLinkifyStr(measure_rating.why_not_applicable)" />
    </div>
  </div>

  <div class="border-t-4 border-gray-300 p-4 mb-4">
    <NuxtLink
      :to="`/measures/sectors/${measure_rating.measure.sector}?v=${municipalityScore.catalog_version.name}#${measure_rating.measure.measure_id}`"
      class="text-black underline"
      target="measure"
    >
      {{ $t("municipality_rating.link_to_measure") }} ({{ measure_rating.measure.measure_id }})↗
    </NuxtLink>
    <NuxtLink
      :to="`/feedback`"
      class="ml-4 text-black underline"
      target="feedback"
    >
    <div class="mt-2 flex flex-row gap-2">
      <img src="~/assets/icons/icon_hint.svg" alt="" class="h-auto w-5 opacity-50" />
      {{ $t("feedback.link.feedback_on_rating") }} ↗
      </div>
    </NuxtLink>
  </div>

  <!-- Examples of other Municipalities, that have implemented this measure better (if not best rating) -->
  <div v-if="measure_rating.rating < 1" class="mt-4 border-t-4 border-gray-300 p-4">
    <h3 class="mb-3 text-h3 font-bold text-black">
      {{ $t("measure_rating.better_examples.title") }}:
    </h3>

    <p v-if="loadingExamples">{{ $t("loading") }}...</p>

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
<script setup>
  import sanitizeHtml from "sanitize-html";
  import { defineProps } from "vue";
  import { formatLastUpdated, saneLinkifyStr } from "~/shared/utils.js";
  import { calculateAndAddSimilarityScores } from "~/shared/compareMunicipalities.js";
  import ratingIcons, { ratingIndex } from "~/shared/ratingIcons.js";
  import { onMounted, onBeforeUnmount, ref } from "vue";

  const { $t, $directus, $readItems, $locale } = useNuxtApp();
  const props = defineProps({
    measure_rating: {
      type: Object,
      required: true,
    },
    municipalityScore: {
      type: Object,
      required: true,
    },
  });

  const municipality = props.municipalityScore.municipality;
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
    console.log("Fetching similar examples...");
    loadingExamples.value = true;

    // Step 1: Check if we are the highest rating and then return immediately
    const higherRatings = getHigherRatings(currentRating);
    if (higherRatings.length === 0) {
      loadingExamples.value = false;
      return [];
    }


    // Step 2: Fetch better ratings
    const rawRatingResultsBeforeFilter = await $directus.request(
      $readItems('ratings_measures', {
        filter: {
          // Using the uuid of the measure here, so only returns results for that measure and not from the same "Measure-ID" (as in EN_2).
          // This ensure that we only look for better examples in the same catalog version
          measure_id: { _eq: measureId },
          status: { _eq: 'published' },
          rating: { _in: higherRatings },
          localteam_id: {
            municipality_id: {
              status: { _eq: 'published' },
            }
          }
        },
        fields: ['rating', { localteam_id: ["municipality_name", { municipality_id: ['id', 'name', 'slug', 'state', 'party_mayor', 'population', 'geolocation', { scores: ['catalog_version', 'percentage_rated']}]}]}],
        limit: -1,
      })
    );

    // client-side filter: percentage_rated == 100 for this catalog version
    // this is a workaround because adding the filters with _some does not work for some reason...
    const rawRatingResults = (rawRatingResultsBeforeFilter ?? []).filter((row) => {
      const scores = row?.localteam_id?.municipality_id?.[0]?.scores ?? [];
      return scores.some((s) => {
        const cv = typeof s.catalog_version === 'object' ? s.catalog_version?.id : s.catalog_version;
        const pr = typeof s.percentage_rated === 'string' ? parseFloat(s.percentage_rated) : s.percentage_rated;
        return cv === props.municipalityScore.catalog_version.id && Number(pr) > 98;
      });
    });

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
    const betterMunicipalitiesWithSimiliarityScore = calculateAndAddSimilarityScores(props.municipalityScore.municipality, betterMunicipalities);

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
    const knownRatings = [0, 0.25, 0.5, 0.75, 1]; // ordered list
    const current = Number(currentRating);

    return knownRatings.filter(r => r > current).map(String); // convert back to string
  }


</script>

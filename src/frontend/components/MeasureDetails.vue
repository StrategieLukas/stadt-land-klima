<template>
  <div class="py-4" ref="measureDetailsSection">

    <h3 class="mb-3 text-h3 font-heading text-light-blue">
      {{ $t("measure.description_about_heading") }}
    </h3>

    <div v-if="measure_rating.measure.description_about" class="mb-2 flex flex-row measure_ratings-start gap-4">
      <figure class="mt-0 flex shrink-0 flex-col">
        <img src="~/assets/icons/icon_info.svg" alt="" class="h-auto w-10 opacity-50" />
      </figure>
      <div class="has-long-links prose" v-html="sanitizeHtml(measure_rating.measure.description_about)" />
    </div>
  </div>

  <div v-if="measure_rating.measure.description_evaluation_criteria" class="py-4">
    <h3 class="mb-3 text-h3 font-heading text-light-blue">
      {{ $t("measure.evaluation_criteria_heading") }}
    </h3>

    <div class="mb-2 flex flex-row measure_ratings-start gap-4">
      <figure class="mt-0 flex shrink-0 flex-col">
        <img src="~/assets/icons/icon_evaluation_criteria.svg" alt="" class="h-auto w-10 opacity-50" />
      </figure>

      <div class="has-long-links prose" v-html="measure_rating.measure.description_evaluation_criteria" />
    </div>
  </div>

  <div class="py-4">
    <h3 class="mb-3 text-h3 font-heading text-light-blue">
      {{ $t("measure.feasibility_heading") }}
    </h3>

    <div class="grid max-w-md grid-cols-3 justify-between gap-4">
      <FeasibilityBarChart
        key="impact"
        class="xs:mr-auto"
        icon="/assets/icons/icon_impact.svg"
        :label="$t('measure.impact_label')"
        :value="Number(measure_rating.measure.impact)"
      />

      <FeasibilityBarChart
        key="politics"
        class="xs:mx-auto"
        icon="/assets/icons/icon_politics.svg"
        :label="$t('measure.feasibility_political_label')"
        :value="Number(measure_rating.measure.feasibility_political)"
      />

      <FeasibilityBarChart
        key="invest"
        class="xs:ml-auto"
        icon="/assets/icons/icon_invest.svg"
        :label="$t('measure.feasibility_economical_label')"
        :value="Number(measure_rating.measure.feasibility_economical)"
      />
    </div>
  </div>

  <div v-if="measure_rating.applicable">
    <div v-if="measure_rating.current_progress" class="mb-4">
      <h4 class="mb-2 text-light-blue">
        {{ $t("ratings_measure.achievement_heading") }}
      </h4>

      <div class="has-long-links prose whitespace-pre-line" v-html="linkifyStr(measure_rating.current_progress)" />
    </div>
    <div v-if="measure_rating.source">
      <h4 class="mb-2 text-light-blue">
        {{ $t("ratings_measure.source_heading") }}
      </h4>

      <div class="has-long-links prose whitespace-pre-line" v-html="linkifyStr(measure_rating.source)" />
    </div>
    <dl v-if="measure_rating.date_updated" class="mt-2 flex flex-row gap-2 text-sm">
      <dt class="font-bold">{{ $t("ratings_measure.last_updated") }}:</dt>
      <dd>{{ formatLastUpdated(measure_rating.date_updated, $locale) }}</dd>
    </dl>
  </div>

  <div v-if="!measure_rating.applicable">
    <div v-if="measure_rating.why_not_applicable">
      <h4 class="mb-2 text-light-blue">
        {{ $t("ratings_measure.why_not_applicable_heading") }}
      </h4>

      <div class="has-long-links prose whitespace-pre-line" v-html="linkifyStr(measure_rating.why_not_applicable)" />
    </div>
  </div>

  <div class="mt-8">
    <NuxtLink
      :to="`/measures/sectors/${measure_rating.measure.sector}#measure-${measure_rating.measure.slug}`"
      class="text-light-blue underline"
      target="measure"
    >
      {{ $t("municipality_rating.link_to_measure") }} ↗
    </NuxtLink>
  </div>

  <!-- Examples of other Municipalities, that have implemented this measure better (if not best rating) -->
  <div>
    <p>hahahah</p>
    <p v-if="measure_rating.rating < 1">
      Kommunen, die diese Maßnahme besser umgesetzt haben:
    </p>

    <ul v-if="similarExamples.length > 0">
      <li v-for="example in similarExamples" :key="example.localteam.municipality.id">
        <NuxtLink :to="`/municipalities/${example.localteam.municipality.slug}`" class="text-light-blue underline">
          {{ example.localteam.municipality.name }}
        </NuxtLink>
      </li>
    </ul>

    <p v-if="loadingExamples">{{ $t("loading") }}...</p>
  </div>


</template>
<script setup>
import { defineProps } from "vue";
import sanitizeHtml from "sanitize-html";
import linkifyStr from "linkify-string";
import { formatLastUpdated } from "../shared/utils.js";
import { onMounted, onBeforeUnmount, ref } from "vue";

const { $t, $directus, $readItems, $locale } = useNuxtApp();
const props = defineProps({
  measure_rating: {
    type: Object,
    required: true,
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
      threshold: 0.1,
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
  console.log("Fetching examples!");
  loadingExamples.value = true
  const result = await $directus.request(
    $readItems('ratings_measures', {
      filter: {
        measure_id: { _eq: measureId },
        status: { _eq: 'published' },
          rating: {
          _in: getHigherRatings(currentRating),
        }
      },
      fields: [
        'rating',
        'localteam.municipality.id',
        'localteam.municipality.name',
        'localteam.municipality.slug',
        'localteam.municipality.state',
        'localteam.municipality.party_mayor',
        'localteam.municipality.population',
        // 'localteam.municipality.lat',
        // 'localteam.municipality.lng',
      ],
      limit: -1
    })
  )
  console.log(result);
  similarExamples.value = result
  loadingExamples.value = false
}

// Tragically, rating is a string and not a number, so can't filter with a "gt_"-clause :(
function getHigherRatings(currentRating) {
  const knownRatings = [0, 0.3333, 0.6666, 1]; // ordered list
  const current = Number(currentRating);

  return knownRatings.filter(r => r > current).map(String); // convert back to string
}


</script>

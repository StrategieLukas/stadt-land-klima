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
      <li v-for="example in similarExamples" :key="example.id">
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
  import { sortBySimilarity } from "../shared/compareMunicipalities.js";
  import { onMounted, onBeforeUnmount, ref } from "vue";

  const { $t, $directus, $readItems, $locale } = useNuxtApp();
  const props = defineProps({
    measure_rating: {
      type: Object,
      required: true,
    },
    municipality: {
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

    // Step 1: get ratings with localteam_id
    const higherRatings = getHigherRatings(currentRating);
    if (higherRatings.length === 0) {
      loadingExamples.value = false;
      return [];
    }

    const ratingsResult = await $directus.request(
      $readItems('ratings_measures', {
        filter: {
          measure_id: { _eq: measureId },
          status: { _eq: 'published' },
          rating: { _in: higherRatings },
        },
        fields: ['rating', 'localteam_id'],
        limit: -1,
      })
    );

    const localteamIds = [...new Set(ratingsResult.map(r => r.localteam_id).filter(Boolean))];
    if (localteamIds.length === 0) {
      loadingExamples.value = false;
      return [];
    }

    // Step 2: get localteams with municipality_id
    const localteamsResult = await $directus.request(
      $readItems('localteams', {
        filter: { id: { _in: localteamIds } },
        fields: ['id', 'municipality_id'],
        limit: -1,
      })
    );

    const municipalityIds = [...new Set(localteamsResult.map(lt => lt.municipality_id).filter(Boolean))];
    if (municipalityIds.length === 0) {
      loadingExamples.value = false;
      return [];
    }

    // Step 3: get municipalities details
    const municipalitiesResult = await $directus.request(
      $readItems('municipalities', {
        filter: { id: { _in: municipalityIds } },
        fields: ['id', 'name', 'slug', 'state', 'party_mayor', 'population'],
        limit: -1,
      })
    );

    // Step 4: Build full list of slugs (including props.municipality)
    const allSlugs = [
      props.municipality.slug,
      ...municipalitiesResult.map(m => m.slug)
    ];
    const uniqueSlugs = [...new Set(allSlugs)];

    const latLonResults = await magicApi(uniqueSlugs);

    // Step 6: Add lat/lon to reference municipality
    const refCoords = latLonResults.find(c => c.slug === props.municipality.slug) || { lat: null, lon: null };
    const referenceMunicipality = {
      ...props.municipality,
      lat: refCoords.lat,
      lon: refCoords.lon,
    };

    // Step 7: Merge lat/lon into other municipalities
    const municipalitiesWithCoords = municipalitiesResult.map(m => {
      const coord = latLonResults.find(c => c.slug === m.slug) || { lat: null, lon: null };
      return {
        ...m,
        lat: coord.lat,
        lon: coord.lon,
      };
    });


    // Step 8: Build maps to map the ratings to the right municipality from our earlier calls

    // a. Map localteam_id => rating
    const localteamIdToRating = {};
    for (const r of ratingsResult) {
      if (r.localteam_id && r.rating !== undefined) {
        localteamIdToRating[r.localteam_id] = r.rating;
      }
    }
    console.log("localteamIdToRating", localteamIdToRating);

    // b. Map localteam_id => municipality_id (from array)
    const localteamIdToMunicipalityId = {};
    for (const lt of localteamsResult) {
      console.log("lt", lt);
      const ltId = lt.id;
      const mId = Array.isArray(lt.municipality_id) ? lt.municipality_id[0] : lt.municipality_id;
      if (ltId && mId) {
        localteamIdToMunicipalityId[ltId] = mId;
      }
    }
    console.log("localteamIdToMunicipalityId", localteamIdToMunicipalityId);

    // c. Map municipality_id => rating by joining above maps
    const municipalityIdToRating = {};
    for (const [ltId, rating] of Object.entries(localteamIdToRating)) {
      const mId = localteamIdToMunicipalityId[ltId];
      if (mId && rating !== undefined) {
        municipalityIdToRating[mId] = rating;
      }
    }
    console.log("municipalityIdToRating", municipalityIdToRating);

    // d. Merge rating into municipalities
    const municipalitiesWithCoordsAndRating = municipalitiesWithCoords.map(m => ({
      ...m,
      rating: municipalityIdToRating[m.id] ?? null
    }));


    // Step 9: Sort by similarity
    loadingExamples.value = false;
    const a = sortBySimilarity(referenceMunicipality, municipalitiesWithCoordsAndRating);
    console.log("similar", a);
    similarExamples.value = a;
    return a;
  }

  // Tragically, rating is a string and not a number, so can't filter with a "gt_"-clause :(
  function getHigherRatings(currentRating) {
    const knownRatings = [0, 0.3333, 0.6666, 1]; // ordered list
    const current = Number(currentRating);

    return knownRatings.filter(r => r > current).map(String); // convert back to string
  }


  // TODO CRITICAL replace magicApi with actual API
  async function magicApi(slugs) {
    // Simulate async API call
    return new Promise((resolve) => {
      const results = slugs.map(slug => ({
        slug,
        ...randomLatLon()
      }));
      setTimeout(() => resolve(results), 100); // simulate latency
    });
  }
  function randomLatLon() {
    // Germany roughly: lat 47-55, lon 5-15
    const lat = 47 + Math.random() * (55 - 47);
    const lon = 5 + Math.random() * (15 - 5);
    return { lat, lon };
  }

</script>

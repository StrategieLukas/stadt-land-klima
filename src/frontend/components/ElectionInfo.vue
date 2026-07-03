<template>
  <div class="max-w-4xl mx-auto px-4 py-8">
    <!-- Header -->
    <div class="bg-white rounded-2xl shadow-list border border-solid-gray-10 p-8 mb-8">
      <h1 class="text-h2 font-bold text-stats-dark mb-4">
        {{ $t('election_info.title_for', { ':name': municipalityScore.municipality.name }) }}
      </h1>
      <p class="text-lg text-mid-gray mb-4">
        {{ $t('election_info.intro_prefix') }}
        <span class="font-semibold text-stats-dark">{{ $t('election_info.improvement_potential') }}</span>
        {{ $t('election_info.intro_suffix') }}
      </p>
      <p class="text-mid-gray mb-2">
        {{ $t('election_info.method') }}
      </p>
      <p class="text-mid-gray">
        {{ $t('election_info.usage_hint') }}
      </p>

      <div v-if="usingFallbackCatalog" class="alert alert-warning mt-6">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.167 1.732-3l-5.48-6.76c-.54-.676-1.598-.676-2.138 0l-5.48 6.76c-.77 1.833.262 3 1.732 3z" />
        </svg>
        <span>{{ $t('election_info.fallback_catalog', { ':old': municipalityScore.catalog_version.name, ':current': currentCatalogVersion.name }) }}</span>
      </div>

      <div class="flex justify-center mt-6">
        <button
          @click="fetchPDF()"
          class="btn btn-primary px-6 py-3 text-white font-semibold rounded-lg hover:scale-105 transition-transform"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 inline mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          {{ $t('generic.generate_pdf') }}
        </button>
      </div>
    </div>

    <!-- Measures List -->
    <div class="space-y-6">
      <div
        v-for="(measure, index) in sortedMeasures.slice(0, 10)"
        :key="measure.measure_id"
        class="bg-white rounded-xl shadow-list border border-solid-gray-10 p-6 transition-shadow hover:shadow-xl"
      >
        <!-- Measure Header -->
        <div class="flex items-start justify-between mb-4">
          <div class="flex-1">
            <h3 class="text-xl font-bold text-stats-dark flex items-center gap-3">
              <span class="w-8 h-8 bg-stats-dark text-white rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">
                {{ index + 1 }}
              </span>
              {{ measure.name }}
              <span class="text-sm font-normal text-mid-gray ml-2">({{ measure.measure_id }})</span>
            </h3>

          </div>
        </div>

        <!-- Measure Content -->
        <div class="space-y-4">
          <!-- Benefit Description -->
          <div v-if="measure.description_benefit" class="prose max-w-none text-mid-gray" v-html="md.render(measure.description_benefit)"></div>

          <!-- Current Progress -->
          <div v-if="measure.currentProgress" class="p-4 bg-mild-white rounded-lg border border-solid-gray-10">
            <p class="font-semibold text-stats-dark mb-1">{{ $t('election_info.current_status') }}</p>
            <p class="text-mid-gray">{{ measure.currentProgress }}</p>
          </div>

          <!-- Political Demand -->
          <div v-if="measure.politicalDemand" class="p-4 bg-mild-white rounded-lg border border-solid-gray-10">
            <p class="font-semibold text-stats-dark mb-1">{{ $t('election_info.political_demand') }}</p>
            <p class="text-mid-gray">{{ measure.politicalDemand }}</p>
          </div>

          <!-- Contribution Description -->
          <div v-if="measure.description_contribution" class="p-4 bg-solid-ff-green-05 rounded-lg border border-solid-ff-green-20">
            <p class="font-semibold text-ff-green mb-1">{{ $t('election_info.contribution') }}</p>
            <div class="prose max-w-none text-mid-gray" v-html="md.render(measure.description_contribution)"></div>
          </div>
        </div>

        <!-- Link to Municipality -->
        <div class="flex justify-end mt-4 pt-4 border-t border-solid-gray-10">
          <NuxtLink
            :to="`/municipalities/${municipalityScore.municipality.slug}?v=${municipalityScore.catalog_version.name}#measure-${measure.measure_id}`"
            class="btn btn-outline btn-secondary btn-sm gap-2 text-stats-dark hover:bg-solid-light-green-10"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
            {{ $t('election_info.to_rating') }}
          </NuxtLink>
        </div>
      </div>
    </div>

    <!-- Bottom PDF Button -->
    <div class="flex justify-center mt-8 py-4">
      <button
        @click="fetchPDF()"
        class="btn btn-primary px-6 py-3 text-white font-semibold rounded-lg hover:scale-105 transition-transform"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 inline mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        {{ $t('generic.generate_pdf') }}
      </button>
    </div>
  </div>
</template>

<script setup>
  import MarkdownIt from 'markdown-it'
  import measureCurrentProgressStrings from "~/assets/measure-current-progress-strings.json"
  import measurePoliticalDemandStrings from "~/assets/measure-political-demand-strings.json"

  const { $t } = useNuxtApp()
  const md = new MarkdownIt();

  const props = defineProps({
    municipalityScore: {
      type: Object,
      required: true,
    },
    ratingsMeasures: {
      type: Object,
      required: true,
    },
    usingFallbackCatalog: {
      type: Boolean,
      default: false,
    },
    currentCatalogVersion: {
      type: Object,
      required: true,
    },
  });


  const sortedMeasures = props.ratingsMeasures
  .filter(item =>
    item.applicable === true &&
    item.rating !== null
  )
  .map(item => {
      const rating = parseFloat(item.rating) || 0
      const weight = item.measure?.weight || 0
      const feasibilityPolitical = parseFloat(item.measure?.feasibility_political) || 0
      const feasibilityEconomical = parseFloat(item.measure?.feasibility_economical) || 0

      const potential = (1 - rating) * weight
      const difficulty = (feasibilityPolitical + feasibilityEconomical) / 2


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
      }
  })
  // Filter out measures that have no corresponding text (i.e. old BETA measures that have been removed)
  .filter(item => item.currentProgress && item.politicalDemand)
  .sort((a, b) => {
      // Sort by potential descending
      if (b.potential !== a.potential) return b.potential - a.potential

      // Tiebreaker: difficulty ascending
      if (a.difficulty !== b.difficulty) return a.difficulty - b.difficulty

      // Final tiebreaker: measure_id alphabetically
      return a.measure_id.localeCompare(b.measure_id)
  })

  function fetchCurrentProgressString(measureId, rating) {
      // Fetch base String from map
      let rawString = (measureCurrentProgressStrings[measureId] || {})[rating] || ""

      // Replace dynamic labels with their values
      return rawString
        .replaceAll("[MUNICIPALITY]", props.municipalityScore.municipality.name)
  }

  function fetchPoliticalDemandString(measureId, rating) {
      // Fetch base String from map
      let rawString = (measurePoliticalDemandStrings[measureId] || {})[rating] || ""

      // Replace dynamic labels with their values
      return rawString
        .replaceAll("[MUNICIPALITY]", props.municipalityScore.municipality.name)
  }

  const config = useRuntimeConfig(); // Nuxt 3 way to access runtime config

  const municipality = props.municipalityScore.municipality;

  async function fetchPDF() {
    try {
      const baseUrl = config.public.clientDirectusUrl;
      const token = config.public.directusToken;

      const response = await fetch(`${baseUrl}/pdf-service/elections/${municipality.slug}/${props.municipalityScore.catalog_version.name}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ measure_text: sortedMeasures.slice(0,10)}),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');

    } catch (err) {
      console.error('Error fetching PDF:', err);
    }
  }
</script>

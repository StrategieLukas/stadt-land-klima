<template>
  <!-- <h3> Test 123 </h3> -->
  <!-- Used as placeholder, but actually looks good on mobile too here :D -->
  <!-- <DetailMunicipalityQuickInfoDesktop :municipalityScore="municipalityScore"/> -->

  <p class="text-h3">Fragen zur Kommunalwahl auf Basis der Bewertung:</p>
  <p class="text-red" v-if="usingFallbackCatalog">Diese Fragen wurden auf Basis einer alten Bewertung ({{ municipalityScore.catalog_version.name }}) generiert, da die Kommune noch nicht für die neuste Version ({{ currentCatalogVersion.name }}) bewertet wurde.</p>
  <ul>
    <li v-for="(measure, index) in sortedMeasures.slice(0, 10)" :key="measure.measure_id">
      <strong>{{ index + 1 }}. {{ measure.name }}</strong> ({{ measure.measure_id }})
      <br>
      Potential: {{ measure.potential.toFixed(2) }}, 
      Difficulty: {{ measure.difficulty.toFixed(2) }},
      Rating: {{ measure.rating }}
      Weight: {{ measure.weight }}
      <br>
      {{ measure.improvementString }}. Wie haben Sie vor, dies zu ändern?
      <br>
      <p v-if="measure.description_benefit">
        Darum ist diese Maßnahme wichtig: <div v-html="md.render(measure.description_benefit)"></div>
      </p>
      
      <p v-if="measure.description_contribution">
        So bringst du sie ein:  <div v-html="md.render(measure.description_contribution)"></div>
      </p>
      <br>
      <NuxtLink :to="`/municipalities/${municipalityScore.municipality.slug}?v=${municipalityScore.catalog_version.name}#measure-${measure.measure_id}`" class="text-blue-600 underline hover:text-blue-800">
        {{ $t("map.icon.popup.goToRanking") }}
      </NuxtLink>
    </li>
   <button @click="fetchPDF()" class="p-4 flex items-center justify-end text-white bg-gray h-10">PDF</button>
    
  </ul>
</template>

<script setup>
  import MarkdownIt from 'markdown-it'
  import measureImprovementStrings from "~/assets/measure-improvement-strings.json"

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

  console.log(measureImprovementStrings);


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
        improvementString: fetchImprovementString(item.measure?.measure_id, item.rating),
      }
  })
  .sort((a, b) => {
      // Sort by potential descending
      if (b.potential !== a.potential) return b.potential - a.potential

      // Tiebreaker: difficulty ascending
      if (a.difficulty !== b.difficulty) return a.difficulty - b.difficulty

      // Final tiebreaker: measure_id alphabetically
      return a.measure_id.localeCompare(b.measure_id)
  })

  function fetchImprovementString(measureId, rating) {
      // Fetch base String from map
      let rawString = (measureImprovementStrings[measureId] || {})[rating] || ""

      // Replace dynamic labels with their values
      return rawString
        .replaceAll("MUNICIPALITY", props.municipalityScore.municipality.name)
  }

  const config = useRuntimeConfig(); // Nuxt 3 way to access runtime config

  async function fetchPDF() {
    try {
      const baseUrl = config.public.clientDirectusUrl;
      const token = config.public.directusToken;

      const response = await fetch(`${baseUrl}/pdf-service/elections/${props.municipalityScore.municipality.name}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ measure_text: sortedMeasures}),
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
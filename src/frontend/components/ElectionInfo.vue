<template>
  <!-- <h3> Test 123 </h3> -->
  <!-- Used as placeholder, but actually looks good on mobile too here :D -->
  <!-- <DetailMunicipalityQuickInfoDesktop :municipalityScore="municipalityScore"/> -->

  <p class="text-h3">Fragen zur Kommunalwahl auf Basis der Bewertung:</p>
  <p>Wir haben auf Basis der Bewertung dieser Kommune einen Fragenkatalog für diese Kommune erstellt.
    In dem Katalog werden die 10 Maßnahmen aufgeführt, bei denen diese Kommune das größte Verbesserungspotenzial hat.
    Das Verbesserungspotenzial berechnet sich aus der Bewertung und der Gewichtung der Maßnahme, d.h. Maßnahmen mit niedriger Bewertung und hoher Gewichtung haben das größte Verbesserungspotenzial.
  </p>
  <p class="mt-1">Diesen Fragenkatalog könnt ihr als Vorlage nutzen, um Fragen an Kandiderenden bei der Kommunalwahl zu stellen - oder um eure Verwaltung bzw Stadt/Gemeinderat damit zu konfrontieren.
    Mit dem Knopf unten könnt ihr euch direkt eine PDF generieren lassen, die ihr so verwenden könnt.
  </p>

  <div class="flex items-center justify-center my-4">
    <button @click="fetchPDF()" class="p-4 flex items-center text-white bg-gray h-10">PDF generieren</button>
  </div>

  <p class="text-red" v-if="usingFallbackCatalog">Diese Fragen wurden auf Basis einer alten Bewertung ({{ municipalityScore.catalog_version.name }}) generiert, da die Kommune noch nicht für die neuste Version ({{ currentCatalogVersion.name }}) bewertet wurde.</p>
  <ul>
    <li v-for="(measure, index) in sortedMeasures.slice(0, 10)" :key="measure.measure_id">
      <div class="my-3">
        <p class="text-xl">
          <strong>{{ index + 1 }}. {{ measure.name }}</strong> ({{ measure.measure_id }})
        </p>
        
        <div v-if="measure.description_benefit" v-html="md.render(measure.description_benefit)" class="italic"></div>
        <div v-if="measure.currentProgress">{{ measure.currentProgress }}</div>
        <div v-if="measure.politicalDemand">{{ measure.politicalDemand }}</div>
        <div v-if="measure.description_contribution" class="my-2">
          <strong>So kannst du die Maßnahme einbringen</strong>
          <div v-html="md.render(measure.description_contribution)"/>
        </div>
      
        <NuxtLink :to="`/municipalities/${municipalityScore.municipality.slug}?v=${municipalityScore.catalog_version.name}#measure-${measure.measure_id}`" class="text-blue-600 underline hover:text-blue-800">
          {{ $t("map.icon.popup.goToRanking") }}
        </NuxtLink>
      </div>
    </li>
    <div class="flex items-center justify-center">
      <button @click="fetchPDF()" class="p-4 flex items-center text-white bg-gray h-10">PDF generieren</button>
    </div>
    
  </ul>
</template>

<script setup>
  import MarkdownIt from 'markdown-it'
  import measureCurrentProgressStrings from "~/assets/measure-current-progress-strings.json"
  import measurePoliticalDemandStrings from "~/assets/measure-political-demand-strings.json"

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

  console.log(measurePoliticalDemandStrings)
  console.log(measurePoliticalDemandStrings["EN_01"]["0.75"])


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
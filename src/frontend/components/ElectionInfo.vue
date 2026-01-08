<template>
  <!-- <h3> Test 123 </h3> -->
  <!-- Used as placeholder, but actually looks good on mobile too here :D -->
  <!-- <DetailMunicipalityQuickInfoDesktop :municipalityScore="municipalityScore"/> -->

  <p class="text-h3">Fragen zur Kommunalwahl auf Basis der Bewertung:</p>
  <ul>
    <li v-for="(measure, index) in sortedMeasures.slice(0, 10)" :key="measure.measure_id">
      <strong>{{ index + 1 }}. {{ measure.name }}</strong>  
      <br>
      Potential: {{ measure.potential.toFixed(2) }}, 
      Difficulty: {{ measure.difficulty.toFixed(2) }},
      Rating: {{ measure.rating }}
      Weight: {{ measure.weight }}
    </li>
  </ul>
</template>

<script setup>
  const props = defineProps({
    municipalityScore: {
      type: Object,
      required: true,
    },
    ratingsMeasures: {
      type: Object,
      required: true,
    },
  });


  const sortedMeasures = props.ratingsMeasures
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
        rating: rating,
        impact: item.measure?.impact ?? null,
        feasibility_political: feasibilityPolitical,
        feasibility_economical: feasibilityEconomical,
        difficulty: difficulty,
      }
  })
  .sort((a, b) => {
      // Sort by potential descending
      if (b.potential !== a.potential) return b.potential - a.potential

      // Tiebreaker: difficulty ascending
      if (a._difficulty !== b._difficulty) return a._difficulty - b._difficulty

      // Final tiebreaker: measure_id alphabetically
      return a.measure_id.localeCompare(b.measure_id)
  })

  console.log(sortedMeasures)


</script>
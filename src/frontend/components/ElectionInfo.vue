<template>
    <h3> Test 123 </h3>
    <!-- Used as placeholder, but actually looks good on mobile too here :D -->
    <DetailMunicipalityQuickInfoDesktop :municipalityScore="municipalityScore"/>

    <h3>Fragen zur Kommunalwahl auf Basis der Bewertung:</h3>
    
</template>

<script setup>
const props = defineProps({
    municipalityScore: {
      type: Object,
      required: true,
    },
    sortedRatings: {
      type: Object,
      required: true,
    },
  });
</script>
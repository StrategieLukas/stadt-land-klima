<template lang="">
  <div class="flex flex-col">
    <ul>
      <li v-for="municipalityScore in publishedMunicipalityScores" :key="municipalityScore.id">
        <NuxtLink :to="`/municipalities/${municipalityScore.municipality.slug}`">
          <item-ranking :municipality-score="municipalityScore" :is-ranking="true" />
        </NuxtLink>
      </li>
    </ul>
  </div>
</template>
<script setup>
const props = defineProps({
  municipalityScores: {
    type: Array,
    required: true,
  },
  catalogVersion: {
    required: true,
  }
});

console.log(props.municipalityScores);
console.log(props.municipalityScores[0]);
// Hide unpublished municipalities and those with percentage_rated < 95% for the catalog version from the Ranking view
const publishedMunicipalityScores = computed(() => {
  return props.municipalityScores.filter(s => s.municipality.status === "published" && s.percentage_rated > 95) || []
})
console.log(publishedMunicipalityScores.value);
</script>
<style lang=""></style>

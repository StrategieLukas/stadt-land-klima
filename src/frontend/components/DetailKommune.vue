<template lang="">
  <div class="justify-center">
    <item-ranking :kommune="kommune" :index="0"></item-ranking>
    <kommune-polar-chart :sub-scores="subScores" :name-kommune="kommune.name"> </kommune-polar-chart>
    <div v-for="key in Object.keys(sortedBewertungen)" :key="key" class="py-2">
      <collapse-sector :measures-assessments="sortedBewertungen[key]"></collapse-sector>
    </div>

    <div>Detail view for each city in the rankings</div>
  </div>
</template>
<script setup>
const props = defineProps({
  kommune: {
    type: Object,
    required: true,
  },
  sortedBewertungen: {
    type: Object,
    required: true,
  },
});
const kommune = props.kommune;
console.log("kommune DEtail City", kommune);
console.log("sorted Bewertungn DEtail City", props.sortedBewertungen);
const subScores = createSubScoreObject(kommune);
console.log("subScores", subScores);

function createSubScoreObject(kommune) {
  const temp = {};
  for (const [key, value] of Object.entries(kommune)) {
    if (key.includes("score")) {
      temp[key] = value;
    }
  }
  return temp;
}
</script>
<style lang=""></style>

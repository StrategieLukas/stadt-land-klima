<template lang="">
  <div class="w-full flex-col justify-center">
    <item-ranking :municipality="municipality" :index="0"></item-ranking>
    <municipality-polar-chart :sub-scores="subScores" :name-municipality="municipality.name"> </municipality-polar-chart>
    <div v-for="key in Object.keys(ratings)" :key="key" class="py-2">
      <collapse-sector :measures-assessments="ratings[key]"></collapse-sector>
    </div>
    <div>Detail view for each city in the rankings</div>
  </div>
</template>
<script setup>
const props = defineProps({
  municipality: {
    type: Object,
    required: true,
  },
  ratings: {
    type: Object,
    required: true,
  },
});
const municipality = props.municipality;
console.log("municipality DEtail City", municipality);

const subScores = createSubScoreObject(municipality);
console.log("subScores", subScores);

function createSubScoreObject(municipality) {
  const temp = {};
  for (const [key, value] of Object.entries(municipality)) {
    if (key.includes("score")) {
      temp[key] = value;
    }
  }
  return temp;
}
</script>
<style lang=""></style>

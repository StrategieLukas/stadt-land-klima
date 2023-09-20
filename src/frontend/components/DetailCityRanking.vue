<template lang="">
  <div>
    <city-polar-chart :sub-scores="subScores"> </city-polar-chart>
    Detail view for each city in the ranking
  </div>
</template>
<script setup>
const props = defineProps(['kommune']);
const { kommune } = props;
console.log('kommune', kommune);

const subScores = createSubScoreObject(kommune);
console.log('subScores', subScores);

function createSubScoreObject(kommune) {
  const temp = {};
  for (const [key, value] of Object.entries(kommune)) {
    if (key.includes('score')) {
      temp[key] = value;
    }
  }
  return temp;
}
</script>
<style lang=""></style>

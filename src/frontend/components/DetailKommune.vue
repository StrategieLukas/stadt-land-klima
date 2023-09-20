<template lang="">
  <kommune-polar-chart :sub-scores="subScores" :name-kommune="kommune.name"> </kommune-polar-chart>
  <div>Detail view for each city in the rankings</div>
</template>
<script setup>
const props = defineProps({
  kommune: {
    type: Object,
    required: true,
  },
});
const kommune = props.kommune;
console.log('kommune DEtail City', kommune);

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

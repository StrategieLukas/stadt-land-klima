<template lang="">
  <div>
    Polar Chart:
    <PolarArea :data="chartData" :options="chartOptions" />
  </div>
</template>
<script setup>
import { PolarArea } from 'vue-chartjs';
const props = defineProps({
  subScores: {
    type: Object,
    required: true,
  },
  nameKommune: {
    type: String,
    required: true,
  },
});
const subScoresArray = createSubScoreArray(props.subScores);
const colorsArray = createColorArray(subScoresArray);
const labels = [
  'Energie',
  'Landwirtschaft, Natur & Ernährung',
  'Verkehr',
  ' Industrie, Wirtschaft & Konsum',
  'Gebäude & Wärme',
  'Klimaschutzmanagement & Verwaltung',
];
const chartData = {
  labels: labels,
  datasets: [
    {
      label: props.nameKommune + ' Scores',
      data: subScoresArray,
      backgroundColor: colorsArray,
      borderWidth: 0,
    },
  ],
};
const chartOptions = {
  responsive: false,
  maintainAspectRatio: false,
  animation: { animateScale: false },
  plugins: {
    legend: {
      display: false,
    },
  },

  scales: {
    r: {
      pointLabels: {
        color: 'red',
      },
      startAngle: 0,
      angleLines: {
        display: true,
        lineWidth: 1,
      },
      ticks: {
        color: 'gray',
        backdropColor: 'rgba(0,0,0,0)',
        stepSize: 2,
        maxRotation: 90,

        z: 1,
      },
    },
  },
};

function createSubScoreArray(subScoreObject) {
  const tempScores = [];
  tempScores.push(subScoreObject.score_energie);
  tempScores.push(subScoreObject.score_lne);
  tempScores.push(subScoreObject.score_verkehr);
  tempScores.push(subScoreObject.score_iwk);
  tempScores.push(subScoreObject.score_gw);
  tempScores.push(subScoreObject.score_kv);
  console.log('temp tempScores:', tempScores);
  return tempScores;
}
function createColorArray(subScoresArray) {
  const tempColorsArray = [];
  subScoresArray.forEach(function (score, index) {
    if (score < 3) {
      tempColorsArray.push('rgba(255, 99, 132,0.5)');
    } else if (score < 7) {
      tempColorsArray.push('rgb(75, 192, 192, 0.5)');
    } else {
      tempColorsArray.push('rgb(54, 162, 235, 0.5)');
    }
  });
  console.log('temp Color:', tempColorsArray);
  return tempColorsArray;
}
</script>
<style lang=""></style>

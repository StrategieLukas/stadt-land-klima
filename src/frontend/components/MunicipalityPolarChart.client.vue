<template lang="">
  <div class="flex w-full justify-center">
    <div class="relative flex h-96 w-full items-center justify-center">
      <div class="relative flex h-96 w-full items-center justify-center">
        <div class="z-10 h-60/100 w-60/100">
          <PolarArea :data="chartData" :options="chartOptions" />
        </div>
      </div>
      <div class="absolute h-full w-full items-center justify-center">
        <ring-polar></ring-polar>
      </div>
    </div>
  </div>
</template>
<script setup>
import { PolarArea } from "vue-chartjs";

const props = defineProps({
  subScores: {
    type: Object,
    required: true,
  },
  nameMunicipality: {
    type: String,
    required: true,
  },
});
const subScoresArray = createSubScoreArray(props.subScores);
const colorsArray = createColorArray(subScoresArray);
const labels = [
  "Energie",
  "Verkehr",
  "Landwirtschaft, Natur & Ernährung",
  "Industrie, Wirtschaft & Konsum",
  "Gebäude & Wärme",
  "Klimaschutzmanagement & Verwaltung",
];
const chartData = {
  labels: labels,
  datasets: [
    {
      label: props.nameMunicipality + " Scores",
      data: subScoresArray,
      backgroundColor: colorsArray,
      borderWidth: 0,
    },
  ],
};
const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { animateScale: false },
  plugins: {
    legend: {
      display: false,
    },
    tooltip: {
      callbacks: {
        label: function (context) {
          const label = context.formattedValue;
          return label;
        },
      },
    },
  },

  scales: {
    r: {
      min: 0,
      max: 10,
      pointLabels: {
        color: "red",
      },
      startAngle: 0,
      angleLines: {
        display: true,
        lineWidth: 1,
      },
      ticks: {
        sampleSize: 6,
        color: "black",
        backdropColor: "rgba(0,0,0,0)",
        stepSize: 2,

        z: 1,
      },
    },
  },
};

function createSubScoreArray(subScoreObject) {
  const tempScores = [];
  tempScores.push(subScoreObject.score_energy);
  tempScores.push(subScoreObject.score_transport);
  tempScores.push(subScoreObject.score_ann);
  tempScores.push(subScoreObject.score_iec);
  tempScores.push(subScoreObject.score_bh);
  tempScores.push(subScoreObject.score_cpma);
  return tempScores;
}
function createColorArray(subScoresArray) {
  const tempColorsArray = [];
  subScoresArray.forEach(function (score, index) {
    if (score < 4) {
      tempColorsArray.push("rgb(227, 6, 19, 0.5)");
    } else if (score < 7) {
      tempColorsArray.push("rgb(243, 146, 0, 0.5)");
    } else {
      tempColorsArray.push("rgb(29, 166, 74, 0.5)");
    }
  });
  return tempColorsArray;
}
</script>
<style scoped></style>

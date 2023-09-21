<template lang="">
  <div class="flex w-full justify-center">
    <div class="relative flex h-96 w-full items-center justify-center">
      <div class="relative flex h-96 w-full items-center justify-center">
        <div class="h-60/100 w-60/100 z-10">
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
  nameKommune: {
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
      label: props.nameKommune + " Scores",
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
  },

  scales: {
    r: {
      pointLabels: {
        color: "red",
      },
      startAngle: 0,
      angleLines: {
        display: true,
        lineWidth: 1,
      },
      ticks: {
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
  tempScores.push(subScoreObject.score_energie);
  tempScores.push(subScoreObject.score_verkehr);
  tempScores.push(subScoreObject.score_lne);
  tempScores.push(subScoreObject.score_iwk);
  tempScores.push(subScoreObject.score_gw);
  tempScores.push(subScoreObject.score_kv);
  console.log("temp tempScores:", tempScores);
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
  console.log("temp Color:", tempColorsArray);
  return tempColorsArray;
}
</script>
<style>
.st0 {
  fill: #ededed;
}
.st1 {
  font-family: "RobotoCondensed-Regular";
}
.st2 {
  font-size: 12px;
}
.st3 {
  fill: #ffffff;
}
.st4 {
  fill-rule: evenodd;
  clip-rule: evenodd;
  fill: #ffffff;
}
</style>

<template lang="">
  <div class="flex w-full justify-center">
    <div :style="{ height: height }" class="relative flex w-full items-center justify-center">
      <div :style="{ height: height }" class="relative flex w-full items-center justify-center">
        <div class="z-10 h-58/100 w-58/100">
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
/* import resolveConfig from "tailwindcss/resolveConfig";
import tailwindConfig from "../tailwind.config";

const config = resolveConfig(tailwindConfig); */

import { PolarArea } from "vue-chartjs";
import {
  Chart,
  Title,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale,
  ArcElement,
  RadialLinearScale,
} from "chart.js";
class CustomRadialLinearScale extends RadialLinearScale {
  draw() {
    super.draw();
  }
}
CustomRadialLinearScale.id = "customRadialLinear";
Chart.register(CategoryScale, LinearScale, CustomRadialLinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

const props = defineProps({
  subScores: {
    type: Object,
    required: true,
  },
  nameMunicipality: {
    type: String,
    required: true,
  },
  height: {
    type: String,
    default: '24rem' // default height (h-96 is 24rem)
  }
});
const subScoresArray = createSubScoreArray(props.subScores);
const colorsArray = createColorArray(subScoresArray);
const subScoresArrayScaled = scaleToArea(subScoresArray);
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
      data: subScoresArrayScaled,
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
          const label = subScoresArray[context.dataIndex] + "%";
          return label;
        },
      },
    },
  },
  scales: {
    r: {
      type: "customRadialLinear",
      grid: {
        display: false,
      },
      min: 0,
      max: 100,
      startAngle: 0,
      angleLines: {
        display: true,
        lineWidth: 1,
        z: 1,
      },

      ticks: {
        display: false,
        sampleSize: 6,
        stepSize: 20,
        z: 2,
      },
    },
  },
};

function createSubScoreArray(subScoreObject) {
  let scoresArray = [];
  scoresArray.push(subScoreObject.score_energy);
  scoresArray.push(subScoreObject.score_transport);
  scoresArray.push(subScoreObject.score_ann);
  scoresArray.push(subScoreObject.score_iec);
  scoresArray.push(subScoreObject.score_bh);
  scoresArray.push(subScoreObject.score_cpma);
  return scoresArray.map((value) => Math.round(Number(value) * 10) / 10);
}
function scaleToArea(scoresArray) {
  return scoresArray.map((value) => Math.sqrt(value / 100) * 100);
}
function createColorArray(subScoresArray) {
  const tempColorsArray = [];
  subScoresArray.forEach(function (score, index) {
    if (score < 20) {
      tempColorsArray.push("#D9000D");
    } else if (score < 40) {
      tempColorsArray.push("#F27C00");
    } else if (score < 60) {
      tempColorsArray.push("#FFD400");
    } else if (score < 80) {
      tempColorsArray.push("#AFCA0B");
    } else {
      tempColorsArray.push("#1DA64A");
    }
  });
  return tempColorsArray;
}
</script>
<style scoped></style>

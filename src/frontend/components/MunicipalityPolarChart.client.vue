<template lang="">
  <div class="flex w-full justify-center">
    <div class="relative flex h-96 w-full items-center justify-center">
      <div class="relative flex h-96 w-full items-center justify-center">
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

import { PolarArea } from 'vue-chartjs'
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
   super.draw()
   
  }
}
CustomRadialLinearScale.id = 'customRadialLinear';
Chart.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, CustomRadialLinearScale, ArcElement);


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
          const label = context.formattedValue +'%';
          return label;
        },
      },
    },
  },

  scales: {
    r: {
      type: 'customRadialLinear', 
      min: 0,
      max: 100,
      startAngle: 0,
      angleLines: {
        display: true,
        lineWidth: 1,
        z:1,
      },
     
      ticks: {
        display:false,
        sampleSize: 6,
        stepSize: 20,
        z: 2,
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
 
    if (score < 20) {
      tempColorsArray.push("#D9000D");
    } else if (score < 40) {
      tempColorsArray.push("#F27C00");
    } else if (score < 60) {
      tempColorsArray.push("#FFD400");
    }
    else if (score < 80) {
      tempColorsArray.push("#AFCA0B");
    }
    else {
      tempColorsArray.push("#1DA64A");
    }
  });
  return tempColorsArray;
}
</script>
<style scoped></style>

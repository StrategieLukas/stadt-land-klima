<template>
  <div ref="container" class="flex w-full justify-center" data-testid="municipality-polar-chart">
    <div class="relative flex h-96 w-full items-center justify-center">
      <div class="relative flex h-96 w-full cursor-pointer items-center justify-center">
        <div class="z-10 h-58/100 w-58/100">
          <ClientOnly>
            <PolarArea v-if="visible" :data="chartData" :options="chartOptions" />
          </ClientOnly>
        </div>
      </div>
      <div class="absolute h-full w-full items-center justify-center">
        <ring-polar></ring-polar>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, type PropType } from "vue";
import type { SubScores } from "~/types/components/municipality";

/* import resolveConfig from "tailwindcss/resolveConfig";
import tailwindConfig from "../tailwind.config";

const config = resolveConfig(tailwindConfig); */

import type { ChartOptions } from "chart.js";
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
Chart.register(CategoryScale, LinearScale, RadialLinearScale, BarElement, Title, Tooltip, Legend, ArcElement);
const { $t } = useNuxtApp();

function cssColor(name: string, fallback: string) {
  if (typeof window === "undefined") {
    return fallback;
  }

  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

const props = defineProps({
  subScores: {
    type: Object as PropType<SubScores>,
    required: true,
  },
  nameMunicipality: {
    type: String,
    required: true,
  },
});
const container = ref<HTMLElement | null>(null);
const visible = ref(false);
let resizeObserver: ResizeObserver | undefined;
onMounted(() => {
  const update = () => {
    visible.value = !!container.value && container.value.getBoundingClientRect().width > 0;
  };
  resizeObserver = new ResizeObserver(update);
  if (container.value) resizeObserver.observe(container.value);
  update();
});
onBeforeUnmount(() => resizeObserver?.disconnect());
const subScoresArray = computed(() => createSubScoreArray(props.subScores));
const colorsArray = computed(() => createColorArray(subScoresArray.value));
const subScoresArrayScaled = computed(() => scaleToArea(subScoresArray.value));
const labels = [
  $t("measure_sectors.energy.title"),
  $t("measure_sectors.transport.title"),
  $t("measure_sectors.agriculture.title"),
  $t("measure_sectors.industry.title"),
  $t("measure_sectors.buildings.title"),
  $t("measure_sectors.management.title"),
];
const chartData = computed(() => ({
  labels: labels,
  datasets: [
    {
      label: props.nameMunicipality,
      data: subScoresArrayScaled.value,
      backgroundColor: colorsArray.value,
      borderWidth: 0,
    },
  ],
}));
// Mapping from chart data index to sector keys
const sectorKeys = ["energy", "transport", "agriculture", "industry", "buildings", "management"];

const chartOptions: ChartOptions<"polarArea"> = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { animateScale: false },
  onClick: (event, elements) => {
    if (elements.length > 0) {
      const index = elements[0]!.index;
      const sectorKey = sectorKeys[index];
      // Navigate to the sector by setting the hash
      window.location.hash = `sector-${sectorKey}`;
    }
  },
  plugins: {
    legend: {
      display: false,
    },
    tooltip: {
      callbacks: {
        label: function (context) {
          const label = `${subScoresArray.value[context.dataIndex] ?? 0}%`;
          return label;
        },
      },
    },
  },
  scales: {
    r: {
      type: "radialLinear",
      grid: {
        display: false,
      },
      min: 0,
      max: 100,
      startAngle: 0,
      angleLines: {
        display: true,
        color: cssColor("--slk-border-strong", "#b9c2b0"),
        lineWidth: 1,
      },

      ticks: {
        display: false,
        stepSize: 20,
        z: 2,
      },
    },
  },
};

function createSubScoreArray(subScoreObject: SubScores) {
  const scoresArray = [];
  scoresArray.push(subScoreObject.score_energy);
  scoresArray.push(subScoreObject.score_transport);
  scoresArray.push(subScoreObject.score_agriculture);
  scoresArray.push(subScoreObject.score_industry);
  scoresArray.push(subScoreObject.score_buildings);
  scoresArray.push(subScoreObject.score_management);
  return scoresArray.map((value) =>
    Number.isFinite(Number(value)) ? Math.min(100, Math.max(0, Math.round(Number(value) * 10) / 10)) : 0,
  );
}
function scaleToArea(scoresArray: number[]) {
  return scoresArray.map((value) => Math.sqrt(value / 100) * 100);
}
function createColorArray(subScoresArray: number[]) {
  const tempColorsArray: string[] = [];
  subScoresArray.forEach(function (score, _index) {
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

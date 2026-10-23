<template>
  <div class="flex w-full justify-center">
    <div class="relative flex w-full cursor-pointer items-center justify-center" style="height: 500px">
      <canvas ref="chartCanvas" style="width: 100%; height: 100%"></canvas>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { NumericValue } from "~/shared/domain";

import type { ChartData, ChartOptions, ScriptableContext } from "chart.js";
import { treemapDatum, type TreemapItem } from "~/shared/treemap";
import type { PropType } from "vue";
import type { RatingsBySector } from "~/types/components/municipality";

import { ref, onMounted, onBeforeUnmount, computed } from "vue";
import { Chart, LinearScale } from "chart.js";
import { TreemapController, TreemapElement } from "chartjs-chart-treemap";
Chart.register(TreemapController, TreemapElement, LinearScale);
const { $t, $translateDynamic } = useNuxtApp();

const props = defineProps({
  ratingsBySector: {
    type: Object as PropType<RatingsBySector>,
    required: true,
  },
  nameMunicipality: {
    type: String,
    required: true,
  },
});

const chartCanvas = ref<HTMLCanvasElement | null>(null);
let chartInstance: Chart<"treemap"> | null = null;

function cssColor(name: string, fallback: string) {
  if (typeof window === "undefined") {
    return fallback;
  }

  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function sectorName(sector: string) {
  const translated = $translateDynamic(`measure_sectors.${sector}.title`);
  return translated === `measure_sectors.${sector}.title` ? sector : translated;
}

// Transform data for treemap - use computed to ensure reactivity
const treeData = computed(() => {
  const data: TreemapItem[] = [];

  Object.entries(props.ratingsBySector).forEach(([sector, ratings]) => {
    ratings.forEach((item) => {
      // Only include applicable measures with weight
      if (item.applicable && Number(item.measure?.weight) > 0) {
        const rating = Number(item.rating) || 0;
        const weight = Number(item.measure.weight) || 0;

        data.push({
          sector: sector,
          sectorName: sectorName(sector),
          measure_id: item.measure.measure_id,
          measure_name: item.measure.name,
          rating: rating,
          weight: weight,
          value: weight, // size is based on weight
        });
      }
    });
  });

  return data;
});

function getRatingString(rating: NumericValue) {
  if (rating == 0) {
    return $t("rating.hardly_or_not");
  } else if (rating == 0.25) {
    return $t("rating.initial_steps");
  } else if (rating == 0.5) {
    return $t("rating.halfway");
  } else if (rating == 0.75) {
    return $t("rating.mostly");
  } else if (rating == 1) {
    return $t("rating.completed");
  } else {
    return String(rating ?? "");
  }
}

function colorFromRaw(ctx: ScriptableContext<"treemap">) {
  // check how many children the current node has
  // if more than 1, it's a group node
  // if zero children, it's a leaf node
  // return color based on rating

  if (ctx.type !== "data") {
    return cssColor("--slk-surface", "#ffffff");
  }

  if (treemapDatum(ctx.raw).children.length > 1) {
    // it's a group
    return cssColor("--slk-surface-muted", "#e5e7eb");
  }

  const item = treemapDatum(ctx.raw).children[0];
  if (!item) return cssColor("--slk-surface", "#ffffff");
  if (item.rating == 0) {
    return "#E30613"; // red
  } else if (item.rating == 0.25) {
    return "#F39200"; // orange
  } else if (item.rating == 0.5) {
    return "#FFD400"; // yellow
  } else if (item.rating == 0.75) {
    return "#AFCA0B"; // green
  } else {
    return "#1EA64A"; // default light color
  }
}

// Prepare chart data
const chartData = computed<ChartData<"treemap">>(() => ({
  datasets: [
    {
      data: [],
      label: props.nameMunicipality,
      tree: treeData.value,
      key: "value",
      groups: ["sectorName", "measure_name"],
      displayMode: "container_boxes",
      spacing: 0.5,
      borderWidth: 2,
      borderColor: () => cssColor("--slk-surface", "#ffffff"),
      backgroundColor: (ctx) => colorFromRaw(ctx),
      labels: {
        display: true,
        formatter: (ctx) => {
          if (!ctx.raw) return "";

          if (treemapDatum(ctx.raw).children.length > 1) {
            // it's a group
            return treemapDatum(ctx.raw).sectorName ?? "";
          }

          const item = treemapDatum(ctx.raw).children[0];
          if (!item) return "";

          // Show sector name for groups, measure_id for leaves
          if (item.measure_name) {
            return item.measure_name;
          }
          return item.sectorName || "";
        },
        color: (ctx) => {
          if (!ctx.raw || treemapDatum(ctx.raw).children.length > 1) {
            return cssColor("--slk-text-strong", "#101820");
          }

          const item = treemapDatum(ctx.raw).children[0];
          return item?.rating === 0 ? "#ffffff" : "#101820";
        },
        font: {
          size: 12,
          weight: "bold",
        },
        overflow: "cut",
      },
    },
  ],
}));

const chartOptions: ChartOptions<"treemap"> = {
  responsive: true,
  maintainAspectRatio: false,
  onClick: (event, elements) => {
    if (elements.length == 1) {
      // sector clicked
      const element = elements[0]!;
      const item = treemapDatum(chartInstance?.data.datasets[element.datasetIndex]?.data[element.index]).children[0];

      if (item && item.sectorName) {
        // Navigate to the measure by setting the hash
        window.location.hash = `sector-${item.sector}`;
      }
    } else if (elements.length == 2) {
      // measure clicked
      const element = elements[1]!;
      const item = treemapDatum(chartInstance?.data.datasets[element.datasetIndex]?.data[element.index]).children[0];

      if (item && item.measure_id) {
        // Navigate to the measure by setting the hash
        window.location.hash = `measure-${item.measure_id}`;
      }
    }
  },
  plugins: {
    legend: {
      display: false,
    },
    tooltip: {
      callbacks: {
        title: function (context) {
          if (context.length == 1) {
            // it's a group
            return treemapDatum(context[0]?.raw).sectorName;
          }
          const ctx = context[1];
          if (!ctx) return "";
          const item = treemapDatum(ctx.raw).children[0];
          if (!item) return "";
          return item.measure_name;
        },
        label: function (context) {
          // console.log("Tooltip context:", context);
          // if (context.type !== 'data') {
          //   return 'transparent';
          // }
          if (treemapDatum(context.raw).children.length > 1) {
            // it's a group
            return "";
          }
          const item = treemapDatum(context.raw).children[0];
          if (!item) return "";

          const lines = [];
          if (item.measure_id) {
            lines.push(`ID: ${item.measure_id}`);
            lines.push(`${$t("stats.chart.rating")}: ${getRatingString(item.rating ?? null)}`);
            lines.push(`${$t("measure.weight")}: ${item.weight}`);
          }
          return lines;
        },
      },
      displayColors: false,
    },
  },
};

onMounted(() => {
  if (chartCanvas.value && treeData.value.length > 0) {
    const ctx = chartCanvas.value.getContext("2d");
    if (!ctx) return;
    chartInstance = new Chart(ctx, {
      type: "treemap",
      data: chartData.value,
      options: chartOptions,
    });
  }
});

onBeforeUnmount(() => {
  if (chartInstance) {
    chartInstance.destroy();
  }
});
</script>

<style scoped></style>

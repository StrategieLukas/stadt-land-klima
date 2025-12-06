<template>
  <div class="flex w-full justify-center">
    <div class="relative flex w-full items-center justify-center cursor-pointer" style="height: 500px;">
      <canvas ref="chartCanvas" style="width: 100%; height: 100%;"></canvas>
    </div>
  </div>
</template>

<script setup>
import colorLib from '@kurkle/color';
import { ref, onMounted, onBeforeUnmount, computed } from 'vue';
import { Chart } from 'chart.js';
import { TreemapController, TreemapElement } from 'chartjs-chart-treemap';
Chart.register(TreemapController, TreemapElement);

const props = defineProps({
  sortedRatings: {
    type: Object,
    required: true,
  },
  nameMunicipality: {
    type: String,
    required: true,
  }
});

const chartCanvas = ref(null);
let chartInstance = null;

// Sector name mapping
const sectorNames = {
  energy: "Energie",
  transport: "Verkehr",
  agriculture: "Landwirtschaft, Natur & Ernährung",
  industry: "Industrie, Wirtschaft & Konsum",
  buildings: "Gebäude & Wärme",
  management: "Klimaschutzmanagement & Verwaltung",
};

// Transform data for treemap - use computed to ensure reactivity
const treeData = computed(() => {
  const data = [];
  
  Object.entries(props.sortedRatings).forEach(([sector, ratings]) => {
    ratings.forEach((item) => {
      // Only include applicable measures with weight
      if (item.applicable && item.measure?.weight > 0) {
        const rating = parseFloat(item.rating) || 0;
        const weight = parseFloat(item.measure.weight) || 0;
        
        data.push({
          sector: sector,
          sectorName: sectorNames[sector] || sector,
          measure_id: item.measure.measure_id,
          measure_name: item.measure.name,
          rating: rating,
          weight: weight,
          value: weight, // size is based on weight
        });
      }
    });
  });
  
  console.log("Tree Data:", data);

  return data;
});

function getRatingString(rating) {
  if (rating == 0) {
    return "kaum/nicht";
  } else if (rating == 0.25) {
    return "ansatzweise";
  } else if (rating == 0.5) {
    return "halbwegs";
  } else if (rating == 0.75) {
    return "größtenteils";
  } else if (rating == 1) {
    return "vollständig";
  } else {
    return rating.toString();
  }
}

function colorFromRaw(ctx) {
  // check how many children the current node has
  // if more than 1, it's a group node
  // if zero children, it's a leaf node
  // return color based on rating

  if (ctx.type !== 'data') {
    return 'transparent';
  }
  

  if (ctx.raw._data.children.length > 1) {
    // it's a group
    return 'rgba(0,0,0,0.1)';
  }

  const item = ctx.raw._data.children[0];
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
const chartData = computed(() => ({
  datasets: [{
    label: props.nameMunicipality,
    tree: treeData.value,
    key: 'value',
    groups: ["sectorName", "measure_name"],
    displayMode: "container_boxes",
    spacing: 0.5,
    borderWidth: 2,
    borderColor: 'white',
    backgroundColor: (ctx) => colorFromRaw(ctx),
    labels: {
      display: true,
      formatter: (ctx) => {
        if (!ctx.raw) return '';

        if (ctx.raw._data.children.length > 1) {
          // it's a group
          return ctx.raw._data.sectorName;
        }

        const item = ctx.raw._data.children[0];
        if (!item) return '';
        
        // Show sector name for groups, measure_id for leaves
        if (item.measure_name) {
          return item.measure_name;
        }
        return item.sectorName || '';
      },
      color: ['white', 'black'],
      font: {
        size: 12,
        weight: 'bold',
      },
      overflow: 'cut',
    }
  }]
}));

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  onClick: (event, elements) => {
    if (elements.length == 1) {
      // sector clicked
      const element = elements[0];
      const item = element.element.$context.raw._data.children[0];
      
      if (item && item.sectorName) {
        // Navigate to the measure by setting the hash
        window.location.hash = `sector-${item.sector}`;
      }
    }
    else if (elements.length == 2) {
      // measure clicked
      const element = elements[1];
      console.log(element)
      const item = element.element.$context.raw._data.children[0];
      
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
        title: function(context) {
          console.log(context)
          if (context.length == 1) {
            // it's a group
            return context[0].raw._data.sectorName;
          }
          const ctx = context[1];
          const item = ctx.raw._data.children[0];
          if (!item) return '';
          return item.measure_name;
        },
        label: function(context) {
          // console.log("Tooltip context:", context);
          // if (context.type !== 'data') {
          //   return 'transparent';
          // }
          if (context.raw._data.children.length > 1) {
            // it's a group
            return "";
          }
          const item = context.raw._data.children[0];
          if (!item) return '';
          
          const lines = [];
          if (item.measure_id) {
            lines.push(`ID: ${item.measure_id}`);
            lines.push(`Rating: ${getRatingString(item.rating)}`);
            lines.push(`Gewichtung: ${item.weight}`);
          }
          return lines;
        }
      },
      displayColors: false,
    }
  }
};

onMounted(() => {
  if (chartCanvas.value && treeData.value.length > 0) {
    const ctx = chartCanvas.value.getContext('2d');
    chartInstance = new Chart(ctx, {
      type: 'treemap',
      data: chartData.value,
      options: chartOptions
    });
  }
});

onBeforeUnmount(() => {
  if (chartInstance) {
    chartInstance.destroy();
  }
});
</script>

<style scoped>
</style>

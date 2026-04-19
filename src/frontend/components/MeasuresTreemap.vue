<template>
  <div class="relative w-full cursor-pointer" style="height: 520px;">
    <canvas ref="chartCanvas" style="width: 100%; height: 100%;"></canvas>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { Chart, LinearScale, Tooltip, Legend } from 'chart.js';
import { TreemapController, TreemapElement } from 'chartjs-chart-treemap';
Chart.register(TreemapController, TreemapElement, LinearScale, Tooltip, Legend);

const props = defineProps({
  measures: {
    type: Array,
    required: true,
  },
  onNavigate: {
    type: Function,
    default: null,
  },
});

const sectorNames = {
  energy: "Energie",
  transport: "Verkehr",
  agriculture: "Landwirtschaft",
  industry: "Industrie & Konsum",
  buildings: "Gebäude & Wärme",
  management: "Klimaschutzmanagement",
};

const chartCanvas = ref(null);
let chartInstance = null;

const treeData = computed(() => {
  return props.measures
    .filter(m => (m.weight ?? 0) > 0)
    .map(m => ({
      sector: m.sector,
      sectorName: sectorNames[m.sector] || m.sector,
      measure_id: m.measure_id,
      measure_name: m.name,
      slug: m.slug,
      value: m.weight ?? 1,
    }));
});

function colorFromRaw(ctx) {
  if (ctx.type !== 'data') return 'transparent';
  const children = ctx.raw._data?.children ?? [];
  if (children.length > 1) return 'rgba(0,0,0,0.08)';
  const item = children[0];
  if (!item) return '#9D9D9C';
  const sectorColors = {
    energy: '#F39200',
    transport: '#16BAE7',
    agriculture: '#1EA64A',
    industry: '#6B4C9A',
    buildings: '#E30613',
    management: '#AFCA0B',
  };
  return sectorColors[item.sector] ?? '#9D9D9C';
}

const chartData = computed(() => ({
  datasets: [{
    label: 'Maßnahmen',
    tree: treeData.value,
    key: 'value',
    groups: ['sectorName', 'measure_name'],
    spacing: 0.5,
    borderWidth: 2,
    borderColor: 'white',
    backgroundColor: colorFromRaw,
    labels: {
      display: true,
      formatter: (ctx) => {
        if (!ctx.raw) return '';
        const children = ctx.raw._data?.children ?? [];
        if (children.length > 1) return ctx.raw._data?.sectorName ?? '';
        const item = children[0];
        if (!item) return '';
        return item.measure_name ?? '';
      },
      color: 'white',
      font: { size: 11, weight: 'bold' },
      overflow: 'cut',
    },
  }],
}));

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  onClick: (_event, elements) => {
    if (elements.length >= 2) {
      const item = elements[1].element.$context.raw._data?.children?.[0];
      if (item?.slug && props.onNavigate) props.onNavigate(item.slug);
    }
  },
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        title(context) {
          if (context.length === 1) return context[0].raw._data?.sectorName ?? '';
          const item = context[1]?.raw._data?.children?.[0];
          return item?.measure_name ?? '';
        },
        label(context) {
          const children = context.raw._data?.children ?? [];
          if (children.length > 1) return '';
          const item = children[0];
          if (!item) return '';
          return [`ID: ${item.measure_id}`, `Gewichtung: ${item.value}`];
        },
      },
      displayColors: false,
    },
  },
}));

function buildChart() {
  if (!chartCanvas.value || treeData.value.length === 0) return;
  chartInstance?.destroy();
  const ctx = chartCanvas.value.getContext('2d');
  chartInstance = new Chart(ctx, {
    type: 'treemap',
    data: chartData.value,
    options: chartOptions.value,
  });
}

onMounted(buildChart);
onBeforeUnmount(() => chartInstance?.destroy());

watch(treeData, () => {
  buildChart();
}, { deep: true });
</script>

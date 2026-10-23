<template>
  <div class="relative w-full cursor-pointer" style="height: 520px;">
    <canvas ref="chartCanvas" style="width: 100%; height: 100%;"></canvas>
  </div>
</template>

<script setup lang="ts">

import type { ChartData, ChartOptions, ScriptableContext } from 'chart.js';
import { treemapDatum } from '~/shared/treemap';
import type { PropType } from 'vue';
import type { Measure } from '~/types/components/municipality';

import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { Chart, LinearScale, Tooltip, Legend } from 'chart.js';
import { TreemapController, TreemapElement } from 'chartjs-chart-treemap';
Chart.register(TreemapController, TreemapElement, LinearScale, Tooltip, Legend);
const { $t, $translateDynamic } = useNuxtApp();

const props = defineProps({
  measures: {
    type: Array as PropType<Measure[]>,
    required: true,
  },
  onNavigate: {
    type: Function as PropType<((slug: string) => void) | null | undefined>,
    default: null,
  },
});

function sectorName(sector: string) {
  const translated = $translateDynamic(`measure_sectors.${sector}.title`);
  return translated === `measure_sectors.${sector}.title` ? sector : translated;
}

const chartCanvas = ref<HTMLCanvasElement | null>(null);
let chartInstance: Chart<'treemap'> | null = null;

const treeData = computed(() => {
  return props.measures
    .filter(m => Number(m.weight ?? 0) > 0)
    .map(m => ({
      sector: m.sector,
      sectorName: sectorName(m.sector),
      measure_id: m.measure_id,
      measure_name: m.name,
      slug: m.slug,
      value: Number(m.weight ?? 1),
    }));
});

function colorFromRaw(ctx: ScriptableContext<'treemap'>) {
  if (ctx.type !== 'data') return 'transparent';
  const children = treemapDatum(ctx.raw).children ?? [];
  if (children.length > 1) return '#ebebeb';
  const item = children[0];
  if (!item) return '#9D9D9C';
  const sectorColors: Record<string, string> = {
    energy: '#F39200',
    transport: '#16BAE7',
    agriculture: '#1EA64A',
    industry: '#6B4C9A',
    buildings: '#E30613',
    management: '#AFCA0B',
  };
  return sectorColors[item.sector] ?? '#9D9D9C';
}

const chartData = computed<ChartData<'treemap'>>(() => ({
  datasets: [{
    data: [],
    label: $t('stats.measures.title'),
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
        const children = treemapDatum(ctx.raw).children ?? [];
        if (children.length > 1) return treemapDatum(ctx.raw).sectorName ?? '';
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

const chartOptions = computed<ChartOptions<'treemap'>>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  onClick: (_event, elements) => {
    if (elements.length >= 2) {
      const item = treemapDatum(chartInstance?.data.datasets[elements[1]!.datasetIndex]?.data[elements[1]!.index]).children[0];
      if (item?.slug && props.onNavigate) props.onNavigate(item.slug);
    }
  },
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        title(context) {
          if (context.length === 1) return treemapDatum(context[0]?.raw).sectorName ?? '';
          const item = treemapDatum(context[1]?.raw).children?.[0];
          return item?.measure_name ?? '';
        },
        label(context) {
          const children = treemapDatum(context.raw).children ?? [];
          if (children.length > 1) return '';
          const item = children[0];
          if (!item) return '';
          return [`ID: ${item.measure_id}`, `${$t('measure.weight')}: ${item.value}`];
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
    if (!ctx) return;
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

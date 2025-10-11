<template>
  <div class="relative">
    <!-- Loading state -->
    <div v-if="loading" class="flex items-center justify-center py-8">
      <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      <span class="ml-2 text-sm text-gray-600">{{ $t('generic.loading') }}...</span>
    </div>
    
    <!-- Chart -->
    <div v-else-if="chartData && chartData.datasets.length > 0" class="w-full h-64">
      <Bar
        :data="chartData"
        :options="chartOptions"
        ref="chartRef"
      />
    </div>
    
    <!-- No data message -->
    <div v-else class="text-center py-8 text-gray-500 text-sm">
      {{ $t('stats.histogram.no_data') }}
    </div>

    <!-- Modal for municipalities in selected bin -->
    <dialog 
      ref="modalRef" 
      class="modal"
    >
      <div class="modal-box w-fit max-w-4xl">
        <form method="dialog">
          <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
        </form>
        <h3 class="text-lg font-bold mb-4">{{ $t('stats.histogram.municipalities_in_range') }}</h3>
        <div class="overflow-x-auto">
          <table class="table table-xs w-full">
            <thead>
              <tr>
                <th>{{ $t('administrative_areas.prefix') }}</th>
                <th>{{ $t('administrative_areas.name') }}</th>
                <th>{{ $t('stats.value') }}</th>
                <th>{{ $t('stats.action') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="municipality in selectedBinMunicipalities" :key="municipality.ars" class="hover">
                <td class="text-right">{{ municipality.prefix }}</td>
                <td class="text-left font-medium">{{ municipality.name }}</td>
                <td>
                  <span class="font-mono text-sm badge badge-neutral">{{ formatValue(municipality.value) }}</span>
                </td>
                <td>
                  <NuxtLink :to="`/stats/${municipality.ars}`" class="btn btn-xs btn-primary">
                    {{ $t('stats.view_stats') }}
                  </NuxtLink>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';

import { Bar } from 'vue-chartjs';
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale
} from 'chart.js';

// Register Chart.js components
ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale);

const props = defineProps({
  dataType: {
    type: String,
    required: true
  },
  attributeName: {
    type: String,
    required: true
  },
  currentValue: {
    type: Number,
    default: null
  },
  unit: {
    type: String,
    default: ''
  },
  populationNormalized: {
    type: Boolean,
    default: false
  }
});

const { $t, $stadtlandzahlAPI } = useNuxtApp();

const loading = ref(false);
const histogramData = ref([]);
const modalRef = ref(null);
const selectedBinMunicipalities = ref([]);

// Calculate histogram bins and chart data
const chartData = computed(() => {
  console.log('Computing chart data, histogramData:', histogramData.value?.length);
  if (!histogramData.value.length) return null;

  const values = histogramData.value.map(item => {
    let value;

    value = item[props.dataType]?.[props.attributeName];
    
    if (props.populationNormalized && item.populationData?.population) {
      value = (value / item.populationData.population) * 1000; // per 1000 inhabitants
    } else if (props.unit === '%' && props.attributeName === 'bicycleInfrastructureRatio' && value < 1) {
      value = value * 100; // Convert ratio to percentage
    }
    return value;
  }).filter(v => v !== null && v !== undefined && !isNaN(Number(v)));

  console.log('Processed values:', values.slice(0, 10)); // Log first 10 values
  console.log('Values length:', values.length);
  console.log('Min/Max:', Math.min(...values), Math.max(...values));

  if (!values.length) return null;

  // Sort values to find percentiles
  const sortedValues = [...values].sort((a, b) => a - b);
  const totalCount = sortedValues.length;
  
  // Calculate percentile indices
  const p5Index = Math.floor(totalCount * 0.05);
  const p95Index = Math.floor(totalCount * 0.95);
  
  // Get percentile values
  const p5Value = sortedValues[p5Index];
  const p95Value = sortedValues[p95Index];
  const absoluteMin = sortedValues[0];
  const absoluteMax = sortedValues[totalCount - 1];

  console.log('Percentiles - 5%:', p5Value, '95%:', p95Value, 'Absolute min/max:', absoluteMin, absoluteMax);

  // Create bins for middle 90%
  let mainBinCount = Math.min(18, Math.max(3, Math.ceil(Math.sqrt(totalCount * 0.9)))); // Leave room for 2 extreme bins
  let mainBinWidth = (p95Value - p5Value) / mainBinCount;
  
  // Handle case where middle 90% values are the same
  if (p95Value === p5Value) {
    mainBinCount = 1;
    mainBinWidth = 1; // nominal width
  }
  
  const bins = [];
  
  // Lower extreme bin (< 5th percentile)
  if (p5Index > 0) {
    bins.push({
      min: absoluteMin,
      max: p5Value,
      count: 0,
      municipalities: [],
      isExtreme: true,
      extremeType: 'lower'
    });
  }
  
  // Main bins (5th to 95th percentile)
  for (let i = 0; i < mainBinCount; i++) {
    bins.push({
      min: p95Value === p5Value ? p5Value : p5Value + i * mainBinWidth,
      max: p95Value === p5Value ? p95Value : p5Value + (i + 1) * mainBinWidth,
      count: 0,
      municipalities: [],
      isExtreme: false
    });
  }
  
  // Upper extreme bin (> 95th percentile)
  if (p95Index < totalCount - 1) {
    bins.push({
      min: p95Value,
      max: absoluteMax,
      count: 0,
      municipalities: [],
      isExtreme: true,
      extremeType: 'upper'
    });
  }

  // Fill bins
  histogramData.value.forEach(item => {
    let value;
    value = item[props.dataType]?.[props.attributeName];
    
    if (props.populationNormalized && item.populationData?.population) {
      value = (value / item.populationData.population) * 1000;
    } else if (props.unit === '%' && props.attributeName === 'bicycleInfrastructureRatio' && value < 1) {
      value = value * 100; // Convert ratio to percentage
    }
    if (value !== null && value !== undefined && !isNaN(Number(value))) {
      let binIndex = -1;
      
      // Determine which bin this value belongs to
      if (value < p5Value && bins[0]?.isExtreme && bins[0]?.extremeType === 'lower') {
        // Lower extreme bin
        binIndex = 0;
      } else if (value > p95Value && bins[bins.length - 1]?.isExtreme && bins[bins.length - 1]?.extremeType === 'upper') {
        // Upper extreme bin
        binIndex = bins.length - 1;
      } else {
        // Find appropriate main bin
        const mainBinStartIndex = bins[0]?.isExtreme && bins[0]?.extremeType === 'lower' ? 1 : 0;
        const mainBinEndIndex = bins[bins.length - 1]?.isExtreme && bins[bins.length - 1]?.extremeType === 'upper' ? bins.length - 2 : bins.length - 1;
        
        if (p95Value === p5Value) {
          // All main values are the same
          binIndex = mainBinStartIndex;
        } else {
          const relativeBinIndex = Math.floor((value - p5Value) / mainBinWidth);
          binIndex = mainBinStartIndex + Math.max(0, Math.min(relativeBinIndex, mainBinEndIndex - mainBinStartIndex));
        }
      }
      
      if (binIndex >= 0 && binIndex < bins.length && bins[binIndex]) {
        bins[binIndex].count++;
        bins[binIndex].municipalities.push({
          ...item,
          value
        });
      }
    }
  });

  // Find current value bin
  let currentValueBinIndex = -1;
  if (props.currentValue !== null && !isNaN(Number(props.currentValue))) {
    const currentValue = props.currentValue;
    
    if (currentValue < p5Value && bins[0]?.isExtreme && bins[0]?.extremeType === 'lower') {
      // Current value is in lower extreme bin
      currentValueBinIndex = 0;
    } else if (currentValue > p95Value && bins[bins.length - 1]?.isExtreme && bins[bins.length - 1]?.extremeType === 'upper') {
      // Current value is in upper extreme bin
      currentValueBinIndex = bins.length - 1;
    } else {
      // Current value is in main bins
      const mainBinStartIndex = bins[0]?.isExtreme && bins[0]?.extremeType === 'lower' ? 1 : 0;
      const mainBinEndIndex = bins[bins.length - 1]?.isExtreme && bins[bins.length - 1]?.extremeType === 'upper' ? bins.length - 2 : bins.length - 1;
      
      if (p95Value === p5Value) {
        // All main values are the same
        currentValueBinIndex = mainBinStartIndex;
      } else {
        const relativeBinIndex = Math.floor((currentValue - p5Value) / mainBinWidth);
        currentValueBinIndex = mainBinStartIndex + Math.max(0, Math.min(relativeBinIndex, mainBinEndIndex - mainBinStartIndex));
      }
    }
  }

  return {
    labels: bins.map(bin => {
      if (bin.isExtreme) {
        if (bin.extremeType === 'lower') {
          return `< ${formatValue(bin.max)}`;
        } else {
          return `> ${formatValue(bin.min)}`;
        }
      } else {
        return `${formatValue(bin.min)}-${formatValue(bin.max)}`;
      }
    }),
    datasets: [
      {
        label: $t('stats.histogram.frequency'),
        data: bins.map(bin => bin.count),
        backgroundColor: bins.map((bin, index) => {
          if (index === currentValueBinIndex) {
            return '#ef4444'; // Current value - red
          } else if (bin.isExtreme) {
            return '#f59e0b'; // Extreme values - amber
          } else {
            return '#3b82f6'; // Normal values - blue
          }
        }),
        borderColor: bins.map((bin, index) => {
          if (index === currentValueBinIndex) {
            return '#dc2626'; // Current value - darker red
          } else if (bin.isExtreme) {
            return '#d97706'; // Extreme values - darker amber
          } else {
            return '#2563eb'; // Normal values - darker blue
          }
        }),
        borderWidth: 1,
        bins: bins // Store bins for click handling
      }
    ]
  };
});

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false
    },
    tooltip: {
      callbacks: {
        label: (context) => {
          return `${context.parsed.y} ${$t('stats.histogram.municipalities')}`;
        }
      }
    }
  },
  scales: {
    x: {
      title: {
        display: true,
        text: props.unit
      }
    },
    y: {
      title: {
        display: true,
        text: $t('stats.histogram.count')
      },
      beginAtZero: true
    }
  },
  onHover: (event, elements) => {
    event.native.target.style.cursor = elements.length > 0 ? 'pointer' : 'default';
  },
  onClick: (event, elements) => {
    if (elements.length > 0) {
      const index = elements[0].index;
      const bins = chartData.value.datasets[0].bins;
      selectedBinMunicipalities.value = bins[index].municipalities;
      openModal();
    }
  }
}));

// Helper function to get nested object values
function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

// Format values for display
function formatValue(value) {
  if (value === null || value === undefined) return '-';
  if (value < 1) return value.toFixed(2);
  if (value < 10) return value.toFixed(1);
  return Math.round(value).toString();
}



function openModal() {
  if (modalRef.value) {
    modalRef.value.showModal();
  }
}

function closeModal() {
  if (modalRef.value) {
    modalRef.value.close();
  }
  selectedBinMunicipalities.value = [];
}

// Fetch data on mount and when props change
async function fetchData() {
  if (!props.dataType || !props.attributeName) return;
  
  loading.value = true;
  try {
    console.log('Fetching histogram data for:', props.dataType, props.attributeName);
    const data = await $stadtlandzahlAPI.fetchHistogramData(props.dataType, props.attributeName);
    console.log('Raw histogram data:', data);
    console.log('Data length:', data?.length);
    
    // Log sample values
    if (data?.length > 0) {
      const sampleItem = data[0];
      console.log('Sample item:', sampleItem);
      
      let sampleValue;
      switch (props.dataType) {
        case 'solarPower':
          sampleValue = sampleItem.solarPowerData?.[props.attributeName];
          break;
        case 'windPower':
          sampleValue = sampleItem.windPowerData?.[props.attributeName];
          break;
        case 'evCharging':
          sampleValue = sampleItem.evChargingData?.[props.attributeName];
          break;
        case 'cyclewayInfrastructure':
          sampleValue = sampleItem.cyclewayInfrastructureData?.[props.attributeName];
          break;
        default:
          sampleValue = getNestedValue(sampleItem, props.attributeName);
      }
      
      console.log('Sample value:', sampleValue);
      console.log('Trying to extract:', `${props.dataType}Data.${props.attributeName}`);
    }
    
    histogramData.value = data;
  } catch (error) {
    console.error('Error fetching histogram data:', error);
    histogramData.value = [];
  } finally {
    loading.value = false;
  }
}

onMounted(fetchData);
watch([() => props.dataType, () => props.attributeName], fetchData);
</script>
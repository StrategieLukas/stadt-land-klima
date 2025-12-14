<template>
  <div class="relative">
    <!-- Loading state -->
    <div v-if="loading" class="flex items-center justify-center py-8">
      <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      <span class="ml-2 text-sm text-gray-600">{{ $t('generic.loading') }}...</span>
    </div>
    
    <!-- Chart -->
    <div v-else-if="chartData" class="w-full h-64 relative" ref="chartContainerRef">
      <Bar ref="chartRef" :data="chartData" :options="chartOptions" :plugins="[municipalityLinePlugin]" />
      
      <!-- Value Marker -->
      <div 
        v-if="currentValue !== null && markerPosition !== null"
        class="absolute pointer-events-none"
        :style="{
          left: markerPosition + '%',
          top: '10px',
          transform: 'translateX(-50%)'
        }"
      >
        <div class="flex flex-col items-center">
          <div class="bg-blue-600 text-white text-xs px-2 py-1 rounded whitespace-nowrap shadow-lg font-semibold">
            {{ municipalityName || $t('stats.your_municipality') }}
          </div>
          <div class="w-0 h-0 border-l-4 border-r-4 border-t-8 border-l-transparent border-r-transparent border-t-blue-600"></div>
        </div>
      </div>
    </div>
    
    <!-- No data message -->
    <div v-else class="text-center py-8 text-gray-500 text-sm">
      {{ $t('stats.histogram.no_data') }}
    </div>
    
    <!-- Loading bin data overlay -->
    <div v-if="loadingBinData" class="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10">
      <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      <span class="ml-2 text-sm text-gray-600">{{ $t('generic.loading') }}...</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue';
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

const runtimeConfig = useRuntimeConfig();
const stadtlandzahlURL = runtimeConfig.public.stadtlandzahlUrl;
const stadtlandzahlBaseURL = stadtlandzahlURL.replace('/graphql/', '').replace('/graphql', '')

// Register Chart.js components
ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale);

const emit = defineEmits(['bin-click']);

const props = defineProps({
  histogramUrl: {
    type: String,
    required: true
  },
  currentValue: {
    type: Number,
    default: null
  },
  municipalityName: {
    type: String,
    default: null
  },
  unit: {
    type: String,
    default: ''
  },
  dataProductName: {
    type: String,
    default: ''
  },
  orangeThreshold: {
    type: Number,
    default: null
  },
  yellowThreshold: {
    type: Number,
    default: null
  },
  lightGreenThreshold: {
    type: Number,
    default: null
  },
  darkGreenThreshold: {
    type: Number,
    default: null
  },
  populationNormalized: {
    type: Boolean,
    default: false
  },
  population: {
    type: Number,
    default: null
  },
  isPercentage: {
    type: Boolean,
    default: false
  }
});

const { $t } = useNuxtApp();
const loading = ref(false);
const histogramApiData = ref(null);
const binDetailsData = ref(null); // Stores threshold breakdown for all bins
const chartRef = ref(null);
const chartContainerRef = ref(null);

const displayUnit = computed(() => {
  let unit = props.unit || '';
  if (props.isPercentage) {
    unit = '%';
  } else if (props.populationNormalized) {
    unit += " / 1000 " + $t('stats.inhabitants_abbrev');
  }
  return unit;
});
const loadingBinData = ref(false);
const histogramId = ref(null);
const clickedBinIndex = ref(null);

const markerPosition = computed(() => {
  if (props.currentValue === null || !histogramApiData.value?.bin_edges || !histogramApiData.value?.bin_counts) {
    return null;
  }
  
  let valueToCompare = props.currentValue;
  
  let binEdges = histogramApiData.value.bin_edges;
  const binCounts = histogramApiData.value.bin_counts;
  
  // Transform both value and bin edges if population normalization is enabled
  if (props.populationNormalized && props.population) {
    valueToCompare = valueToCompare / props.population * 1000;
    binEdges = binEdges.map(edge => edge / props.population * 1000);
  }
  
  const numBins = binCounts.length;
  
  // Find which bin the current value falls into
  let currentValueBinIndex = -1;
  let binStart = 0;
  let binEnd = 0;
  
  for (let i = 0; i < numBins; i++) {
    binStart = binEdges[i];
    binEnd = binEdges[i + 1];
    
    if (valueToCompare >= binStart && valueToCompare < binEnd) {
      currentValueBinIndex = i;
      break;
    }
  }
  
  // If value is exactly at the max edge, put it in the last bin
  if (currentValueBinIndex === -1 && valueToCompare === binEdges[binEdges.length - 1]) {
    currentValueBinIndex = numBins - 1;
    binStart = binEdges[currentValueBinIndex];
    binEnd = binEdges[currentValueBinIndex + 1];
  }
  
  if (currentValueBinIndex === -1) {
    return null; // Value is outside the histogram range
  }
  
  // Try to use Chart.js scales for accurate positioning
  if (chartRef.value?.chart && chartContainerRef.value) {
    try {
      const chart = chartRef.value.chart;
      const xScale = chart.scales.x;
      const containerWidth = chartContainerRef.value.offsetWidth;
      
      if (xScale && containerWidth > 0) {
        // Calculate the exact position within the bin
        const binStartPixel = xScale.getPixelForValue(currentValueBinIndex) - (xScale.getPixelForValue(1) - xScale.getPixelForValue(0)) / 2;
        const binEndPixel = xScale.getPixelForValue(currentValueBinIndex) + (xScale.getPixelForValue(1) - xScale.getPixelForValue(0)) / 2;
        
        // Calculate the relative position of the value within the bin (0 to 1)
        const relativePosition = (valueToCompare - binStart) / (binEnd - binStart);
        
        // Calculate the exact x position
        const exactPixelPosition = binStartPixel + relativePosition * (binEndPixel - binStartPixel);
        
        // Convert to percentage of container width
        const percentage = (exactPixelPosition / containerWidth) * 100;
        return percentage;
      }
    } catch (error) {
      console.warn('Could not calculate marker position using chart scales:', error);
    }
  }
  
  // Fallback to simple calculation
  // Calculate the relative position within the bin
  const relativePosition = (valueToCompare - binStart) / (binEnd - binStart);
  
  // Each bin takes up (100 / numBins)% of the width
  const binWidth = 100 / numBins;
  const binStartPercent = currentValueBinIndex * binWidth;
  const exactPosition = binStartPercent + relativePosition * binWidth;
  
  return exactPosition;
});

const getBarColor = (binMidpoint) => {
  if (props.orangeThreshold === null && props.yellowThreshold === null && 
      props.lightGreenThreshold === null && props.darkGreenThreshold === null) {
    return '#9ca3af';
  }
  
  // binMidpoint is already in normalized format (if normalization was applied)
  // thresholds should be in the same format
  if (props.darkGreenThreshold !== null && binMidpoint >= props.darkGreenThreshold) {
    return '#22c55e';
  } else if (props.lightGreenThreshold !== null && binMidpoint >= props.lightGreenThreshold) {
    return '#84cc16';
  } else if (props.yellowThreshold !== null && binMidpoint >= props.yellowThreshold) {
    return '#eab308';
  } else if (props.orangeThreshold !== null && binMidpoint >= props.orangeThreshold) {
    return '#f97316';
  } else {
    return '#ef4444';
  }
};

const getDarkerColor = (color) => {
  const colorMap = {
    '#9ca3af': '#6b7280',
    '#22c55e': '#16a34a',
    '#84cc16': '#65a30d',
    '#eab308': '#ca8a04',
    '#f97316': '#ea580c',
    '#ef4444': '#dc2626',
  };
  return colorMap[color] || color;
};

const getThresholdRanges = () => {
  const ranges = [];
  
  // Get normalized thresholds for display if needed
  let orangeThreshold = props.orangeThreshold;
  let yellowThreshold = props.yellowThreshold; 
  let lightGreenThreshold = props.lightGreenThreshold;
  let darkGreenThreshold = props.darkGreenThreshold;
  
  // Note: Thresholds are already in the correct format (normalized if needed)
  // so we don't need to transform them here
  
  // Below orange (red)
  if (orangeThreshold !== null) {
    ranges.push({ key: 'below_orange', label: '< ' + formatValue(orangeThreshold), color: '#ef4444' });
  }
  
  // Orange to yellow
  if (orangeThreshold !== null && yellowThreshold !== null) {
    ranges.push({ key: 'orange_to_yellow', label: formatValue(orangeThreshold) + ' - ' + formatValue(yellowThreshold), color: '#f97316' });
  }
  
  // Yellow to light green
  if (yellowThreshold !== null && lightGreenThreshold !== null) {
    ranges.push({ key: 'yellow_to_lightgreen', label: formatValue(yellowThreshold) + ' - ' + formatValue(lightGreenThreshold), color: '#eab308' });
  }
  
  // Light green to dark green
  if (lightGreenThreshold !== null && darkGreenThreshold !== null) {
    ranges.push({ key: 'lightgreen_to_darkgreen', label: formatValue(lightGreenThreshold) + ' - ' + formatValue(darkGreenThreshold), color: '#84cc16' });
  }
  
  // Above dark green
  if (darkGreenThreshold !== null) {
    ranges.push({ key: 'above_darkgreen', label: '≥ ' + formatValue(darkGreenThreshold), color: '#22c55e' });
  }
  
  // If no thresholds, return single gray range
  if (ranges.length === 0) {
    ranges.push({ key: 'all', label: 'All', color: '#9ca3af' });
  }
  
  return ranges;
};

const formatValue = (value) => {
  if (value === null || value === undefined) return '-';
  
  // Convert to percentage if needed (histogram values are in decimal form 0-1)
  let displayValue = value;
  if (props.isPercentage) {
    displayValue = value * 100;
  }
  
  // Format based on magnitude
  if (displayValue < 0.01 && displayValue > 0) return displayValue.toFixed(3);
  if (displayValue < 1) return displayValue.toFixed(2);
  if (displayValue < 10) return displayValue.toFixed(1);
  return Math.round(displayValue).toString();
};

const chartData = computed(() => {
  if (!histogramApiData.value?.bin_edges || !histogramApiData.value?.bin_counts) {
    return null;
  }

  let binEdges = histogramApiData.value.bin_edges;
  const binCounts = histogramApiData.value.bin_counts;
  
  // Transform bin edges if population normalization is enabled
  // API returns raw values, we need to normalize them for display to match currentValue format
  
  if (props.populationNormalized && props.population) {
    binEdges = binEdges.map(edge => edge / props.population * 1000);
  }
  
  const labels = [];
  const bins = [];
  
  for (let i = 0; i < binCounts.length; i++) {
    const binStart = binEdges[i];
    const binEnd = binEdges[i + 1];
    
    const binMidpoint = (binStart + binEnd) / 2;
    
    // Format the label with appropriate units
    let label = `${formatValue(binStart)}-${formatValue(binEnd)}`;
    if (props.isPercentage) {
      label += '%';
    }
    
    labels.push(label);
    bins.push({
      count: binCounts[i],
      midpoint: binMidpoint,
      start: binStart,
      end: binEnd
    });
  }
  
  let currentValueBinIndex = -1;
  if (props.currentValue !== null && !isNaN(Number(props.currentValue))) {
    // Normalize the current value the same way as bin edges if needed
    let normalizedCurrentValue = props.currentValue;
    if (props.populationNormalized && props.population) {
      normalizedCurrentValue = normalizedCurrentValue / props.population * 1000;
    }
    
    currentValueBinIndex = bins.findIndex(bin => 
      normalizedCurrentValue >= bin.start && normalizedCurrentValue < bin.end
    );
  }
  
  // Check if we have thresholds defined
  const hasThresholds = props.orangeThreshold !== null || props.yellowThreshold !== null || 
                        props.lightGreenThreshold !== null || props.darkGreenThreshold !== null;
  
  // If we have detailed bin data with threshold breakdowns, create stacked bars
  if (hasThresholds && binDetailsData.value?.bin_details) {
    const thresholdRanges = getThresholdRanges();
    const datasets = thresholdRanges.map(range => ({
      label: range.label,
      data: bins.map((bin, index) => {
        const binDetail = binDetailsData.value.bin_details.find(bd => bd.bin_index === index);
        return binDetail?.threshold_counts?.[range.key] || 0;
      }),
      backgroundColor: range.color,
      borderColor: bins.map((bin, index) => {
        if (index === clickedBinIndex.value) {
          return '#2563eb';
        }
        return range.color;
      }),
      borderWidth: bins.map((bin, index) => index === clickedBinIndex.value ? 3 : 1),
      stack: 'stack1'
    }));
    
    return {
      labels,
      datasets
    };
  }
  
  // Fallback to simple bar chart if no threshold data available
  return {
    labels,
    datasets: [{
      label: $t('stats.histogram.frequency'),
      data: bins.map(bin => bin.count),
      backgroundColor: bins.map((bin, index) => {
        return getBarColor(bin.midpoint);
      }),
      borderColor: bins.map((bin, index) => {
        if (index === clickedBinIndex.value) {
          return '#3b82f6'; // Blue border for clicked bin
        }
        return getDarkerColor(getBarColor(bin.midpoint));
      }),
      borderWidth: bins.map((bin, index) => {
        if (index === clickedBinIndex.value) {
          return 3; // Thicker border for clicked bin
        }
        return 1;
      })
    }]
  };
});

// Chart.js plugin to draw a dashed line at the municipality value
const municipalityLinePlugin = {
  id: 'municipalityLine',
  afterDatasetsDraw: (chart) => {
    if (props.currentValue === null || !histogramApiData.value?.bin_edges) {
      return;
    }

    let valueToCompare = props.currentValue;

    let binEdges = histogramApiData.value.bin_edges;
    const binCounts = histogramApiData.value.bin_counts;
    
    // Transform both value and bin edges if population normalization is enabled
    if (props.populationNormalized && props.population) {
      valueToCompare = valueToCompare / props.population * 1000;
      binEdges = binEdges.map(edge => edge / props.population * 1000);
    }
    
    const numBins = binCounts.length;

    // Find which bin the current value falls into
    let currentValueBinIndex = -1;
    let binStart = 0;
    let binEnd = 0;
    
    for (let i = 0; i < numBins; i++) {
      binStart = binEdges[i];
      binEnd = binEdges[i + 1];
      
      if (valueToCompare >= binStart && valueToCompare < binEnd) {
        currentValueBinIndex = i;
        break;
      }
    }

    // If value is exactly at the max edge, put it in the last bin
    if (currentValueBinIndex === -1 && valueToCompare === binEdges[binEdges.length - 1]) {
      currentValueBinIndex = numBins - 1;
      binStart = binEdges[currentValueBinIndex];
      binEnd = binEdges[currentValueBinIndex + 1];
    }

    if (currentValueBinIndex === -1) {
      return; // Value is outside the histogram range
    }

    const ctx = chart.ctx;
    const xScale = chart.scales.x;
    const yScale = chart.scales.y;

    // Calculate the exact position within the bin
    // Get the pixel positions for the start and end of the bin
    const binStartPixel = xScale.getPixelForValue(currentValueBinIndex) - (xScale.getPixelForValue(1) - xScale.getPixelForValue(0)) / 2;
    const binEndPixel = xScale.getPixelForValue(currentValueBinIndex) + (xScale.getPixelForValue(1) - xScale.getPixelForValue(0)) / 2;
    
    // Calculate the relative position of the value within the bin (0 to 1)
    const relativePosition = (valueToCompare - binStart) / (binEnd - binStart);
    
    // Calculate the exact x position
    const x = binStartPixel + relativePosition * (binEndPixel - binStartPixel);
    
    const yTop = yScale.top;
    const yBottom = yScale.bottom;

    // Draw the dashed line
    ctx.save();
    ctx.beginPath();
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = '#2563eb'; // Blue color
    ctx.lineWidth = 2;
    ctx.moveTo(x, yTop);
    ctx.lineTo(x, yBottom);
    ctx.stroke();
    ctx.restore();
  }
};

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: binDetailsData.value?.bin_details ? true : false,
      position: 'bottom'
    },
    municipalityLine: {},
    tooltip: {
      mode: 'x',
      intersect: false,
      callbacks: {
        title: (tooltipItems) => {
          // Show the bin range as the title
          if (tooltipItems.length > 0) {
            return tooltipItems[0].label;
          }
          return '';
        },
        label: (context) => {
          const label = context.dataset.label || '';
          // For stacked bars, use the raw data value, not the parsed y value
          const value = context.dataset.data[context.dataIndex] || 0;
          return `${label}: ${value} ${$t('stats.histogram.municipalities')}`;
        },
        footer: (tooltipItems) => {
          if (binDetailsData.value?.bin_details) {
            // Sum the actual data values, not the parsed y values
            const total = tooltipItems.reduce((sum, item) => {
              const value = item.dataset.data[item.dataIndex] || 0;
              return sum + value;
            }, 0);
            return `Total: ${total} ${$t('stats.histogram.municipalities')}`;
          }
          return '';
        }
      }
    }
  },
  scales: {
    x: {
      stacked: true,
      title: {
        display: true,
        text: props.dataProductName + (displayUnit.value ? ` (${displayUnit.value})` : '')
      }
    },
    y: {
      stacked: true,
      title: {
        display: true,
        text: 'Anzahl an Kommunen'
      },
      beginAtZero: true
    }
  },
  onClick: async (event, elements) => {
    if (elements.length > 0 && histogramId.value !== null) {
      const clickedIndex = elements[0].index;
      await fetchBinData(clickedIndex);
    }
  }
}));

async function fetchBinData(binIndex) {
  if (!histogramId.value || loadingBinData.value) return;
  
  loadingBinData.value = true;
  clickedBinIndex.value = binIndex;
  try {
    const url = `${stadtlandzahlBaseURL}/api/histograms/${histogramId.value}/bins/${binIndex}/areas/?format=json`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const binData = await response.json();
    
    // Calculate threshold breakdown for this bin
    if (binDetailsData.value && binData.areas) {
      const binDetail = binDetailsData.value.bin_details.find(bd => bd.bin_index === binIndex);
      if (binDetail) {
        binDetail.areas_fetched = true;
      }
    }
    
    emit('bin-click', binData);
  } catch (error) {
    console.error('Error fetching bin data:', error);
  } finally {
    loadingBinData.value = false;
  }
}

async function fetchData() {
  loading.value = true;
  try {
    const url = props.histogramUrl.includes('?') 
      ? `${props.histogramUrl}&format=json` 
      : `${props.histogramUrl}?format=json`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    const result = data?.results?.[0];
    
    if (result?.bin_edges && result?.bin_counts) {
      histogramApiData.value = result;
      histogramId.value = result.id;
      
      // Calculate threshold breakdown by fetching all bin data
      await calculateThresholdBreakdown();
    } else {
      console.warn('No histogram data found in API response');
      histogramApiData.value = null;
      histogramId.value = null;
    }
  } catch (error) {
    console.error('Error fetching histogram data:', error);
    histogramApiData.value = null;
    histogramId.value = null;
  } finally {
    loading.value = false;
  }
}

function categorizeValueByThreshold(value) {
  if (value === null || value === undefined) return null;
  
  // The value from the API is in raw format, but thresholds might be in normalized format
  // We need to normalize the value if population normalization is enabled
  let valueToCompare = value;
  if (props.populationNormalized && props.population) {
    valueToCompare = value / props.population * 1000;
  }
  
  // Categorize based on thresholds (thresholds should be in the same format as the normalized value)
  if (props.darkGreenThreshold !== null && valueToCompare >= props.darkGreenThreshold) {
    return 'above_darkgreen';
  } else if (props.lightGreenThreshold !== null && valueToCompare >= props.lightGreenThreshold) {
    return 'lightgreen_to_darkgreen';
  } else if (props.yellowThreshold !== null && valueToCompare >= props.yellowThreshold) {
    return 'yellow_to_lightgreen';
  } else if (props.orangeThreshold !== null && valueToCompare >= props.orangeThreshold) {
    return 'orange_to_yellow';
  } else {
    return 'below_orange';
  }
}

async function calculateThresholdBreakdown() {
  if (!histogramId.value) return;
  
  try {
    // Check if we have thresholds
    const hasThresholds = props.orangeThreshold !== null || props.yellowThreshold !== null || 
                          props.lightGreenThreshold !== null || props.darkGreenThreshold !== null;
    if (!hasThresholds) return;
    
    const binCounts = histogramApiData.value?.bin_counts || [];
    
    // Fetch all bins in parallel
    const fetchPromises = [];
    for (let binIndex = 0; binIndex < binCounts.length; binIndex++) {
      const url = `${stadtlandzahlBaseURL}/api/histograms/${histogramId.value}/bins/${binIndex}/areas/?format=json`;
      fetchPromises.push(
        fetch(url)
          .then(response => response.ok ? response.json() : null)
          .then(binData => ({ binIndex, binData }))
          .catch(error => {
            console.warn(`Could not fetch data for bin ${binIndex}:`, error);
            return { binIndex, binData: null };
          })
      );
    }
    
    // Wait for all requests to complete
    const results = await Promise.all(fetchPromises);
    
    // Process results and calculate threshold counts
    const binDetails = results
      .filter(result => result.binData && result.binData.areas)
      .map(result => {
        const thresholdCounts = {
          below_orange: 0,
          orange_to_yellow: 0,
          yellow_to_lightgreen: 0,
          lightgreen_to_darkgreen: 0,
          above_darkgreen: 0
        };
        
        result.binData.areas.forEach(area => {
          const category = categorizeValueByThreshold(area.value);
          if (category && thresholdCounts.hasOwnProperty(category)) {
            thresholdCounts[category]++;
          }
        });
        
        return {
          bin_index: result.binIndex,
          threshold_counts: thresholdCounts
        };
      });
    
    if (binDetails.length > 0) {
      binDetailsData.value = { bin_details: binDetails };
    }
  } catch (error) {
    console.warn('Could not calculate threshold breakdown:', error);
    binDetailsData.value = null;
  }
}

// Force re-computation of marker position when chart is ready
watch([chartRef, () => chartData.value], async () => {
  if (chartRef.value && chartData.value) {
    // Wait for next tick to ensure chart is rendered
    await nextTick();
    // Trigger a re-compute by accessing the computed property
    // This ensures markerPosition recalculates after chart is fully rendered
    markerPosition.value;
  }
}, { flush: 'post' });

onMounted(() => {
  fetchData();
});
</script>

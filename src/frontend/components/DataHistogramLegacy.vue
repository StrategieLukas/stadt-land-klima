<template>
  <div class="relative">
    <!-- Loading state -->
    <div v-if="loading" class="flex items-center justify-center gap-2 py-8">
      <SlkFlowerSpinner :size="24" />
      <span class="text-sm text-gray-600">{{ $t("generic.loading") }}...</span>
    </div>

    <!-- Chart -->
    <div v-else-if="chartData && chartData.datasets.length > 0" class="h-64 w-full">
      <Bar ref="chartRef" :data="chartData" :options="chartOptions" />
    </div>

    <!-- No data message -->
    <div v-else class="py-8 text-center text-sm text-gray-500">
      {{ $t("stats.histogram.no_data") }}
    </div>

    <!-- Modal for municipalities in selected bin -->
    <dialog ref="modalRef" class="modal">
      <div class="modal-box w-fit max-w-4xl">
        <form method="dialog">
          <button class="btn absolute top-2 right-2 btn-circle btn-ghost btn-sm">✕</button>
        </form>
        <h3 class="mb-4 text-lg font-bold">{{ $t("stats.histogram.municipalities_in_range") }}</h3>
        <div class="overflow-x-auto">
          <table class="table w-full table-xs">
            <thead>
              <tr>
                <th>{{ $t("administrative_areas.prefix") }}</th>
                <th>{{ $t("administrative_areas.name") }}</th>
                <th>{{ $t("stats.value") }}</th>
                <th>{{ $t("stats.action") }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="municipality in selectedBinMunicipalities" :key="municipality.ars" class="hover">
                <td class="text-right">{{ municipality.prefix }}</td>
                <td class="text-left font-medium">{{ municipality.name }}</td>
                <td>
                  <span class="badge font-mono text-sm badge-neutral">{{ formatValue(municipality.value) }}</span>
                </td>
                <td>
                  <NuxtLink :to="`/data/${municipality.ars}`" class="btn btn-primary btn-xs">
                    {{ $t("stats.view_stats") }}
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

<script setup lang="ts">
import type { ChartOptions, ChartEvent, ActiveElement } from "chart.js";
import {
  legacyHistogramValue,
  type Histogram,
  type HistogramBin,
  type HistogramMunicipality,
} from "~/shared/contracts/histogram";
import type { Area } from "~/shared/contracts/search";
import type { PropType } from "vue";

import { ref, computed, onMounted, watch } from "vue";

import { Bar } from "vue-chartjs";
import { Chart as ChartJS, Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale } from "chart.js";

// Register Chart.js components
ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale);

const props = defineProps({
  histogramUrl: {
    type: String as PropType<string | null | undefined>,
    default: null,
  },
  dataType: {
    type: String as PropType<string | undefined>,
    required: false,
  },
  attributeName: {
    type: String as PropType<string | undefined>,
    required: false,
  },
  currentValue: {
    type: Number as PropType<number | null | undefined>,
    default: null,
  },
  unit: {
    type: String as PropType<string | undefined>,
    default: "",
  },
  populationNormalized: {
    type: Boolean as PropType<boolean | undefined>,
    default: false,
  },
  orangeThreshold: {
    type: Number as PropType<number | null | undefined>,
    default: null,
  },
  yellowThreshold: {
    type: Number as PropType<number | null | undefined>,
    default: null,
  },
  lightGreenThreshold: {
    type: Number as PropType<number | null | undefined>,
    default: null,
  },
  darkGreenThreshold: {
    type: Number as PropType<number | null | undefined>,
    default: null,
  },
});

const { $t, $stadtlandzahlAPI } = useNuxtApp();

const loading = ref(false);
const histogramData = ref<Area[]>([]);
const histogramApiData = ref<Histogram | null>(null); // For new API format
const modalRef = ref<HTMLDialogElement | null>(null);
const selectedBinMunicipalities = ref<HistogramMunicipality[]>([]);

// Map dataType to GraphQL field names (used for legacy histogram data access)
const dataTypeToGraphQLField: Record<string, string> = {
  population_data: "populationData",
  ev_charging_data: "evChargingData",
  wind_power_data: "windPowerData",
  solar_power_data: "solarPowerData",
  public_transport_score_data: "publicTransportScoreData",
  cycleway_infrastructure_data: "cyclewayInfrastructureData",
};

// Helper function to determine bar color based on bin value and thresholds
const getBarColor = (binMidpoint: number) => {
  // If no thresholds are provided, use gray
  if (
    props.orangeThreshold === null &&
    props.yellowThreshold === null &&
    props.lightGreenThreshold === null &&
    props.darkGreenThreshold === null
  ) {
    return "#9ca3af"; // gray-400
  }

  // Color based on thresholds
  if (props.darkGreenThreshold !== null && binMidpoint >= props.darkGreenThreshold) {
    return "#22c55e"; // green-500 (dark green)
  } else if (props.lightGreenThreshold !== null && binMidpoint >= props.lightGreenThreshold) {
    return "#84cc16"; // lime-500 (light green)
  } else if (props.yellowThreshold !== null && binMidpoint >= props.yellowThreshold) {
    return "#eab308"; // yellow-500
  } else if (props.orangeThreshold !== null && binMidpoint >= props.orangeThreshold) {
    return "#f97316"; // orange-500
  } else {
    return "#ef4444"; // red-500 (below all thresholds)
  }
};

const getDarkerColor = (color: string) => {
  const colorMap: Record<string, string> = {
    "#9ca3af": "#6b7280", // gray
    "#22c55e": "#16a34a", // dark green
    "#84cc16": "#65a30d", // light green
    "#eab308": "#ca8a04", // yellow
    "#f97316": "#ea580c", // orange
    "#ef4444": "#dc2626", // red
  };
  return colorMap[color] || color;
};

// Calculate histogram bins and chart data
const chartData = computed(() => {
  console.log("=== CHART DATA COMPUTED START ===");
  console.log("histogramApiData.value:", histogramApiData.value);
  console.log("histogramApiData.value type:", typeof histogramApiData.value);
  console.log("Is histogramApiData.value null?", histogramApiData.value === null);
  console.log("histogramApiData.value?.bin_edges:", histogramApiData.value?.bin_edges);
  console.log("histogramApiData.value?.bin_counts:", histogramApiData.value?.bin_counts);
  console.log("histogramData (legacy):", histogramData.value?.length);

  // New API format with bin_edges and bin_counts
  if (histogramApiData.value?.bin_edges && histogramApiData.value?.bin_counts) {
    const binEdges = histogramApiData.value.bin_edges;
    const histogram = histogramApiData.value.bin_counts;

    console.log("✓ Using new API format");
    console.log("Bin edges length:", binEdges.length);
    console.log("Histogram length:", histogram.length);
    console.log("First 5 bin edges:", binEdges.slice(0, 5));
    console.log("First 5 histogram values:", histogram.slice(0, 5));

    // Create labels from bin edges
    const labels = [];
    const bins = [];

    for (let i = 0; i < histogram.length; i++) {
      const binStart = binEdges[i]!;
      const binEnd = binEdges[i + 1]!;
      const binMidpoint = (binStart + binEnd) / 2;

      labels.push(`${formatValue(binStart)}-${formatValue(binEnd)}`);
      bins.push({
        count: histogram[i]!,
        midpoint: binMidpoint,
        start: binStart,
        end: binEnd,
      });
    }

    // Find which bin contains the current value
    let currentValueBinIndex = -1;
    if (props.currentValue !== null && !isNaN(Number(props.currentValue))) {
      currentValueBinIndex = bins.findIndex((bin) => props.currentValue! >= bin.start && props.currentValue! < bin.end);
    }

    return {
      labels,
      datasets: [
        {
          label: $t("stats.histogram.frequency"),
          data: bins.map((bin) => bin.count),
          backgroundColor: bins.map((bin, index) => {
            // Highlight current value bin in red
            if (index === currentValueBinIndex) {
              return "#ef4444";
            }
            return getBarColor(bin.midpoint);
          }),
          borderColor: bins.map((bin, index) => {
            if (index === currentValueBinIndex) {
              return "#dc2626";
            }
            return getDarkerColor(getBarColor(bin.midpoint));
          }),
          borderWidth: 1,
          bins: bins,
        },
      ],
    };
  }

  // Legacy format fallback
  if (!histogramData.value.length) return null;

  const dataField = dataTypeToGraphQLField[props.dataType ?? ""] || `${props.dataType}Data`;

  // Convert snake_case attribute names to camelCase for accessing GraphQL data
  const snakeToCamel = (str: string | undefined) => {
    return (str ?? "").replace(/_([a-z])/g, (_match: string, letter: string) => letter.toUpperCase());
  };
  const attributeFieldName = snakeToCamel(props.attributeName);

  const values = histogramData.value
    .map((item) => {
      let value;

      // Access data using mapped GraphQL field name and camelCase attribute
      value = legacyHistogramValue(item, dataField, attributeFieldName);

      if (value != null && props.populationNormalized && legacyHistogramValue(item, "populationData", "population")) {
        value = (value / legacyHistogramValue(item, "populationData", "population")!) * 1000; // per 1000 inhabitants
      } else if (
        props.unit === "%" &&
        attributeFieldName === "bicycleInfrastructureRatio" &&
        value != null &&
        value < 1
      ) {
        value = value * 100; // Convert ratio to percentage
      }
      return value;
    })
    .filter((v): v is number => v != null && Number.isFinite(v));

  console.log("Processed values:", values.slice(0, 10)); // Log first 10 values
  console.log("Values length:", values.length);
  console.log("Min/Max:", Math.min(...values), Math.max(...values));

  if (!values.length) return null;

  // Sort values to find percentiles
  const sortedValues = [...values].sort((a, b) => a - b);
  const totalCount = sortedValues.length;

  // Calculate percentile indices
  const p5Index = Math.floor(totalCount * 0.05);
  const p95Index = Math.floor(totalCount * 0.95);

  // Get percentile values
  const p5Value = sortedValues[p5Index]!;
  const p95Value = sortedValues[p95Index]!;
  const absoluteMin = sortedValues[0]!;
  const absoluteMax = sortedValues[totalCount - 1]!;

  console.log("Percentiles - 5%:", p5Value, "95%:", p95Value, "Absolute min/max:", absoluteMin, absoluteMax);

  // Create bins for middle 90%
  let mainBinCount = Math.min(18, Math.max(3, Math.ceil(Math.sqrt(totalCount * 0.9)))); // Leave room for 2 extreme bins
  let mainBinWidth = (p95Value - p5Value) / mainBinCount;

  // Handle case where middle 90% values are the same
  if (p95Value === p5Value) {
    mainBinCount = 1;
    mainBinWidth = 1; // nominal width
  }

  const bins: HistogramBin[] = [];

  // Lower extreme bin (< 5th percentile)
  if (p5Index > 0) {
    bins.push({
      min: absoluteMin,
      max: p5Value,
      count: 0,
      municipalities: [],
      isExtreme: true,
      extremeType: "lower",
    });
  }

  // Main bins (5th to 95th percentile)
  for (let i = 0; i < mainBinCount; i++) {
    bins.push({
      min: p95Value === p5Value ? p5Value : p5Value + i * mainBinWidth,
      max: p95Value === p5Value ? p95Value : p5Value + (i + 1) * mainBinWidth,
      count: 0,
      municipalities: [],
      isExtreme: false,
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
      extremeType: "upper",
    });
  }

  // Fill bins
  const binDataField = dataTypeToGraphQLField[props.dataType ?? ""] || `${props.dataType}Data`;
  const binAttributeFieldName = snakeToCamel(props.attributeName);

  histogramData.value.forEach((item) => {
    let value;
    // Access data using mapped GraphQL field name and camelCase attribute
    value = legacyHistogramValue(item, binDataField, binAttributeFieldName);

    if (value != null && props.populationNormalized && legacyHistogramValue(item, "populationData", "population")) {
      value = (value / legacyHistogramValue(item, "populationData", "population")!) * 1000;
    } else if (
      props.unit === "%" &&
      binAttributeFieldName === "bicycleInfrastructureRatio" &&
      value != null &&
      value < 1
    ) {
      value = value * 100; // Convert ratio to percentage
    }
    if (value !== null && value !== undefined && !isNaN(Number(value))) {
      let binIndex = -1;

      // Determine which bin this value belongs to
      if (value < p5Value && bins[0]?.isExtreme && bins[0]?.extremeType === "lower") {
        // Lower extreme bin
        binIndex = 0;
      } else if (
        value > p95Value &&
        bins[bins.length - 1]?.isExtreme &&
        bins[bins.length - 1]?.extremeType === "upper"
      ) {
        // Upper extreme bin
        binIndex = bins.length - 1;
      } else {
        // Find appropriate main bin
        const mainBinStartIndex = bins[0]?.isExtreme && bins[0]?.extremeType === "lower" ? 1 : 0;
        const mainBinEndIndex =
          bins[bins.length - 1]?.isExtreme && bins[bins.length - 1]?.extremeType === "upper"
            ? bins.length - 2
            : bins.length - 1;

        if (p95Value === p5Value) {
          // All main values are the same
          binIndex = mainBinStartIndex;
        } else {
          const relativeBinIndex = Math.floor((value - p5Value) / mainBinWidth);
          binIndex = mainBinStartIndex + Math.max(0, Math.min(relativeBinIndex, mainBinEndIndex - mainBinStartIndex));
        }
      }

      if (binIndex >= 0 && binIndex < bins.length && bins[binIndex]) {
        bins[binIndex]!.count++;
        bins[binIndex]!.municipalities.push({
          ...item,
          value,
        });
      }
    }
  });

  // Find current value bin
  let currentValueBinIndex = -1;
  if (props.currentValue !== null && !isNaN(Number(props.currentValue))) {
    const currentValue = props.currentValue;

    if (currentValue < p5Value && bins[0]?.isExtreme && bins[0]?.extremeType === "lower") {
      // Current value is in lower extreme bin
      currentValueBinIndex = 0;
    } else if (
      currentValue > p95Value &&
      bins[bins.length - 1]?.isExtreme &&
      bins[bins.length - 1]?.extremeType === "upper"
    ) {
      // Current value is in upper extreme bin
      currentValueBinIndex = bins.length - 1;
    } else {
      // Current value is in main bins
      const mainBinStartIndex = bins[0]?.isExtreme && bins[0]?.extremeType === "lower" ? 1 : 0;
      const mainBinEndIndex =
        bins[bins.length - 1]?.isExtreme && bins[bins.length - 1]?.extremeType === "upper"
          ? bins.length - 2
          : bins.length - 1;

      if (p95Value === p5Value) {
        // All main values are the same
        currentValueBinIndex = mainBinStartIndex;
      } else {
        const relativeBinIndex = Math.floor((currentValue - p5Value) / mainBinWidth);
        currentValueBinIndex =
          mainBinStartIndex + Math.max(0, Math.min(relativeBinIndex, mainBinEndIndex - mainBinStartIndex));
      }
    }
  }

  return {
    labels: bins.map((bin) => {
      if (bin.isExtreme) {
        if (bin.extremeType === "lower") {
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
        label: $t("stats.histogram.frequency"),
        data: bins.map((bin) => bin.count),
        backgroundColor: bins.map((bin, index) => {
          if (index === currentValueBinIndex) {
            return "#ef4444"; // Current value - red
          } else if (bin.isExtreme) {
            return "#f59e0b"; // Extreme values - amber
          } else {
            return "#3b82f6"; // Normal values - blue
          }
        }),
        borderColor: bins.map((bin, index) => {
          if (index === currentValueBinIndex) {
            return "#dc2626"; // Current value - darker red
          } else if (bin.isExtreme) {
            return "#d97706"; // Extreme values - darker amber
          } else {
            return "#2563eb"; // Normal values - darker blue
          }
        }),
        borderWidth: 1,
        bins: bins, // Store bins for click handling
      },
    ],
  };
});

// Event handlers
const handleHover = (event: ChartEvent, elements: ActiveElement[]) => {
  if (event.native?.target instanceof HTMLElement) {
    event.native.target.style.cursor = elements.length > 0 ? "pointer" : "default";
  }
};

const handleClick = (event: ChartEvent, elements: ActiveElement[]) => {
  if (elements.length > 0) {
    const index = elements[0]!.index;
    const bins = chartData.value?.datasets?.[0]?.bins;
    if (bins && bins[index] && "municipalities" in bins[index]) {
      selectedBinMunicipalities.value = bins[index].municipalities;
      openModal();
    }
  }
};

const chartOptions = computed<ChartOptions<"bar">>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false,
    },
    tooltip: {
      callbacks: {
        label: (context) => {
          return `${context.parsed.y} ${$t("stats.histogram.municipalities")}`;
        },
      },
    },
  },
  scales: {
    x: {
      title: {
        display: true,
        text: props.unit,
      },
    },
    y: {
      title: {
        display: true,
        text: $t("stats.histogram.count"),
      },
      beginAtZero: true,
    },
  },
  onHover: handleHover,
  onClick: handleClick,
}));

// Helper function to get nested object values
function getNestedValue(obj: unknown, path: string | undefined): unknown {
  return (path ?? "")
    .split(".")
    .reduce<unknown>(
      (current, key) =>
        current && typeof current === "object" ? (current as Record<string, unknown>)[key] : undefined,
      obj,
    );
}

// Format values for display
function formatValue(value: number | null | undefined) {
  if (value === null || value === undefined) return "-";
  if (value < 1) return value.toFixed(2);
  if (value < 10) return value.toFixed(1);
  return Math.round(value).toString();
}

function openModal() {
  if (modalRef.value) {
    modalRef.value.showModal();
  }
}

function _closeModal() {
  if (modalRef.value) {
    modalRef.value.close();
  }
  selectedBinMunicipalities.value = [];
}

// Fetch data on mount and when props change
async function fetchData() {
  loading.value = true;
  try {
    console.log("Fetching histogram data for:", props.dataType, props.attributeName);
    const data = await $stadtlandzahlAPI.fetchHistogramData(props.dataType ?? "", props.attributeName ?? "");
    console.log("Raw histogram data:", data);
    console.log("Data length:", data?.length);

    // Log sample values
    if (data?.length > 0) {
      const sampleItem = data[0]!;
      console.log("Sample item:", sampleItem);

      let sampleValue;
      switch (props.dataType) {
        case "solar_power_data":
          sampleValue = legacyHistogramValue(sampleItem, "solarPowerData", props.attributeName ?? "");
          break;
        case "wind_power_data":
          sampleValue = legacyHistogramValue(sampleItem, "windPowerData", props.attributeName ?? "");
          break;
        case "ev_charging_data":
          sampleValue = legacyHistogramValue(sampleItem, "evChargingData", props.attributeName ?? "");
          break;
        case "cycleway_infrastructure_data":
          sampleValue = legacyHistogramValue(sampleItem, "cyclewayInfrastructureData", props.attributeName ?? "");
          break;
        case "public_transport_score_data":
          sampleValue = legacyHistogramValue(sampleItem, "publicTransportScoreData", props.attributeName ?? "");
          break;
        case undefined:
        default:
          sampleValue = getNestedValue(sampleItem, props.attributeName);
      }

      console.log("Sample value:", sampleValue);
      console.log("Trying to extract:", `${props.dataType}Data.${props.attributeName}`);
    }

    histogramData.value = data;
  } catch (error) {
    console.error("Error fetching histogram data:", error);
    histogramData.value = [];
  } finally {
    loading.value = false;
  }
}

onMounted(fetchData);
watch([() => props.histogramUrl, () => props.dataType, () => props.attributeName], fetchData);
</script>

<template>
  <div
    class="mt-2 flex min-h-[100px] cursor-pointer flex-col items-center gap-6 border bg-base-100 p-4 shadow-md lg:flex-row"
    @click="toggle"
  >
    <!-- Title + Unit -->
    <div class="w-60 text-center lg:text-left">
      <div class="font-medium text-base-content">
        {{ title }}
      </div>
      <p v-if="unit" class="text-sm">{{ unitDisplay }}</p>
    </div>

    <!-- Progress bar or other content slot -->
    <div class="w-full grow justify-center sm:px-10 md:px-20">
      <slot name="content" :expanded="expanded" :toggle="toggle" />
    </div>

    <!-- Code + Info -->
    <div class="w-60 text-center">
      <p v-if="code">{{ code }}</p>
      <button class="btn btn-ghost btn-sm pointer-events-none">
        Info
        <span v-if="expanded">▲</span>
        <span v-else>▼</span>
      </button>
    </div>
  </div>

  <!-- Expandable section -->
  <div v-if="expanded" class="space-y-3 bg-base-100 p-4 text-sm text-black shadow-md">
    <div v-if="description">
      <p class="font-bold">{{ $t("stats.labels.description") }}</p>
      <p>{{ description }}</p>
    </div>

    <div v-if="calculation">
      <p class="font-bold">{{ $t("stats.labels.calculation") }}</p>
      <p>{{ calculation }}</p>
    </div>

    <div v-if="dataSources.length">
      <p class="font-bold">
        {{ dataSources.length === 1 ? $t("stats.labels.data_source.singular") : $t("stats.labels.data_source.plural") }}
      </p>
      <div class="mt-2 grid gap-3">
        <div
          v-for="dataSource in dataSources"
          :key="dataSource.id"
          class="border-gray-200 rounded-lg border bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
        >
          <!-- Date Badge -->
          <div v-if="dataSource.effectiveDt" class="mb-3 flex items-start justify-between">
            <span
              class="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800"
            >
              {{ new Date(dataSource.effectiveDt).toLocaleDateString() }}
            </span>
          </div>

          <!-- License and Attribution Information -->
          <div v-if="dataSource.license || dataSource.attribution || dataSource.attributionUrl">
            <table class="table table-xs">
              <tbody>
                <!-- License -->
                <tr v-if="dataSource.license">
                  <td class="text-gray-600 w-32 font-semibold uppercase tracking-wide">License</td>
                  <td>
                    <div class="flex flex-wrap items-center gap-2">
                      <a
                        v-if="dataSource.license.url"
                        :href="dataSource.license.url"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="bg-green-100 text-green-800 hover:bg-green-200 inline-flex items-center rounded-full py-1 text-sm font-medium transition-colors"
                      >
                        {{ dataSource.license.name }}
                        <svg class="ml-1 h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fill-rule="evenodd"
                            d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                            clip-rule="evenodd"
                          ></path>
                        </svg>
                      </a>
                      <span
                        v-else
                        class="bg-gray-100 text-gray-800 inline-flex items-center rounded-full py-1 text-sm font-medium"
                      >
                        {{ dataSource.license.name }}
                      </span>
                    </div>
                    <p v-if="dataSource.license.text" class="text-gray-600 mt-1 text-sm">
                      {{ dataSource.license.text }}
                    </p>
                  </td>
                </tr>

                <!-- Attribution -->
                <tr v-if="dataSource.attribution">
                  <td class="text-gray-600 w-32 font-semibold uppercase tracking-wide">Attribution</td>
                  <td class="text-gray-700 text-sm">{{ dataSource.attribution }}</td>
                </tr>

                <!-- Attribution URL -->
                <tr v-if="dataSource.attributionUrl">
                  <td class="text-gray-600 w-32 font-semibold uppercase tracking-wide">Source</td>
                  <td>
                    <a
                      :href="dataSource.attributionUrl"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="inline-flex items-center break-all text-sm text-primary underline hover:text-solid-light-green-70"
                    >
                      {{ dataSource.attributionUrl }}
                      <svg class="ml-1 h-3 w-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fill-rule="evenodd"
                          d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                          clip-rule="evenodd"
                        ></path>
                      </svg>
                    </a>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- Histogram Section -->
    <div v-if="histogramConfig">
      <p class="font-bold">{{ $t("stats.labels.distribution") }}</p>
      <div class="bg-gray-50 mt-2 rounded-lg p-4">
        <!-- Use simple histogram if precomputed data is available -->
        <DataHistogram
          v-if="hasPrecomputedHistogram"
          :histogram-url="histogramConfig.histogramUrl ?? ''"
          :current-value="histogramConfig.currentValue"
          :municipality-name="histogramConfig.municipalityName"
          :unit="histogramConfig.unit || unit || undefined"
          :data-product-name="histogramConfig.title || title"
          :population-normalized="histogramConfig.populationNormalized"
          :population="histogramConfig.population"
          :is-percentage="histogramConfig.isPercentage"
          :orange-threshold="histogramConfig.orangeThreshold"
          :yellow-threshold="histogramConfig.yellowThreshold"
          :light-green-threshold="histogramConfig.lightGreenThreshold"
          :dark-green-threshold="histogramConfig.darkGreenThreshold"
          @bin-click="handleBinClick"
        />
        <!-- Fallback to legacy histogram component -->
        <DataHistogramLegacy
          v-else
          :data-type="histogramConfig.dataType ?? undefined"
          :attribute-name="histogramConfig.attributeName ?? undefined"
          :current-value="histogramConfig.currentValue"
          :unit="unit ?? undefined"
          :population-normalized="histogramConfig.populationNormalized"
          :orange-threshold="histogramConfig.orangeThreshold"
          :yellow-threshold="histogramConfig.yellowThreshold"
          :light-green-threshold="histogramConfig.lightGreenThreshold"
          :dark-green-threshold="histogramConfig.darkGreenThreshold"
        />

        <!-- Selected Bin Data Display -->
        <div v-if="selectedBinData" class="mt-4 border-t pt-4">
          <div class="mb-2 flex items-center justify-between">
            <h4 class="text-base font-semibold">
              {{ $t("stats.histogram.municipalities_in_range") }}
              ({{ selectedBinData.bin_range?.start.toFixed(0) ?? "—" }} -
              {{ selectedBinData.bin_range?.end.toFixed(0) ?? "—" }} {{ histogramConfig.unit || unit }})
            </h4>
            <button
              class="text-gray-500 hover:text-gray-700"
              :title="$t('generic.close')"
              @click.stop="selectedBinData = null"
            >
              ✕
            </button>
          </div>
          <p class="text-gray-600 mb-2 text-sm">
            {{ selectedBinData.count }} {{ $t("stats.histogram.municipalities") }}
          </p>
          <div class="max-h-60 overflow-y-auto border">
            <table class="table table-zebra table-pin-rows table-xs">
              <thead>
                <tr>
                  <th class="pr-1 text-right">{{ $t("administrative_areas.prefix") }}</th>
                  <th class="pl-1 text-left">{{ $t("administrative_areas.name") }}</th>
                  <th class="text-right">
                    <button
                      class="ml-auto flex items-center gap-1 hover:text-blue-600"
                      @click.stop="sortOrder = sortOrder === 'asc' ? 'desc' : 'asc'"
                    >
                      {{ $t("stats.value") }}
                      <span class="text-xs">{{ sortOrder === "asc" ? "↑" : "↓" }}</span>
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="area in sortedAreas" :key="area.ars" class="hover">
                  <td class="text-gray-600 pr-1 text-right">{{ area.prefix }}</td>
                  <td class="pl-1">
                    <NuxtLink
                      :to="`/data/${area.ars}`"
                      class="text-blue-600 hover:text-blue-800 hover:underline"
                      @click.stop
                    >
                      {{ area.name }}
                    </NuxtLink>
                  </td>
                  <td class="text-right">{{ area.displayValue.toLocaleString() }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- Map Section -->
    <div v-if="mapEnabled && ars && dataProductType">
      <p class="font-bold">{{ $t("stats.labels.map") }}</p>
      <div class="bg-gray-50 mt-2 rounded-lg p-4">
        <DataProductMap :ars="ars" :data-product-type="dataProductType" :area-bounds="areaBounds" height="h-96" />
      </div>
    </div>

    <!-- Custom expandable content slot -->
    <slot name="expandable-content" :expanded="expanded" />
  </div>
</template>

<script setup lang="ts">
import { HistogramResponseSchema, type BinAreas } from "~/shared/contracts/histogram";
import type { PropType } from "vue";
import type { HistogramConfig } from "~/types/components/data";
import type { GeoJsonObject } from "geojson";

import { ref, computed, onMounted, watch } from "vue";
import DataHistogram from "~/components/DataHistogram.vue";
import DataHistogramLegacy from "~/components/DataHistogramLegacy.vue";
import DataProductMap from "~/components/DataProductMap.vue";

const props = defineProps({
  title: {
    type: String,
    required: true,
  },
  unit: {
    type: String as PropType<string | null | undefined>,
    default: null,
  },
  code: {
    type: String as PropType<string | null | undefined>,
    default: null,
  },
  description: {
    type: String as PropType<string | null | undefined>,
    default: null,
  },
  calculation: {
    type: String as PropType<string | null | undefined>,
    default: null,
  },
  dataSources: {
    type: Array as PropType<
      | {
          id?: string | number | undefined;
          name?: string | undefined;
          url?: string | undefined;
          effectiveDt?: string | null | undefined;
          license?:
            { url?: string | undefined; name?: string | undefined; text?: string | undefined } | null | undefined;
          attribution?: string | null | undefined;
          attributionUrl?: string | null | undefined;
        }[]
      | undefined
    >,
    default: () => [],
  },
  showMeasureLink: {
    type: Boolean as PropType<boolean | undefined>,
    default: true,
  },
  defaultExpanded: {
    type: Boolean as PropType<boolean | undefined>,
    default: false,
  },
  histogramConfig: {
    type: Object as PropType<HistogramConfig | null | undefined>,
    default: null,
  },
  mapEnabled: {
    type: Boolean as PropType<boolean | undefined>,
    default: false,
  },
  ars: {
    type: String as PropType<string | null | undefined>,
    default: null,
  },
  dataProductType: {
    type: String as PropType<string | null | undefined>,
    default: null,
  },
  areaBounds: {
    type: Object as PropType<GeoJsonObject | null | undefined>,
    default: null,
  },
});

const { $t } = useNuxtApp();

const expanded = ref(props.defaultExpanded);
const hasPrecomputedHistogram = ref(false);
const selectedBinData = ref<BinAreas | null>(null);
const sortOrder = ref("asc"); // 'asc' or 'desc'

const sortedAreas = computed(() => {
  if (!selectedBinData.value?.areas) return [];

  // Transform values if population normalized
  const areas = selectedBinData.value.areas.map((area) => {
    let displayValue = area.value ?? 0;

    // Apply population normalization if needed
    if (props.histogramConfig?.populationNormalized && props.histogramConfig?.population) {
      displayValue = ((area.value ?? 0) / props.histogramConfig.population) * 1000;
    }

    return {
      ...area,
      displayValue,
    };
  });

  // Sort by the display value
  if (sortOrder.value === "asc") {
    return areas.sort((a, b) => a.displayValue - b.displayValue);
  } else {
    return areas.sort((a, b) => b.displayValue - a.displayValue);
  }
});

// Check if precomputed histogram data is available
async function checkHistogramAvailability() {
  if (!props.histogramConfig?.histogramUrl) {
    hasPrecomputedHistogram.value = false;
    return;
  }

  try {
    const url = props.histogramConfig.histogramUrl.includes("?")
      ? `${props.histogramConfig.histogramUrl}&format=json`
      : `${props.histogramConfig.histogramUrl}?format=json`;

    const response = await fetch(url);
    if (!response.ok) {
      hasPrecomputedHistogram.value = false;
      return;
    }

    const data = HistogramResponseSchema.parse(await response.json());
    const result = data?.results?.[0];

    // Check if we have valid histogram data
    hasPrecomputedHistogram.value = !!(result?.bin_edges && result?.bin_counts && data?.results?.length > 0);
  } catch (error) {
    console.error("Error checking histogram availability:", error);
    hasPrecomputedHistogram.value = false;
  }
}

// Check on mount and when histogramConfig changes
onMounted(() => {
  if (props.histogramConfig) {
    void checkHistogramAvailability();
  }
});

watch(
  () => props.histogramConfig,
  () => {
    if (props.histogramConfig) {
      void checkHistogramAvailability();
    }
  },
  { deep: true },
);

const unitDisplay = computed(() => {
  if (!props.unit) return "";
  return props.unit.startsWith("in ") ? props.unit : `in ${props.unit}`;
});

function toggle() {
  expanded.value = !expanded.value;
}

function handleBinClick(binData: BinAreas) {
  selectedBinData.value = binData;
  sortOrder.value = "asc"; // Reset sort order on new selection
  console.log("Bin clicked:", binData);
  // You can add more functionality here, such as:
  // - Display a modal with the list of areas
  // - Emit an event to parent components
  // - Navigate to a detailed view
}

// Expose the expanded state and toggle function for parent components
defineExpose({
  expanded,
  toggle,
  selectedBinData,
});
</script>

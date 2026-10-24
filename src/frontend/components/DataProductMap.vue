<template>
  <div class="relative z-10 w-full overflow-hidden rounded-lg bg-gray-100">
    <div v-if="loading" class="flex h-64 items-center justify-center gap-2">
      <SlkFlowerSpinner :size="32" />
      <span class="text-gray-600">{{ $t("generic.loading") }}</span>
    </div>

    <div v-else-if="error" class="flex h-64 items-center justify-center bg-red-50 text-red-600">
      <div class="text-center">
        <svg class="mx-auto h-12 w-12 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
          />
        </svg>
        <p class="mt-2 text-sm">{{ error }}</p>
      </div>
    </div>

    <div v-else-if="!mapData" class="flex h-64 items-center justify-center text-gray-500">
      <div class="text-center">
        <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 01.553-.894L9 2l6 3 5.447-2.724A1 1 0 0121 3.276v10.764a1 1 0 01-.553.894L15 17l-6-3z"
          />
        </svg>
        <p class="mt-2 text-sm">{{ $t("stats.map.no_data_available") }}</p>
      </div>
    </div>

    <div v-else :class="props.height" class="w-full overflow-hidden rounded-lg bg-gray-50">
      <LMap ref="map" :zoom="zoom" :center="center" :options="mapOptions" class="h-full w-full" @ready="onMapReady">
        <LTileLayer :key="tileUrl" :url="tileUrl" :attribution="attribution" :subdomains="subdomains" :max-zoom="20" />

        <!-- Display area boundary if available -->
        <LGeoJson v-if="areaBounds" :geojson="areaBounds" :options="areaBoundsOptions" />

        <!-- Display markers from map data -->
        <template v-for="layer in mapData.layers" :key="layer.name">
          <template v-for="item in layer.type === 'markers' ? layer.data : []" :key="item.coordinates.join(',')">
            <DataProductMapMarker :item="item" />
          </template>
        </template>
      </LMap>
    </div>

    <!-- Legend -->
    <div
      v-if="mapData && showLegend"
      class="absolute bottom-4 left-4 z-1000 max-w-xs rounded-lg bg-white/90 p-3 shadow-md"
    >
      <h4 class="mb-2 text-sm font-semibold">{{ $t("stats.map.legend") }}</h4>
      <div v-for="layer in mapData.layers" :key="layer.name" class="mb-1 flex items-center text-xs">
        <div
          class="mr-2 h-4 w-4 rounded-full"
          :style="{ backgroundColor: layer.style?.marker_color || '#2196F3' }"
        ></div>
        <span>{{ layer.name }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Map as LeafletMap, LatLngBoundsExpression } from "leaflet";
import type { PropType } from "vue";
import { DataMapSchema } from "~/shared/contracts/dataMap";
import type { z } from "zod";
import type { GeoJsonObject } from "geojson";

import { ref, computed, watch, onMounted } from "vue";
import { useRuntimeConfig } from "nuxt/app";

const props = defineProps({
  ars: {
    type: String,
    required: true,
  },
  dataProductType: {
    type: String,
    required: true,
  },
  areaBounds: {
    type: Object as PropType<GeoJsonObject | null | undefined>,
    default: null,
  },
  height: {
    type: String as PropType<string | undefined>,
    default: "h-64",
  },
  showLegend: {
    type: Boolean as PropType<boolean | undefined>,
    default: true,
  },
});

const config = useRuntimeConfig();
const { $t } = useNuxtApp();

const map = shallowRef<{ leafletObject: LeafletMap } | null>(null);
type MapData = z.infer<typeof DataMapSchema>;
type MapState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; data: MapData }
  | { status: "error"; message: string };
const state = shallowRef<MapState>({ status: "idle" });
const mapData = computed(() => (state.value.status === "ready" ? state.value.data : null));
const loading = computed(() => state.value.status === "loading");
const error = computed(() => (state.value.status === "error" ? state.value.message : null));
const mapReady = ref(false);
const zoom = ref(10);

// Default center (Germany)
const defaultCenter: [number, number] = [51.1657, 10.4515];

const center = computed(() => {
  if (mapData.value?.center) {
    return mapData.value.center;
  }
  return defaultCenter;
});

const { attribution, subdomains, tileUrl } = useCartoBasemap();

const mapOptions = {
  zoomControl: true,
  scrollWheelZoom: true,
  doubleClickZoom: true,
  touchZoom: true,
};

const areaBoundsOptions = {
  style: {
    color: "#6B7280",
    weight: 2,
    opacity: 0.6,
    fillColor: "transparent",
    fillOpacity: 0,
  },
};

const fetchMapData = async () => {
  if (!props.ars || !props.dataProductType) {
    return;
  }

  state.value = { status: "loading" };

  try {
    const baseUrl = config.public.stadtlandzahlBaseUrl;
    const apiUrl = `${baseUrl}/api/areas/${props.ars}/maps/${props.dataProductType}/`;

    console.log("DataProductMap: Fetching from", apiUrl);

    const response = await fetch(apiUrl);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = DataMapSchema.parse(await response.json());
    console.log("DataProductMap: Data received:", data);

    state.value = { status: "ready", data };

    // Fit map to bounds if available
    if (data.bounds && mapReady.value) {
      fitToBounds(data.bounds);
    }
  } catch (err) {
    console.error("DataProductMap: Error fetching map data:", err);
    state.value = { status: "error", message: $t("stats.map.error_loading") };
  }
};

const fitToBounds = (bounds: LatLngBoundsExpression | null | undefined) => {
  if (!map.value?.leafletObject || !bounds) return;

  try {
    const leafletMap = map.value.leafletObject;
    // bounds format: [[minLat, minLng], [maxLat, maxLng]]
    leafletMap.fitBounds(bounds, {
      padding: [20, 20],
      maxZoom: 15,
    });
  } catch (error) {
    console.warn("Could not fit map to bounds:", error);
  }
};

const onMapReady = () => {
  mapReady.value = true;

  // Fit to bounds if map data is already loaded
  if (mapData.value?.bounds) {
    setTimeout(() => {
      fitToBounds(mapData.value?.bounds);
    }, 100);
  }

  // Force map to recalculate its size
  setTimeout(() => {
    const leafletMap = map.value?.leafletObject;
    if (leafletMap) {
      leafletMap.invalidateSize();
    }
  }, 300);
};

// Watch for prop changes and refetch data
watch(
  [() => props.ars, () => props.dataProductType],
  () => {
    void fetchMapData();
  },
  { immediate: false },
);

onMounted(() => {
  void fetchMapData();
});

// Expose map data for parent components if needed
defineExpose({
  mapData,
  loading,
  error,
  refetch: fetchMapData,
});
</script>

<style scoped>
/* Custom marker styles if needed */
.leaflet-popup-content {
  margin: 8px 12px;
  line-height: 1.4;
}

.leaflet-popup-content h3 {
  margin: 0 0 4px 0;
  font-size: 16px;
  font-weight: 600;
}

/* Marker color customization */
:deep(.marker-high-power .leaflet-marker-icon) {
  filter: hue-rotate(0deg) saturate(150%); /* Red for high power */
}

:deep(.marker-medium-power .leaflet-marker-icon) {
  filter: hue-rotate(30deg) saturate(120%); /* Orange for medium power */
}

:deep(.marker-low-power .leaflet-marker-icon) {
  filter: hue-rotate(120deg) saturate(130%); /* Green for low power */
}

:deep(.marker-default .leaflet-marker-icon) {
  filter: hue-rotate(220deg) saturate(100%); /* Blue for default */
}
</style>

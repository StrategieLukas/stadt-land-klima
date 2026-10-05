<template>
  <div class="bg-gray-100 relative z-10 h-64 w-full overflow-hidden rounded-lg">
    <LMap ref="map" :zoom="zoom" :center="center" :options="mapOptions" class="h-full w-full" @ready="onMapReady">
      <LTileLayer :key="tileUrl" :url="tileUrl" :attribution="attribution" :subdomains="subdomains" :max-zoom="20" />

      <!-- Display the area boundary if available -->
      <LGeoJson v-if="geoArea" :geojson="geoArea" :options="geoJsonOptions" @ready="onGeoJsonReady" />
    </LMap>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick } from "vue";

const props = defineProps({
  geoCenter: {
    type: Object,
    default: null,
  },
  geoArea: {
    type: Object,
    default: null,
  },
  administrativeAreaName: {
    type: String,
    default: "Administrative Area",
  },
});

const map = ref(null);
const zoom = ref(10);
const mapReady = ref(false);

// Default center (Germany)
const defaultCenter = [51.1657, 10.4515];

const geoCenterLatLng = computed(() => {
  const coordinates = props.geoCenter?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    return null;
  }

  const longitude = Number(coordinates[0]);
  const latitude = Number(coordinates[1]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  // GeoJSON coordinates are [longitude, latitude], but Leaflet expects [latitude, longitude].
  return [latitude, longitude];
});

const center = computed(() => {
  return geoCenterLatLng.value ?? defaultCenter;
});

const { attribution, subdomains, tileUrl } = useCartoBasemap();

const mapOptions = {
  zoomControl: true,
  scrollWheelZoom: false,
  doubleClickZoom: true,
  touchZoom: true,
};

const geoJsonOptions = {
  style: {
    color: "#3B82F6",
    weight: 2,
    opacity: 0.8,
    fillColor: "#3B82F6",
    fillOpacity: 0.2,
  },
};

const fitBoundsToGeoArea = () => {
  if (!props.geoArea || !map.value?.leafletObject || !mapReady.value) {
    return;
  }

  try {
    const leafletMap = map.value.leafletObject;
    const geoJsonLayer = L.geoJSON(props.geoArea);
    const bounds = geoJsonLayer.getBounds();

    if (bounds.isValid()) {
      // Use more generous padding and maxZoom to ensure full visibility
      leafletMap.fitBounds(bounds, {
        padding: [30, 30],
        maxZoom: 16, // Prevent zooming too close for small areas
      });
    }
  } catch (error) {
    console.warn("Could not fit bounds to geoArea:", error);
  }
};

const onMapReady = () => {
  mapReady.value = true;
  // Small delay to ensure map is fully initialized
  setTimeout(() => {
    const leafletMap = map.value?.leafletObject;
    if (leafletMap) {
      // Force map to recalculate its size
      leafletMap.invalidateSize();
    }
    fitBoundsToGeoArea();
  }, 100);

  // Additional invalidation after a longer delay for large polygons
  setTimeout(() => {
    const leafletMap = map.value?.leafletObject;
    if (leafletMap) {
      leafletMap.invalidateSize();
      fitBoundsToGeoArea();
    }
  }, 500);
};

const onGeoJsonReady = () => {
  // Fit bounds when GeoJSON is ready
  nextTick(() => {
    const leafletMap = map.value?.leafletObject;
    if (leafletMap) {
      // Force map to recalculate its size
      leafletMap.invalidateSize();
    }
    fitBoundsToGeoArea();
  });

  // Additional invalidation for large multipolygons
  setTimeout(() => {
    const leafletMap = map.value?.leafletObject;
    if (leafletMap) {
      leafletMap.invalidateSize();
      fitBoundsToGeoArea();
    }
  }, 300);
};

// Watch for changes in geoArea and refit bounds
watch(
  () => props.geoArea,
  () => {
    if (mapReady.value) {
      setTimeout(() => {
        fitBoundsToGeoArea();
      }, 100);
    }
  },
  { deep: true },
);

// Also watch for changes in geoCenter if no geoArea
watch(
  () => props.geoCenter,
  () => {
    const latLng = geoCenterLatLng.value;
    if (!props.geoArea && latLng && mapReady.value) {
      const leafletMap = map.value?.leafletObject;
      if (leafletMap) {
        leafletMap.setView(latLng, 12);
      }
    }
  },
  { deep: true },
);

onMounted(() => {
  // Set initial zoom based on available data
  if (props.geoArea) {
    zoom.value = 10; // Will be adjusted by fitBounds
  } else if (props.geoCenter) {
    zoom.value = 12;
  } else {
    zoom.value = 6;
  }

  // Force map to recalculate after mount for large polygons
  nextTick(() => {
    setTimeout(() => {
      const leafletMap = map.value?.leafletObject;
      if (leafletMap) {
        leafletMap.invalidateSize();
        fitBoundsToGeoArea();
      }
    }, 200);
  });
});
</script>

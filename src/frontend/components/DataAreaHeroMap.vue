<template>
  <div
    class="data-area-hero-map border-gray-200 relative z-0 h-[240px] overflow-hidden rounded-lg border bg-white shadow-sm sm:h-[280px] xl:h-[320px]"
  >
    <ClientOnly>
      <LMap
        ref="mapRef"
        :zoom="zoom"
        :center="mapCenter"
        :use-global-leaflet="false"
        :options="mapOptions"
        class="z-0 h-full w-full"
        @ready="onMapReady"
      >
        <LTileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          :subdomains="'abcd'"
          :max-zoom="20"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank">CARTO</a>'
        />

        <LGeoJson
          v-for="neighbor in visibleNeighbors"
          :key="neighbor.ars"
          :geojson="parseGeo(neighbor.geo_area ?? neighbor.geoArea)"
          :options="areaOptions(neighbor, false)"
        />

        <LGeoJson
          v-if="areaBoundary"
          :geojson="areaBoundary"
          :options="areaOptions(area, true)"
          @ready="onBoundaryReady"
        />
      </LMap>
    </ClientOnly>

    <Transition name="fade">
      <div
        v-if="nearbyAreasLoading"
        class="text-gray-600 pointer-events-none absolute right-3 top-3 z-[500] inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/90 px-3 py-1.5 text-xs font-semibold shadow-sm backdrop-blur-sm"
      >
        <SlkFlowerSpinner :size="18" />
        <span>Nachbargebiete laden...</span>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { computed, ref } from "vue";
import { areaToSlug } from "~/composables/useAreaBySlug.js";

const props = defineProps({
  area: { type: Object, required: true },
  nearbyAreas: { type: Array, default: () => [] },
  nearbyAreasLoading: { type: Boolean, default: false },
});

const router = useRouter();
const { start: startDataRouteFeedback } = useDataRouteFeedback();
const mapRef = ref(null);
const mapReady = ref(false);
const zoom = ref(10);
let pendingBounds = null;

const fitMaxZoom = 12;
const minZoomStepBack = 2;
const maxZoomStepForward = 4;
const mapMinZoom = 6;
const mapMaxZoom = 17;

const mapOptions = {
  attributionControl: false,
  boxZoom: false,
  doubleClickZoom: true,
  dragging: true,
  keyboard: false,
  scrollWheelZoom: true,
  tap: false,
  touchZoom: false,
  zoomDelta: 1,
  zoomSnap: 1,
  zoomControl: true,
};

const areaBoundary = computed(() => parseGeo(props.area?.geo_area ?? props.area?.geoArea));

const visibleNeighbors = computed(() =>
  props.nearbyAreas.filter((area) => {
    if (!area?.ars || area.ars === props.area?.ars) return false;
    if (!isReasonableArea(area)) return false;
    return !!parseGeo(area.geo_area ?? area.geoArea);
  }),
);

const mapCenter = computed(() => centerFor(props.area) ?? [51.1657, 10.4515]);

function parseGeo(geoArea) {
  if (!geoArea) return null;
  if (typeof geoArea === "object") return geoArea;
  try {
    return JSON.parse(geoArea);
  } catch {
    return null;
  }
}

function centerFor(area) {
  const center = area?.geo_center ?? area?.geoCenter;
  if (!center) return null;
  if (Array.isArray(center) && center.length >= 2) return [center[1], center[0]];
  if (center.coordinates?.length >= 2) return [center.coordinates[1], center.coordinates[0]];
  if (typeof center.lat === "number" && typeof center.lon === "number") return [center.lat, center.lon];
  return null;
}

function areaLabel(area) {
  return `${area?.prefix ?? ""} ${area?.name ?? ""}`.trim();
}

function isReasonableArea(area) {
  return (area?.is_reasonable_for_municipal_rating ?? area?.isReasonableForMunicipalRating ?? true) === true;
}

function navigateToArea(area) {
  if (!area?.prefix || !area?.name) return;
  startDataRouteFeedback(`${area.name} wird geladen...`, area);
  router.push(`/data/${areaToSlug(area.prefix, area.name)}`);
}

function areaOptions(area, selected) {
  const base = selected
    ? { color: "#f27c00", fillColor: "#f27c00", fillOpacity: 0.24, opacity: 0.95, weight: 2.6 }
    : { color: "#6b7280", fillColor: "#9ca3af", fillOpacity: 0.08, opacity: 0.65, weight: 1 };

  return {
    style: () => ({ ...base }),
    onEachFeature: (_feature, layer) => {
      const label = areaLabel(area);
      layer.bindTooltip(label, {
        className: selected ? "data-area-map-label data-area-map-label-main" : "data-area-map-label",
        direction: "center",
        permanent: true,
      });
      layer.on("click", () => navigateToArea(area));

      const hoverStyle = { ...base, fillOpacity: selected ? 0.32 : 0.16, opacity: 1 };
      layer.on("mouseenter", () => {
        layer.setStyle(hoverStyle);
        if (!selected) layer.bringToFront();
      });
      layer.on("mouseleave", () => {
        layer.setStyle(base);
        if (!selected) layer.bringToBack();
      });
    },
  };
}

function fitBounds(layer) {
  try {
    const bounds = layer.getBounds();
    if (!bounds.isValid()) return;
    const leafletMap = mapRef.value?.leafletObject;
    if (mapReady.value && leafletMap) {
      leafletMap.fitBounds(bounds, { padding: [26, 26], maxZoom: fitMaxZoom });
      applyZoomSteps(leafletMap);
    } else {
      pendingBounds = bounds;
    }
  } catch (_) {}
}

function applyZoomSteps(leafletMap) {
  const currentZoom = leafletMap.getZoom();
  leafletMap.setMinZoom(Math.max(mapMinZoom, currentZoom - minZoomStepBack));
  leafletMap.setMaxZoom(Math.min(mapMaxZoom, currentZoom + maxZoomStepForward));
}

function onMapReady(mapInstance) {
  mapReady.value = true;
  if (pendingBounds) {
    mapInstance.fitBounds(pendingBounds, { padding: [26, 26], maxZoom: fitMaxZoom });
    pendingBounds = null;
  }
  applyZoomSteps(mapInstance);
  setTimeout(() => {
    mapRef.value?.leafletObject?.invalidateSize();
  }, 150);
}

function onBoundaryReady(layer) {
  fitBounds(layer);
}
</script>

<style scoped>
.data-area-hero-map :deep(.leaflet-pane),
.data-area-hero-map :deep(.leaflet-top),
.data-area-hero-map :deep(.leaflet-bottom) {
  z-index: 0;
}

.data-area-hero-map :deep(.leaflet-tooltip.data-area-map-label) {
  background: rgba(255, 255, 255, 0.86);
  border: 1px solid rgba(107, 114, 128, 0.22);
  border-radius: 4px;
  box-shadow: none;
  color: #374151;
  font-size: 10px;
  font-weight: 700;
  line-height: 1.1;
  padding: 2px 5px;
  pointer-events: none;
}

.data-area-hero-map :deep(.leaflet-tooltip.data-area-map-label-main) {
  border-color: rgba(242, 124, 0, 0.35);
  color: #7a3d00;
}

.data-area-hero-map :deep(.leaflet-tooltip-top::before),
.data-area-hero-map :deep(.leaflet-tooltip-bottom::before),
.data-area-hero-map :deep(.leaflet-tooltip-left::before),
.data-area-hero-map :deep(.leaflet-tooltip-right::before) {
  display: none;
}

.fade-enter-active,
.fade-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>

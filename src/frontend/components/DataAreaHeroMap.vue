<template>
  <div
    class="data-area-hero-map relative z-0 h-[240px] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xs sm:h-[280px] xl:h-[320px]"
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
        <LTileLayer :key="tileUrl" :url="tileUrl" :subdomains="subdomains" :max-zoom="20" :attribution="attribution" />

        <LGeoJson
          v-for="neighbor in visibleNeighbors"
          :key="neighbor.ars"
          :geojson="parseGeo(neighbor.geo_area ?? neighbor.geoArea) ?? []"
          :options="areaOptions(neighbor, false)"
        />

        <LGeoJson
          v-if="areaBoundary"
          :geojson="areaBoundary ?? []"
          :options="areaOptions(area, true)"
          v-on="{ ready: onBoundaryReady }"
        />
      </LMap>
    </ClientOnly>

    <Transition name="fade">
      <div
        v-if="nearbyAreasLoading"
        class="pointer-events-none absolute top-3 right-3 z-500 inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/90 px-3 py-1.5 text-xs font-semibold text-gray-600 shadow-xs backdrop-blur-xs"
      >
        <SlkFlowerSpinner :size="18" />
        <span>Nachbargebiete laden...</span>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
// vue-leaflet omits ready events from its types; local object listeners preserve them. Owner: app maintainers.
import type { Map as LeafletMap, GeoJSON as LeafletGeoJSON, LatLngBounds, GeoJSONOptions, Path } from "leaflet";
import { parseGeoData, parseGeoCenter } from "~/shared/contracts/geometry";
import type { PropType } from "vue";
import type { Area } from "~/shared/contracts/search";

import { computed, ref } from "vue";
import { areaToSlug } from "~/composables/useAreaBySlug";

const props = defineProps({
  area: { type: Object as PropType<Area>, required: true },
  nearbyAreas: { type: Array as PropType<Area[] | undefined>, default: () => [] },
  nearbyAreasLoading: { type: Boolean as PropType<boolean | undefined>, default: false },
});

const router = useRouter();
const { start: startDataRouteFeedback } = useDataRouteFeedback();
const { attribution, subdomains, tileUrl } = useCartoBasemap();
const mapRef = shallowRef<{ leafletObject: LeafletMap } | null>(null);
const mapReady = ref(false);
const zoom = ref(10);
let pendingBounds: LatLngBounds | null = null;

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

const mapCenter = computed<[number, number]>(() => centerFor(props.area) ?? [51.1657, 10.4515]);

function parseGeo(input: unknown) {
  return parseGeoData(input);
}

function centerFor(area: Area): [number, number] | null {
  const center = parseGeoCenter(area.geo_center ?? area.geoCenter);
  return center ? [center.lat, center.lon] : null;
}

function areaLabel(area: Area) {
  return `${area?.prefix ?? ""} ${area?.name ?? ""}`.trim();
}

function isReasonableArea(area: Area) {
  return (area?.is_reasonable_for_municipal_rating ?? area?.isReasonableForMunicipalRating ?? true) === true;
}

function navigateToArea(area: Area) {
  if (!area?.prefix || !area?.name) return;
  startDataRouteFeedback(`${area.name} wird geladen...`, area);
  void router.push(`/data/${areaToSlug(area.prefix, area.name)}`);
}

function areaOptions(area: Area, selected: boolean): GeoJSONOptions {
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
      layer.on("click", () => {
        navigateToArea(area);
      });

      const hoverStyle = { ...base, fillOpacity: selected ? 0.32 : 0.16, opacity: 1 };
      layer.on("mouseenter", () => {
        (layer as Path).setStyle(hoverStyle);
        if (!selected) (layer as Path).bringToFront();
      });
      layer.on("mouseleave", () => {
        (layer as Path).setStyle(base);
        if (!selected) (layer as Path).bringToBack();
      });
    },
  };
}

function fitBounds(layer: LeafletGeoJSON) {
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
  } catch {
    /* Invalid or unavailable map data is optional. */
  }
}

function applyZoomSteps(leafletMap: LeafletMap) {
  const currentZoom = leafletMap.getZoom();
  leafletMap.setMinZoom(Math.max(mapMinZoom, currentZoom - minZoomStepBack));
  leafletMap.setMaxZoom(Math.min(mapMaxZoom, currentZoom + maxZoomStepForward));
}

function onMapReady(mapInstance: LeafletMap) {
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

function onBoundaryReady(layer: LeafletGeoJSON) {
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

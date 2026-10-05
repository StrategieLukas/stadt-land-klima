<template>
  <LMap
    ref="mapRef"
    :zoom="6"
    :center="initialCenter"
    :use-global-leaflet="false"
    :options="mapOptions"
    class="h-full w-full"
    @ready="onReady"
  >
    <LTileLayer :url="tileUrl" :subdomains="subdomains" :attribution="attribution" :max-zoom="20" />
    <LPolyline
      v-if="curvedRoute.length > 1"
      :lat-lngs="curvedRoute"
      color="#075b79"
      :weight="4"
      :opacity="0.8"
      dash-array="4 9"
    />
    <template v-for="stop in mappedStops" :key="stop.id">
      <LMarker
        v-if="markerIcons.get(stop.index)"
        :lat-lng="stop.point"
        :icon="markerIcons.get(stop.index)"
        :z-index-offset="stop.index === activeIndex ? 1000 : 0"
        :options="{ title: `${stop.index + 1}. ${stop.name}`, alt: `${stop.index + 1}. ${stop.name}` }"
        @click="emit('select', stop.index)"
      />
    </template>
  </LMap>
</template>

<script setup lang="ts">
import { computed, markRaw, onMounted, onUnmounted, ref, shallowRef, watch } from "vue";
import type { DivIcon } from "leaflet";
import type { TourPoint } from "~/shared/tour";
import { pinColor, pointLatLng } from "~/shared/tour";

type LatLng = [number, number];
type MapPosition = { x: number; y: number; width: number; height: number };
type LeafletMap = {
  fitBounds: (bounds: LatLng[], options: object) => void;
  flyTo: (center: LatLng, zoom: number, options: object) => void;
  setView: (center: LatLng, zoom: number) => void;
  project: (point: LatLng, zoom: number) => { x: number; y: number };
  unproject: (point: [number, number], zoom: number) => LatLng;
  latLngToContainerPoint: (point: LatLng) => { x: number; y: number };
  getSize: () => { x: number; y: number };
  invalidateSize: () => void;
  on: (event: string, callback: () => void) => void;
  off: (event: string, callback: () => void) => void;
};

const props = defineProps<{
  stops: { id: string; slug?: string; title?: string; location?: string | null; geolocation?: TourPoint | null }[];
  activeIndex: number;
}>();
const emit = defineEmits<{
  (event: "select", index: number): void;
  (event: "position", position: MapPosition | null): void;
}>();
const { tileUrl, subdomains, attribution } = useCartoBasemap();
const mapRef = ref<{ leafletObject?: LeafletMap } | null>(null);
const divIconFactory = shallowRef<typeof import("leaflet")["divIcon"] | null>(null);
const ready = ref(false);
const reducedMotion = ref(false);

const mappedStops = computed(() => props.stops.flatMap((stop, index) => {
  const point = pointLatLng(stop.geolocation);
  return point ? [{ id: stop.id, index, point, name: stop.location || stop.title || String(index + 1) }] : [];
}));
const routePoints = computed<LatLng[]>(() => mappedStops.value.map((stop) => stop.point));
const initialCenter = computed<LatLng>(() => routePoints.value[0] ?? [51.1657, 10.4515]);
const mapOptions = { zoomControl: true, scrollWheelZoom: false, doubleClickZoom: false };

// The curve indicates sequence only. It does not represent roads or travel distance.
const curvedRoute = computed<LatLng[]>(() => {
  const points = routePoints.value;
  if (points.length < 2) return points;
  const curve: LatLng[] = [points[0]];
  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = points[Math.max(0, index - 1)];
    const current = points[index];
    const next = points[index + 1];
    const following = points[Math.min(points.length - 1, index + 2)];
    const startTangent: LatLng = [(next[0] - previous[0]) * .18, (next[1] - previous[1]) * .18];
    const endTangent: LatLng = [(following[0] - current[0]) * .18, (following[1] - current[1]) * .18];
    for (let step = 1; step <= 12; step += 1) {
      const t = step / 12;
      const h00 = 2 * t ** 3 - 3 * t ** 2 + 1;
      const h10 = t ** 3 - 2 * t ** 2 + t;
      const h01 = -2 * t ** 3 + 3 * t ** 2;
      const h11 = t ** 3 - t ** 2;
      curve.push([
        h00 * current[0] + h10 * startTangent[0] + h01 * next[0] + h11 * endTangent[0],
        h00 * current[1] + h10 * startTangent[1] + h01 * next[1] + h11 * endTangent[1],
      ]);
    }
  }
  return curve;
});

const markerIcons = computed(() => {
  const result = new Map<number, DivIcon>();
  if (!divIconFactory.value) return result;
  for (const stop of mappedStops.value) {
    const active = stop.index === props.activeIndex;
    result.set(stop.index, markRaw(divIconFactory.value({
      className: `tour-map-pin${active ? " tour-map-pin--active" : ""}`,
      html: `<svg viewBox="0 0 80 110" aria-hidden="true"><path d="M40 2C19.013 2 2 19.013 2 40c0 23.3 38 67 38 67s38-43.7 38-67C78 19.013 60.987 2 40 2Z" fill="${pinColor(stop.index)}"/><circle cx="40" cy="39" r="14" fill="white"/></svg><span class="tour-map-pin__number">${String(stop.index + 1).padStart(2, "0")}</span>`,
      iconSize: [48, 66],
      iconAnchor: [24, 66],
    })));
  }
  return result;
});

function reportActivePosition() {
  const map = mapRef.value?.leafletObject;
  const stop = mappedStops.value.find((item) => item.index === props.activeIndex);
  if (!map || !stop) return emit("position", null);
  const point = map.latLngToContainerPoint(stop.point);
  const size = map.getSize();
  emit("position", { x: point.x, y: point.y, width: size.x, height: size.y });
}

function fitRoute() {
  const map = mapRef.value?.leafletObject;
  if (!map) return;
  if (routePoints.value.length > 1) map.fitBounds(routePoints.value, { padding: [70, 70], maxZoom: 9 });
  else if (routePoints.value.length === 1) map.setView(routePoints.value[0], 9);
  reportActivePosition();
}

function refreshSize() {
  mapRef.value?.leafletObject?.invalidateSize();
  reportActivePosition();
}

function focusStop(index: number) {
  const stop = mappedStops.value.find((item) => item.index === index);
  if (!stop) return reportActivePosition();
  const map = mapRef.value?.leafletObject;
  if (!map) return;
  const zoom = 10;
  const point = map.project(stop.point, zoom);
  const verticalOffset = map.getSize().y * (window.innerWidth <= 1000 ? .2 : .06);
  const center = map.unproject([point.x, point.y + verticalOffset], zoom);
  if (reducedMotion.value) map.setView(center, zoom);
  else map.flyTo(center, zoom, { duration: .75 });
}

function onReady() {
  ready.value = true;
  reducedMotion.value = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const map = mapRef.value?.leafletObject;
  map?.on("moveend", reportActivePosition);
  map?.on("zoomend", reportActivePosition);
  map?.on("resize", reportActivePosition);
  fitRoute();
  const linkedStop = props.stops.findIndex((stop) => window.location.hash === `#stop-${stop.slug}`);
  if (linkedStop >= 0) focusStop(linkedStop);
}

watch(() => props.activeIndex, (index) => {
  if (!ready.value || index < 0) return;
  focusStop(index);
});

onMounted(async () => {
  const { divIcon } = await import("leaflet");
  divIconFactory.value = divIcon;
});
onUnmounted(() => {
  const map = mapRef.value?.leafletObject;
  map?.off("moveend", reportActivePosition);
  map?.off("zoomend", reportActivePosition);
  map?.off("resize", reportActivePosition);
});

defineExpose({ fitRoute, refreshSize, focusStop });
</script>

<style>
.tour-map-pin { border: 0; background: none; filter: drop-shadow(1px 3px 1px #18212780); }
.tour-map-pin svg { display: block; width: 48px; height: 66px; }
.tour-map-pin--active { filter: drop-shadow(0 0 0 #182127) drop-shadow(0 0 7px #fff); transform: scale(1.14); transform-origin: 50% 100%; }
.tour-map-pin__number { position: absolute; top: 14px; left: 0; display: grid; place-items: center; width: 48px; height: 19px; color: #182127; font: 900 11px RobotoCondensed, sans-serif; }
.tour-map-pin:focus-visible { outline: 3px solid #182127; outline-offset: 3px; }
</style>

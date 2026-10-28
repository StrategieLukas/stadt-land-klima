<template>
  <LMap
    ref="mapRef"
    :zoom="6"
    :center="[51.1657, 10.4515]"
    :use-global-leaflet="false"
    :options="{ scrollWheelZoom: false }"
    class="project-map h-full w-full"
    @ready="fitProjects"
  >
    <LTileLayer :key="tileUrl" :url="tileUrl" :subdomains="subdomains" :attribution="attribution" :max-zoom="20" />
    <LControl position="topright">
      <button type="button" class="btn bg-base-100 text-base-content btn-sm" @click="fitProjects">
        {{ $t("projects.map.fit") }}
      </button>
    </LControl>
    <template v-if="createIcon">
      <LMarker
        v-for="location in locations"
        :key="`${location.key}:${location.projects.map((project) => project.id).join(',')}`"
        :lat-lng="location.point"
        :options="{
          title: $t('projects.map.marker_label', { ':count': location.projects.length }),
          alt: $t('projects.map.marker_label', { ':count': location.projects.length }),
          keyboard: true,
        }"
        v-bind="leafletMarkerProps(leafletMarkerIcon(markerIcon(location.projects.length)))"
      >
        <LPopup :options="{ maxHeight: 240, autoPanPadding: [20, 20] }">
          <p class="font-bold">{{ $t("projects.map.marker_label", { ":count": location.projects.length }) }}</p>
          <ul class="mt-2 space-y-3">
            <li v-for="project in location.projects" :key="project.id">
              <NuxtLink :to="`/projects/${encodeURIComponent(project.slug)}`" class="font-bold">{{
                project.title
              }}</NuxtLink>
              <p v-if="project.label" class="mt-1">{{ project.label }}</p>
              <p class="text-xs">
                {{
                  $t(
                    project.location.source === "project"
                      ? "projects.map.project_location"
                      : "projects.map.municipality_location",
                  )
                }}
              </p>
            </li>
          </ul>
        </LPopup>
      </LMarker>
    </template>
  </LMap>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, shallowRef, watch } from "vue";
import type { DivIcon, divIcon, Map as LeafletMap } from "leaflet";
import { leafletMarkerIcon, leafletMarkerProps } from "~/shared/leafletMarker";
import { groupProjectLocations, type ProjectMapItem } from "~/shared/projectMap";
import pinSvg from "~/assets/images/Pin.svg?raw";

const props = defineProps<{ projects: ProjectMapItem[] }>();
const { $t } = useNuxtApp();
const { tileUrl, subdomains, attribution } = useCartoBasemap();
const mapRef = shallowRef<{ leafletObject?: LeafletMap | undefined } | null>(null);
const createIcon = shallowRef<typeof divIcon | null>(null);
const icons = new Map<number, DivIcon>();
const locations = computed(() => groupProjectLocations(props.projects));
onMounted(async () => {
  createIcon.value = (await import("leaflet")).divIcon;
});

function markerIcon(count: number): DivIcon | undefined {
  if (!createIcon.value) return undefined;
  let icon = icons.get(count);
  if (!icon) {
    // SVG is a maintained local asset; only the numeric group count enters its HTML.
    icon = createIcon.value({
      className: "project-map-icon",
      html: `<span class="project-map-pin">${pinSvg}${count > 1 ? `<span class="project-map-count">${count}</span>` : ""}</span>`,
      iconSize: [32, 42],
      iconAnchor: [16, 42],
      popupAnchor: [0, -42],
    });
    icons.set(count, icon);
  }
  return icon;
}
function fitProjects() {
  const map = mapRef.value?.leafletObject;
  if (!map) return;
  map.invalidateSize();
  const points = locations.value.map((location) => location.point);
  if (points.length > 1) map.fitBounds(points, { padding: [40, 40], maxZoom: 12, animate: false });
  else if (points.length === 1) map.setView(points[0]!, 12, { animate: false });
}
watch(
  () =>
    locations.value
      .map((location) => location.key)
      .sort()
      .join(";"),
  async () => {
    await nextTick();
    fitProjects();
  },
);
</script>
<style scoped>
@reference "../assets/css/main.css";
:deep(.project-map-pin) {
  display: block;
  position: relative;
  width: 32px;
  height: 42px;
  @apply text-light-blue;
}
:deep(.project-map-pin svg) {
  width: 100%;
  height: 100%;
}
:deep(.project-map-count) {
  position: absolute;
  top: -5px;
  right: -8px;
  min-width: 22px;
  height: 22px;
  padding: 0 4px;
  border-radius: 999px;
  @apply bg-light-green;
  @apply text-black;
  font-size: 12px;
  font-weight: 700;
  line-height: 22px;
  text-align: center;
}
:deep(.project-map-icon:focus-visible) {
  @apply outline-light-blue;
  outline-width: 3px;
  outline-style: solid;
  outline-offset: 4px;
  border-radius: 4px;
}
</style>

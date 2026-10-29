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
        <LPopup
          :options="{
            className: 'project-map-popup',
            minWidth: 220,
            maxWidth: 300,
            maxHeight: 260,
            autoPanPadding: [20, 20],
          }"
        >
          <div class="project-popup-heading">
            {{ $t("projects.map.marker_label", { ":count": location.projects.length }) }}
          </div>
          <ul class="project-popup-list">
            <li v-for="project in location.projects" :key="project.id">
              <NuxtLink :to="`/projects/${encodeURIComponent(project.slug)}`" class="project-popup-link">
                <span class="min-w-0">
                  <span class="project-popup-title">{{ project.title }}</span>
                  <span v-if="project.label" class="project-popup-label">{{ project.label }}</span>
                  <span class="project-popup-source">{{
                    $t(
                      project.location.source === "project"
                        ? "projects.map.project_location"
                        : "projects.map.municipality_location",
                    )
                  }}</span>
                </span>
                <span class="shrink-0" aria-hidden="true">→</span>
              </NuxtLink>
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

:deep(.project-map-popup .leaflet-popup-content-wrapper),
:deep(.project-map-popup .leaflet-popup-tip) {
  background: var(--slk-surface);
  color: var(--slk-text-strong);
}
:deep(.project-map-popup .leaflet-popup-content-wrapper) {
  padding: 0;
  border: 1px solid var(--slk-border);
  border-radius: 0.5rem;
}
:deep(.project-map-popup .leaflet-popup-content) {
  margin: 0;
  line-height: 1.4;
  font-family: inherit;
}
:deep(.project-map-popup .leaflet-popup-close-button) {
  color: var(--slk-text-muted);
}
.project-popup-heading {
  padding: 0.65rem 2rem 0.65rem 0.8rem;
  font-weight: 700;
  border-bottom: 1px solid var(--slk-border);
}
.project-popup-list {
  padding: 0;
  margin: 0;
  list-style: none;
}
.project-popup-list li + li {
  border-top: 1px solid var(--slk-border);
}
.project-popup-link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  min-height: 44px;
  padding: 0.65rem 0.8rem;
  color: var(--slk-text-strong);
  text-decoration: none;
}
.project-popup-link:hover,
.project-popup-link:focus-visible {
  background: var(--slk-surface-subdued);
}
.project-popup-link:focus-visible {
  outline: 2px solid var(--slk-blue);
  outline-offset: -2px;
}
.project-popup-title {
  display: block;
  font-weight: 700;
  overflow-wrap: anywhere;
}
.project-popup-label {
  display: block;
  margin-top: 0.15rem;
  color: var(--slk-text-muted);
  font-size: 0.75rem;
}
.project-popup-source {
  display: block;
  margin-top: 0.15rem;
  color: var(--slk-text-subtle);
  font-size: 0.7rem;
}
</style>

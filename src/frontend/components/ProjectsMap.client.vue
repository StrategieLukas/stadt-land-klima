<template>
  <LMap
    ref="mapRef"
    :zoom="6"
    :center="initialCenter"
    :use-global-leaflet="false"
    :options="{ scrollWheelZoom: false }"
    class="h-full w-full"
    @ready="fitProjects"
  >
    <LTileLayer :url="tileUrl" :subdomains="subdomains" :attribution="attribution" :max-zoom="20" />
    <template v-if="markerIcon">
      <LMarker v-for="location in locations" :key="location.key" :lat-lng="location.point" :icon="markerIcon">
        <LPopup>
          <strong>{{ location.municipalityName }}</strong>
          <ul class="mt-2 space-y-1">
            <li v-for="project in location.projects" :key="project.id">
              <a :href="`/projects/${project.slug}`">{{ project.title }} ↗</a>
            </li>
          </ul>
        </LPopup>
      </LMarker>
    </template>
  </LMap>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, shallowRef, watch } from "vue";
import type { DivIcon } from "leaflet";
import pinSvg from "~/assets/images/Pin.svg?raw";

type ProjectLocation = {
  id: number;
  slug: string;
  title: string;
  municipalityName: string;
  point: [number, number];
};

const props = defineProps<{ projects: ProjectLocation[] }>();
const { tileUrl, subdomains, attribution } = useCartoBasemap();
const mapRef = ref<{ leafletObject?: { fitBounds: (bounds: [number, number][], options: object) => void; setView: (center: [number, number], zoom: number) => void } } | null>(null);
const markerIcon = shallowRef<DivIcon | null>(null);

onMounted(async () => {
  const { divIcon } = await import("leaflet");
  markerIcon.value = divIcon({
    className: "",
    html: `<div class="h-8 w-8" style="color: #16bae7; width: 32px; height: 32px">${pinSvg}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
});

const locations = computed(() => {
  const groups = new Map<string, { key: string; point: [number, number]; municipalityName: string; projects: ProjectLocation[] }>();
  for (const project of props.projects) {
    const key = project.point.join(",");
    if (!groups.has(key)) groups.set(key, { key, point: project.point, municipalityName: project.municipalityName, projects: [] });
    groups.get(key)?.projects.push(project);
  }
  return [...groups.values()];
});

const initialCenter = computed<[number, number]>(() => locations.value[0]?.point ?? [51.1657, 10.4515]);

function fitProjects() {
  const points = locations.value.map((location) => location.point);
  if (points.length > 1) mapRef.value?.leafletObject?.fitBounds(points, { padding: [35, 35], maxZoom: 10 });
  else if (points.length === 1) mapRef.value?.leafletObject?.setView(points[0], 10);
}

watch(() => props.projects, async () => {
  await nextTick();
  fitProjects();
});
</script>

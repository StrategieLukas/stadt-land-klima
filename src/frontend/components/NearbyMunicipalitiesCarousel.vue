<template>
  <div v-if="loaded && nearbyAreas.length === 0" />

  <div v-else class="bg-gray-300 max-w-full overflow-hidden border-b border-t px-3 py-6 sm:px-4 lg:px-6">
    <div class="mb-4">
      <h3 class="text-gray-800 mb-2 text-lg font-semibold">
        {{ $t("administrative_areas.nearby_alternatives") }}
      </h3>
      <p class="text-gray-600 text-sm">
        {{ $t("administrative_areas.nearby_alternatives_description") }}
      </p>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center gap-2 py-8">
      <SlkFlowerSpinner :size="32" />
      <span class="text-blue-600">{{ $t("generic.loading") }}...</span>
    </div>

    <!-- Carousel -->
    <div v-else-if="nearbyAreas.length > 0">
      <div
        ref="scrollContainer"
        class="scrollbar-hide flex space-x-4 overflow-x-auto pb-4"
        :style="scrollMaskStyle"
        @scroll="updateShadows"
      >
        <div
          v-for="area in nearbyAreas"
          :key="area.ars"
          class="border-gray-200 flex w-64 max-w-full flex-none flex-col overflow-hidden rounded-lg border bg-white shadow-md transition-shadow hover:shadow-lg sm:w-72 lg:w-80"
        >
          <!-- Mini map -->
          <div class="from-green-100 relative flex h-32 items-center justify-center bg-gradient-to-br to-blue-100">
            <LMap
              :ref="
                (el) => {
                  if (el && 'leafletObject' in el)
                    nearbyMapRefs[area.ars] = el as ComponentPublicInstance & { leafletObject: LeafletMap };
                }
              "
              :zoom="10"
              :center="[area.geoCenter?.coordinates[1] || 51.1657, area.geoCenter?.coordinates[0] || 10.4515]"
              class="z-0 h-full w-full"
              :options="{ zoomControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false }"
              @ready="() => onNearbyMapReady(area.ars, area.geoArea)"
            >
              <LTileLayer
                :key="tileUrl"
                :url="tileUrl"
                :attribution="attribution"
                :subdomains="subdomains"
                :max-zoom="20"
              />
              <LGeoJson
                v-if="area.geoArea"
                :geojson="area.geoArea"
                :options="{ style: { color: '#3B82F6', weight: 2, fillColor: '#3B82F6', fillOpacity: 0.3 } }"
                v-on="{ ready: () => onNearbyGeoJsonReady(area.ars, area.geoArea) }"
              />
            </LMap>
          </div>

          <!-- Card body -->
          <div class="flex flex-1 flex-col justify-between p-3 sm:p-4">
            <!-- Name row with score badge -->
            <div class="mb-3 flex items-start justify-between gap-2">
              <div class="min-w-0 flex-1">
                <p class="text-gray-500 mb-1 text-xs font-semibold uppercase tracking-wide">
                  {{ area.prefix }}
                </p>
                <h4 class="text-gray-900 break-words text-sm font-bold leading-tight">
                  {{ area.name }}
                </h4>
              </div>
              <div class="flex-shrink-0">
                <!-- Complete or published: show numeric score -->
                <span
                  v-if="area.isComplete && area.scoreTotal != null"
                  class="inline-block rounded-full px-2 py-0.5 text-xs font-bold text-white"
                  :class="`bg-${scoreBgColor(area.scoreTotal)}`"
                >
                  {{ Math.round(area.scoreTotal) }}%
                </span>
                <!-- Localteam exists but not yet published -->
                <span
                  v-else-if="area.ctaType === 'in-progress'"
                  class="inline-block rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700"
                >
                  Bewertung läuft
                </span>
                <!-- No localteam -->
                <span
                  v-else
                  class="bg-gray-100 text-gray-400 inline-block rounded-full px-2 py-0.5 text-xs font-medium"
                >
                  Nicht bewertet
                </span>
              </div>
            </div>
            <!-- Links -->
            <div class="flex flex-col gap-1.5">
              <!-- Case: complete rating → show it -->
              <NuxtLink
                v-if="area.ctaType === 'complete'"
                :to="`/municipalities/${area.slug}?v=${catalogVersionName}`"
                class="inline-flex items-center text-xs font-medium text-[#AFCA0B] hover:text-lime-700 sm:text-sm"
              >
                <svg class="mr-1 h-3.5 w-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
                <span>Bewertung anzeigen</span>
              </NuxtLink>
              <!-- Case: localteam active, rating in progress → support them -->
              <NuxtLink
                v-else-if="area.ctaType === 'in-progress'"
                :to="`/contact?title=${encodeURIComponent('Lokalteam unterstützen in ' + area.name)}&type=cooperation&content=${encodeURIComponent('Ich möchte das Lokalteam in ' + area.name + ' bei der Bewertung unterstützen.\n\nMeine Kontaktdaten:\n')}`"
                class="inline-flex items-center text-xs font-medium text-green hover:opacity-80 sm:text-sm"
              >
                <svg class="mr-1 h-3.5 w-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
                <span>Lokalteam unterstützen</span>
              </NuxtLink>
              <!-- Case: no localteam → found one -->
              <NuxtLink
                v-else
                :to="`/register_localteam?ars=${area.ars}&name=${encodeURIComponent(area.name)}`"
                class="inline-flex items-center text-xs font-medium text-green hover:opacity-80 sm:text-sm"
              >
                <svg class="mr-1 h-3.5 w-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
                <span>Lokalteam gründen</span>
              </NuxtLink>
              <!-- Statistiken (always shown) -->
              <NuxtLink
                :to="`/data/${area.ars}`"
                class="inline-flex items-center text-xs font-medium text-blue-600 hover:text-blue-800 sm:text-sm"
              >
                <svg class="mr-1 h-3.5 w-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
                <span>Statistiken anzeigen</span>
              </NuxtLink>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// vue-leaflet omits ready events from its types; local object listeners preserve them. Owner: app maintainers.
import { z } from "zod";
import type { Map as LeafletMap } from "leaflet";
import type { ComponentPublicInstance } from "vue";
import { parseGeoData, parseGeoCenter, type GeoData } from "~/shared/contracts/geometry";
import { MunicipalitiesResponseSchema, scoreCatalogName } from "~/shared/contracts/search";
import type { NumericValue } from "~/shared/domain";

import { getScorePercentageColor } from "~/shared/utils";
import { isMunicipalityScoreComplete } from "~/shared/municipality-score-publishing";

const config = useRuntimeConfig();
const { attribution, subdomains, tileUrl } = useCartoBasemap();

const scoreBgColor = (scoreTotal: NumericValue) => getScorePercentageColor(scoreTotal);

const props = defineProps({
  ars: { type: String, required: true },
  catalogVersionId: { type: [String, Number], required: true },
  catalogVersionName: { type: String, required: true },
});

type NearbyArea = {
  ars: string;
  name: string;
  prefix: string;
  ctaType: string;
  isComplete: boolean;
  slug: string | null;
  scoreTotal: number | null;
  geoCenter: { coordinates: [number, number] } | null;
  geoArea: GeoData | null;
};
const nearbyAreas = ref<NearbyArea[]>([]);
const loading = ref(false);
const loaded = ref(false);
const nearbyMapRefs = ref<Record<string, { leafletObject: LeafletMap }>>({});

const scrollContainer = ref<HTMLElement | null>(null);
const showLeftShadow = ref(false);
const showRightShadow = ref(true);

const scrollMaskStyle = computed(() => {
  const left = showLeftShadow.value ? "transparent, black 32px" : "black";
  const right = showRightShadow.value ? "black calc(100% - 32px), transparent" : "black";
  const gradient = `linear-gradient(to right, ${left}, ${right})`;
  return {
    maskImage: gradient,
    WebkitMaskImage: gradient,
  };
});

const updateShadows = () => {
  if (!scrollContainer.value) return;
  const { scrollLeft, scrollWidth, clientWidth } = scrollContainer.value;
  showLeftShadow.value = scrollLeft > 0;
  showRightShadow.value = scrollLeft < scrollWidth - clientWidth - 1;
};

const fitBoundsToGeoArea = async (ars: string, geoArea: GeoData | null) => {
  const mapRef = nearbyMapRefs.value[ars];
  if (!geoArea || !mapRef?.leafletObject) return;
  try {
    const leafletMap = mapRef.leafletObject;
    const { geoJSON } = await import("leaflet");
    const geoJsonLayer = geoJSON(geoArea);
    const bounds = geoJsonLayer.getBounds();
    if (bounds.isValid()) {
      leafletMap.fitBounds(bounds, { padding: [20, 20], maxZoom: 12 });
    }
  } catch (err) {
    console.warn("Could not fit bounds for nearby map:", err);
  }
};

const onNearbyMapReady = (ars: string, geoArea: GeoData | null) => {
  setTimeout(() => {
    const mapRef = nearbyMapRefs.value[ars];
    if (mapRef?.leafletObject) {
      mapRef.leafletObject.invalidateSize();
      void fitBoundsToGeoArea(ars, geoArea);
    }
  }, 100);
  setTimeout(() => {
    const mapRef = nearbyMapRefs.value[ars];
    if (mapRef?.leafletObject) {
      mapRef.leafletObject.invalidateSize();
      void fitBoundsToGeoArea(ars, geoArea);
    }
  }, 500);
};

const onNearbyGeoJsonReady = (ars: string, geoArea: GeoData | null) => {
  void nextTick(() => {
    const mapRef = nearbyMapRefs.value[ars];
    if (mapRef?.leafletObject) {
      mapRef.leafletObject.invalidateSize();
      void fitBoundsToGeoArea(ars, geoArea);
    }
  });
  setTimeout(() => {
    const mapRef = nearbyMapRefs.value[ars];
    if (mapRef?.leafletObject) {
      mapRef.leafletObject.invalidateSize();
      void fitBoundsToGeoArea(ars, geoArea);
    }
  }, 300);
};

const fetchMunicipalityData = async (ars: string) => {
  try {
    const catalogs = await getAllCatalogVersions();
    const version = catalogs.find((catalog) => catalog.id === props.catalogVersionId);
    if (!version) return null;
    const { municipalities } = MunicipalitiesResponseSchema.parse(
      await $fetch("/api/public/area-municipalities", { query: { ars, v: version.name } }),
    );
    const municipality = municipalities[0];
    return municipality
      ? { municipality, score: municipality.scores.find((score) => scoreCatalogName(score) === version.name) ?? null }
      : null;
  } catch {
    return null;
  }
};

onMounted(async () => {
  if (!props.ars) return;
  loading.value = true;
  try {
    const baseUrl = config.public.stadtlandzahlBaseUrl;
    const res = await fetch(`${baseUrl}/api/areas/${props.ars}/bordering-municipalities/`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = z
      .object({
        bordering_municipalities: z.array(
          z.object({
            ars: z.string(),
            name: z.string(),
            prefix: z.string(),
            geo_center: z.unknown().optional(),
            geo_area: z.unknown().optional(),
          }),
        ),
      })
      .parse(await res.json());

    if (data?.bordering_municipalities?.length) {
      const areas = await Promise.all(
        data.bordering_municipalities.map(async (area) => {
          const result = await fetchMunicipalityData(area.ars);
          const municipality = result?.municipality ?? null;
          const score = result?.score ?? null;
          const isComplete = isMunicipalityScoreComplete(score) && !!municipality?.slug;
          const hasLocalteam = !!municipality?.localteam_id;
          // 'complete'    → published score with all catalog measures rated → show rating
          // 'in-progress' → has a localteam but no complete published score → support the team
          // 'none'        → no localteam at all → found a team
          const ctaType = isComplete ? "complete" : hasLocalteam ? "in-progress" : "none";
          return {
            ars: area.ars,
            name: area.name,
            prefix: area.prefix,
            ctaType,
            isComplete,
            slug: isComplete ? (municipality?.slug ?? null) : null,
            scoreTotal: score?.score_total == null ? null : Number(score.score_total),
            geoCenter: (() => {
              const c = parseGeoCenter(area.geo_center);
              return c ? { coordinates: [c.lon, c.lat] as [number, number] } : null;
            })(),
            geoArea: parseGeoData(area.geo_area),
          };
        }),
      );
      nearbyAreas.value = areas;
    }
  } catch (err) {
    console.error("NearbyMunicipalitiesCarousel: failed to fetch nearby municipalities", err);
  } finally {
    loading.value = false;
    loaded.value = true;
    await nextTick();
    requestAnimationFrame(() => requestAnimationFrame(updateShadows));
  }
});
</script>

<template>

  <div class="top-4 left-4 bg-white rounded shadow p-2 z-[1000]">
    <label class="flex items-center gap-2 text-sm font-medium">
      <input type="checkbox" v-model="showMunicipalitiesWithUnfinishedRating" class="toggle toggle-sm" />
      {{ $t('map.showUnfinishedRatings') }}
    </label>
  </div>

  <ClientOnly>
    <div class="w-full h-screen z-0">
      <!-- ★ render map as soon as client is ready (don’t wait for data) -->
      <LMap
        v-if="clientReady"
        :zoom="6"
        :center="[51.1657, 10.4515]"
        style="height: 100%; width: 100%"
        ref="mapRef"
        @ready="onMapReady"
      >
        <LTileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
          layer-type="base"
          name="OpenStreetMap"
        />

        <!-- ★ markers render when municipalities arrive -->
        <LMarker
          v-for="m in municipalities"
          :key="m.slug"
          :lat-lng="[m.lat, m.lng]"
          :icon="getCustomIcon(m)"
        >
          <LPopup>
            <div class="text-sm space-y-1">
              <div class="font-semibold">{{ m.name }}</div>
              <template v-if="m.status === 'published'">
                <div>Score: {{ Number(m.score_total).toFixed(2) }}</div>
                <NuxtLink :to="`/municipalities/${m.slug}`" class="text-blue-600 underline hover:text-blue-800">
                  {{ $t("map.icon.popup.goToRanking") }}
                </NuxtLink>
              </template>
              <template v-else>
                <div>{{ $t("map.icon.popup.ratingNotFinished") }}</div>
                <div>
                  {{ $t("map.icon.popup.percentageRated", { ":percentage_rated": m.percentage_rated }) }}
                </div>
              </template>
            </div>
          </LPopup>
        </LMarker>
      </LMap>
    </div>
  </ClientOnly>
</template>

<script setup>
import { ref, onMounted, watch } from "vue";
import { LMap, LTileLayer, LMarker, LPopup } from "@vue-leaflet/vue-leaflet";
import "leaflet/dist/leaflet.css";

const showMunicipalitiesWithUnfinishedRating = ref(false)
const clientReady = ref(false)
const municipalities = ref([])
const PinSvg = ref("")
const leaflet = ref(null)
let DivIcon = null
let mapInstance = null
let legendControl = null

const { $directus, $readItems, $t } = useNuxtApp()

onMounted(async () => {
  leaflet.value = await import("leaflet");
  DivIcon = leaflet.value.DivIcon
  PinSvg.value = (await import("~/assets/images/Pin.svg?raw")).default;
  clientReady.value = true
  await fetchMunicipalities()
})

watch(showMunicipalitiesWithUnfinishedRating, async () => {
  await fetchMunicipalities()
  if (mapInstance) {
    if (legendControl) mapInstance.removeControl(legendControl)
    addLegend(mapInstance)
  }
})

function onMapReady(map) {
  mapInstance = map
  addLegend(map)
}

function addLegend(map) {
  if (!leaflet.value) return
  const L = leaflet.value
  legendControl = L.control({ position: "topright" })
  legendControl.onAdd = () => {
    const div = L.DomUtil.create(
      "div",
      "bg-white rounded-lg shadow-lg p-3 m-2 space-y-1 text-sm"
    )
    const lines = [
      ["text-ranking-8-10", "Score 80-100%"],
      ["text-ranking-6-8", "Score 60-79%"],
      ["text-ranking-4-6", "Score 40-59%"],
      ["text-ranking-2-4", "Score 20-39%"],
      ["text-ranking-0-2", "Score 0-19%"],
      [
        "text-ranking-na",
        $t("map.icon.popup.ratingNotFinished.short"),
        !showMunicipalitiesWithUnfinishedRating.value
      ],
    ]
    div.innerHTML = lines
    .map(([cls, text, hidden]) => {
        const style = hidden
        ? "height:0; overflow:hidden; margin:0; padding:0;" // hides without affecting width
        : "";
        return `<div class="flex items-center gap-2 ${cls}" style="${style}">
        <div class="w-4 h-4">${PinSvg.value}</div>
        <span>${text}</span>
        </div>`;
    })
    .join("");
    return div
  }
  legendControl.addTo(map)
}


function getCustomIcon(m) {
  if (!DivIcon || !PinSvg.value) return null
  let cssClass = "ranking-na"
  const { score_total, status } = m
  if (status === "published") {
    if (score_total < 20) cssClass = "ranking-0-2"
    else if (score_total < 40) cssClass = "ranking-2-4"
    else if (score_total < 60) cssClass = "ranking-4-6"
    else if (score_total < 80) cssClass = "ranking-6-8"
    else cssClass = "ranking-8-10"
  }
  return new DivIcon({
    className: "",
    html: `<div class="text-${cssClass} w-8 h-8">${PinSvg.value}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  })
}

async function fetchMunicipalities() {
  const filter = showMunicipalitiesWithUnfinishedRating.value
    ? { percentage_rated: { _gt: 0 } }
    : { status: { _eq: 'published' } }
  const baseData = await $directus.request(
    $readItems('municipalities', {
      fields: ['slug', 'name', 'score_total', 'status', 'percentage_rated', 'geolocation'],
      filter,
      limit: -1,
    })
  )
  municipalities.value = baseData
    .map((m) => {
      const coords = m.geolocation?.coordinates
      return {
        ...m,
        lat: typeof coords?.[1] === 'number' ? coords[1] : null,
        lng: typeof coords?.[0] === 'number' ? coords[0] : null,
      }
    })
    .filter((m) => typeof m.lat === 'number' && typeof m.lng === 'number')
}

</script>

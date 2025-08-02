<template>
  <div class="w-full h-screen">
    <LMap :zoom="6" :center="[51.1657, 10.4515]" style="height: 100%; width: 100%">
      <LTileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="&copy; OpenStreetMap contributors"
      />

      <LMarker
        v-for="m in municipalities"
        :key="m.slug"
        v-memo="[m.lat, m.lng, m.status]"
        :lat-lng="[m.lat, m.lng]"
        :icon="getCustomIcon(m.status, m.percentageRated)"
      >
        <LPopup>{{ m.name }}</LPopup>
      </LMarker>
    </LMap>
  </div>
</template>

<script setup>
import { LMap, LTileLayer, LMarker, LPopup } from '@vue-leaflet/vue-leaflet'
import 'leaflet/dist/leaflet.css'
import { useAsyncData } from 'nuxt/app'
import PinSvg from '~/assets/icon/Pin.svg?raw'
import { DivIcon } from 'leaflet'

const { $directus, $readItems } = useNuxtApp()

// Load municipality data
const { data: municipalities } = await useAsyncData('municipalities', () => {
  return $directus.request(
    $readItems('municipalities', {
      fields: ['slug', 'name', 'score_total', 'status', 'percentage_rated'],
      limit: -1,
    })
  )
})

// TODO: Fetch lat/lon for the municipality based on its slug (generate a placeholder api living in municipalities.js that is called here, and merge the data with the other 4 fields)

// Generate dynamic DivIcon using embedded SVG
function getCustomIcon(status, score, percentageRated) {
  let cssClass = statusColors.unknown
  if (status === 'published') {
    // TODO set cssClass to ranking-0-2, ranking-2-4, etc based on its score (<20 -> ranking-0-2, <40 ranking-2-4, etc until ranking-8-10). Classes for these exist.
  } else if (percentageRated > 0) {
    cssClass = 'text-rating-na'
  } else {
    console.error("Municipality fetched that is unpublished and has percentageRated=0, this should have been filtered out before")
  }

  const svgColored = `<div class="${cssClass}">${PinSvg}</div>`

  return new DivIcon({
    className: '', // remove Leaflet's default
    html: svgColored,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  })
}
</script>

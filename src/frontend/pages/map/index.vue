<template>
  <client-only>
    <div class="w-full h-screen">
      <LMap
        v-if="clientReady && municipalities.length"
        :zoom="6"
        :center="[51.1657, 10.4515]"
        style="height: 100%; width: 100%"
      >
        <LTileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&amp;copy; <a href=&quot;https://www.openstreetmap.org/&quot;>OpenStreetMap</a> contributors"
            layer-type="base"
            name="OpenStreetMap"
        />
        <LMarker
          v-for="m in municipalities"
          :key="m.slug"
          :lat-lng="[m.lat, m.lng]"
          :icon="getCustomIcon(m)"
        >
          <LPopup>{{ m.name }}</LPopup>
        </LMarker>
      </LMap>
    </div>
  </client-only>
</template>


<script setup>

import { onMounted, ref } from 'vue'
const clientReady = ref(false)
const municipalities = ref([])
const { $directus, $readItems, $municipalityApi, $t } = useNuxtApp()
let DivIcon

onMounted(async () => {
  const leaflet = await import('leaflet')
  DivIcon = leaflet.DivIcon
  
  
  clientReady.value = true

  const PinSvg = (await import('~/assets/images/Pin.svg?raw')).default

  getCustomIcon = (m) => {
    let cssClass = 'rating-na'
    const score = m.score_total
    const status = m.status
    const percentageRated = m.percentage_rated

    if (status === 'published') {
      if (score < 20) cssClass = 'rating-0-2'
      else if (score < 40) cssClass = 'rating-2-4'
      else if (score < 60) cssClass = 'rating-4-6'
      else if (score < 80) cssClass = 'rating-6-8'
      else cssClass = 'rating-8-10'
    } else if (percentageRated <= 0) {
      console.error('Municipality with percentage_rated of 0 should be filtered out before')
    }

    return new DivIcon({
      className: '',
      html: `<div class="${cssClass}">${PinSvg}</div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32],
    })
  }

  // Fetch municipalities
  const baseData = await $directus.request(
    $readItems('municipalities', {
      fields: ['slug', 'name', 'score_total', 'status', 'percentage_rated'],
      filter: { percentage_rated: { _gt: 0 } },
      limit: -1,
    })
  )

  const slugs = baseData.map((m) => m.slug)
  const locationData = await $municipalityApi.getMunicipalityLocations(slugs)
  const locationMap = new Map(locationData.map((m) => [m.slug, m]))

  const merged = baseData
    .map((m) => {
      const loc = locationMap.get(m.slug)
      return {
        ...m,
        lat: loc?.lat,
        lng: loc?.lng,
      }
    })
    .filter((m) => {
      const isValid = typeof m.lat === 'number' && typeof m.lng === 'number'
      if (!isValid) {
        console.warn(`[Map] Municipality '${m.slug}' filtered out due to missing lat/lng`)
      }
      return isValid
    })

  municipalities.value = merged
  console.log('[Map] Loaded municipalities:', merged.length)
})




import PinSvg from '~/assets/images/Pin.svg?raw'

function getCustomIcon(status, score, percentageRated) {
    let cssClass = 'rating-na'

    if (status === 'published') {
        if (score < 20) cssClass = 'rating-0-2'
        else if (score < 40) cssClass = 'rating-2-4'
        else if (score < 60) cssClass = 'rating-4-6'
        else if (score < 80) cssClass = 'rating-6-8'
        else cssClass = 'rating-8-10'
    } else if (percentageRated <= 0) {
        console.error("Municipality with percentage_rated of 0 should be filtered out before")
    }

    return new DivIcon({
        className: '',
        html: `<div class="${cssClass}">${PinSvg}</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32],
    })
}


const title = ref($t("map.title"));
useHead({
  title,
});
</script>

<template>
    <div class="top-4 left-4 bg-white rounded shadow p-2 z-[1000]">
        <label class="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" v-model="showInProgress" class="toggle toggle-sm" />
            {{ $t('map.showInProgress') }}
        </label>
    </div>

    <client-only>
        <div class="w-full h-screen">
            <LMap v-if="clientReady && municipalities.length" :zoom="6" :center="[51.1657, 10.4515]"
                style="height: 100%; width: 100%">
                <LTileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
                    layer-type="base" name="OpenStreetMap" />
                <LMarker v-for="m in municipalities" :key="m.slug" :lat-lng="[m.lat, m.lng]" :icon="getCustomIcon(m)">
                    <LPopup>{{ m.name }}</LPopup>
                </LMarker>
            </LMap>
        </div>
    </client-only>
</template>

<script setup>
import { onMounted, ref } from 'vue'
// Toggle for whether municipalities, where the rating is currently in progress, should be displayed
const showInProgress = ref(false)

watch(showInProgress, () => {
    fetchMunicipalities()
})


const clientReady = ref(false)
const municipalities = ref([])

const { $directus, $readItems, $municipalityApi, $t } = useNuxtApp()

const PinSvg = ref('')
let DivIcon

onMounted(async () => {
    const leaflet = await import('leaflet')
    DivIcon = leaflet.DivIcon

    clientReady.value = true

    const rawSvg = (await import('~/assets/images/Pin.svg?raw')).default
    PinSvg.value = rawSvg

    await fetchMunicipalities()
})


/**
 * Returns a Leaflet icon with colored SVG based on municipality rating
 */
function getCustomIcon(m) {
    if (!DivIcon || !PinSvg.value) return null

    let cssClass = 'rating-na'
    const { score_total, status, percentage_rated } = m

    if (status === 'published') {
        if (score_total < 20) cssClass = 'ranking-0-2'
        else if (score_total < 40) cssClass = 'ranking-2-4'
        else if (score_total < 60) cssClass = 'ranking-4-6'
        else if (score_total < 80) cssClass = 'ranking-6-8'
        else cssClass = 'ranking-8-10'
    }
    if (percentage_rated <= 0) {
        console.warn("Should have filtered out any municipalities with percentage_rated of 0 at this point in processing!")
    }

    return new DivIcon({
        className: '', // Don't use Leaflet default styles
        html: `<div class="text-${cssClass} w-8 h-8">${PinSvg.value}</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32],
    })
}

async function fetchMunicipalities() {
    // When "show in progress" is toggled on, show any municipality where percentage_rated > 0 (i.e. rating was started)
    // Otherwise, only show the published ones
    const filter = showInProgress.value
        ? { percentage_rated: { _gt: 0 } }
        : { status: { _eq: 'published' } }

    const baseData = await $directus.request(
        $readItems('municipalities', {
            fields: ['slug', 'name', 'score_total', 'status', 'percentage_rated'],
            filter,
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
}


const title = ref($t('map.title'))
useHead({ title })
</script>

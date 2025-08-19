<template>

    <div class="space-y-1 text-sm">
        <div class="flex items-center gap-2 text-ranking-8-10">
            <div class="w-4 h-4" v-html="PinSvg"></div>
            <span>Score 80-100%</span>
        </div>
        <div class="flex items-center gap-2 text-ranking-6-8">
            <div class="w-4 h-4" v-html="PinSvg"></div>
            <span>Score 60-79%</span>
        </div>
        <div class="flex items-center gap-2 text-ranking-4-6">
            <div class="w-4 h-4" v-html="PinSvg"></div>
            <span>Score 40-59%</span>
        </div>
        <div class="flex items-center gap-2 text-ranking-2-4">
            <div class="w-4 h-4" v-html="PinSvg"></div>
            <span>Score 20-39%</span>
        </div>
        <div class="flex items-center gap-2 text-ranking-0-2">
            <div class="w-4 h-4" v-html="PinSvg"></div>
            <span>Score 0-19%</span>
        </div>
        <div v-if="showMunicipalitiesWithUnfinishedRating" class="flex items-center gap-2 text-ranking-na">
            <div class="w-4 h-4" v-html="PinSvg"></div>
            <span>{{ $t('map.icon.popup.ratingNotFinished.short') }}</span>
        </div>
    </div>






    <div class="top-4 left-4 bg-white rounded shadow p-2 z-[1000]">
        <label class="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" v-model="showMunicipalitiesWithUnfinishedRating" class="toggle toggle-sm" />
            {{ $t('map.showUnfinishedRatings') }}
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
                    <LPopup>
                        <div class="text-sm space-y-1">
                            <div class="font-semibold">{{ m.name }}</div>
                            <template v-if="m.status === 'published'">
                                <div>Score: {{ Number(m.score_total).toFixed(2) }}</div>
                                <NuxtLink :to="`/municipalities/${m.slug}`"
                                    class="text-blue-600 underline hover:text-blue-800">
                                    {{ $t("map.icon.popup.goToRanking") }}
                                </NuxtLink>
                            </template>
                            <template v-else>
                                <div>{{ $t("map.icon.popup.ratingNotFinished") }}</div>
                                <div>{{ $t("map.icon.popup.percentageRated", {
                                    ":percentage_rated": m.percentage_rated
                                }) }}</div>
                            </template>
                        </div>
                    </LPopup>

                </LMarker>
            </LMap>
        </div>
    </client-only>
</template>

<script setup>
import { onMounted, ref } from 'vue'
// Toggle for whether municipalities, where the rating is currently in progress, should be displayed
const showMunicipalitiesWithUnfinishedRating = ref(false)

watch(showMunicipalitiesWithUnfinishedRating, () => {
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

    let cssClass = 'ranking-na'
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
  const filter = showMunicipalitiesWithUnfinishedRating.value
    ? { percentage_rated: { _gt: 0 } }
    : { status: { _eq: 'published' } };

  const baseData = await $directus.request(
    $readItems('municipalities', {
      fields: ['slug', 'name', 'score_total', 'status', 'percentage_rated', 'geolocation'],
      filter,
      limit: -1,
    })
  );

  const merged = baseData
    .map((m) => {
      const coords = m.geolocation?.coordinates;
      return {
        ...m,
        lat: typeof coords?.[1] === 'number' ? coords[1] : null,
        lng: typeof coords?.[0] === 'number' ? coords[0] : null,
      };
    })
    .filter((m) => {
      const isValid = typeof m.lat === 'number' && typeof m.lng === 'number';
      if (!isValid) {
        console.debug(`[Map] Municipality '${m.slug}' filtered out due to missing or invalid geolocation`);
      }
      return isValid;
    });

  municipalities.value = merged;
  console.log('[Map] Loaded municipalities:', merged.length);
}


const title = ref($t('map.title'))
useHead({ title })
</script>

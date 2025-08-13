<template>
  <div>
    <TheMap :municipalities="municipalities" />
  </div>
</template>

<script setup>
import TheMap from '~/components/TheMap.vue'
import { ref, onMounted } from 'vue'

const municipalities = ref([])

const { $directus, $readItems, $t } = useNuxtApp()

async function fetchMunicipalities() {
  const baseData = await $directus.request(
    $readItems('municipalities', {
      fields: ['slug', 'name', 'score_total', 'status', 'percentage_rated', 'geolocation'],
      limit: -1
    })
  )

  municipalities.value = baseData
    .map((m) => {
      const coords = m.geolocation?.coordinates
      return {
        ...m,
        lat: typeof coords?.[1] === 'number' ? coords[1] : null,
        lng: typeof coords?.[0] === 'number' ? coords[0] : null
      }
    })
    .filter((m) => typeof m.lat === 'number' && typeof m.lng === 'number')
}

onMounted(() => {
  fetchMunicipalities()
})

const title = ref($t('map.title'))
useHead({ title })
</script>

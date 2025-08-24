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
  municipalities.value = await $directus.request(
    $readItems('municipalities', {
      fields: ['slug', 'name', 'score_total', 'status', 'percentage_rated', 'geolocation'],
      limit: -1,
      filter: { 
        percentage_rated: { _gt: 0 },
        geolocation: { _nnull: true }
       },
    })
  )
}

onMounted(() => {
  fetchMunicipalities()
})

const title = ref($t('map.title'))
useHead({ title })
</script>

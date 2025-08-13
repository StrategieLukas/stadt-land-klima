<template>
    <TheMap/>
</template>

<script setup>
import TheMap from "~/components/TheMap.vue"
const { $t } = useNuxtApp()

const title = ref($t('map.title'))
useHead({ title })
</script>

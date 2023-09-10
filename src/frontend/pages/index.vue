<template>
    <div>
        <h1 class="text-3xl font-bold underline">
            Hello world!
        </h1>
        <city-polar-chart></city-polar-chart>
        <TheRanking :kommunen="kommunen"></TheRanking>
    </div>
</template>
<script setup>
const { $directus, $readItems } = useNuxtApp()

const { data: kommunen } = await useAsyncData('kommunen', () => {
    return $directus.request(
        $readItems('kommunen', {
            fields: ['slug', 'name', 'score_total'],

        })
    )
})
</script>
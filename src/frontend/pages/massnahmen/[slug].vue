<template>
  <div>
    <h1>{{massnahme[0].name}}</h1>
	<Kommune></Kommune>
  </div>
</template>
<script setup >
const { $directus, $readItems } = useNuxtApp()
const route = useRoute()

const { data: massnahme }= await useAsyncData('massnahmen', () => {
	return $directus.request(
		$readItems('massnahmen', {
		
			filter:{"slug": {"_eq": route.params.slug}}
		})
	)
})
console.log(massnahme)

</script>
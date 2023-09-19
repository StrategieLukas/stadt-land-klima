<template>
    <div>
        <h1>{{page[0].name}}</h1>
    </div>
  </template>
  <script setup >
  const { $directus, $readItems } = useNuxtApp()
  const route = useRoute()
  
  const { data: page }= await useAsyncData('page', () => {
      return $directus.request(
          $readItems('pages', {
          
              filter:{"slug": {"_eq": route.params.slug}}
          })
      )
  })
  console.log(page)
  
  </script>
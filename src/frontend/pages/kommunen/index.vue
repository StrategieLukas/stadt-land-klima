<template>
  <div>
    <h1>Alle Städte und Kreise</h1>
    <ul>
      <li v-for="kommune in kommunen" :key="kommune.id">
        <NuxtLink :href="`/kommunen/${kommune.slug}`">
          <h1>{{ kommune.name }}</h1>
        </NuxtLink>
      </li>
    </ul>
  </div>
</template>

<script setup>
const { $directus, $readItems } = useNuxtApp();

const { data: kommunen } = await useAsyncData('kommunen', () => {
  return $directus.request(
    $readItems('kommunen', {
      fields: ['slug', 'name', 'score_total'],
    }),
  );
});
console.log('LOG:', kommunen);
</script>

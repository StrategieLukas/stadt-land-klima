<template>
  <div>
    <h1>Alle Maßnahmen:</h1>
    <ul>
      <li v-for="massnahme in massnahmen" :key="massnahme.id">
        <NuxtLink :href="`/massnahmen/${massnahme.slug}`">
          <h1>{{ massnahme.name }}</h1>
        </NuxtLink>
      </li>
    </ul>
  </div>
</template>

<script setup>
const { $directus, $readItems } = useNuxtApp();

const { data: massnahmen } = await useAsyncData('massnahmen', () => {
  return $directus.request(
    $readItems('massnahmen', {
      fields: ['slug', 'name'],
    }),
  );
});
console.log('LOG:', massnahmen);
</script>

<template>
  <div>
    <h1>{{ $t('municipalities.heading') }}</h1>
    <ul>
      <li v-for="municipality in municipalities" :key="municipality.id">
        <NuxtLink :to="'/municipalities/' + municipality.slug">
          <h1>{{ municipality.name }}</h1>
        </NuxtLink>
      </li>
    </ul>
  </div>
</template>

<script setup>
const { $directus, $readItems, $t } = useNuxtApp();

const { data: municipalities } = await useAsyncData("municipalities", () => {
  return $directus.request(
    $readItems("municipalities", {
      fields: ["slug", "name", "score_total"],
      limit: -1,
    }),
  );
});
</script>

<template>
  <NuxtLink :to="`/massnahmen/sektoren/${massnahme.sektor}`" class="btn btn-ghost normal-case mt-4">
    Zurück zum Bereich {{ $t(`measure_categories.${massnahme.sektor}.title`) }}
  </NuxtLink>

  <article class="mb-8 mt-10 flex items-start gap-4">
    <div class="prose">
      <h1>{{ massnahme.name }}</h1>
      <div v-html="massnahme.erklaerung" />
    </div>
  </article>
</template>
<script setup>
const { $directus, $readItems, $t } = useNuxtApp();
const route = useRoute();

const { data: massnahmen } = await useAsyncData("massnahmen", () => {
  return $directus.request(
    $readItems("massnahmen", {
      filter: { slug: { _eq: route.params.slug } },
      limit: 1,
    }),
  );
});
const massnahme = massnahmen.value[0] || null;
</script>

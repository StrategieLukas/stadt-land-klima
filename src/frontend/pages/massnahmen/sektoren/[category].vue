<template>
  <NuxtLink to="/massnahmen" class="btn btn-ghost normal-case mt-4">
    Zurück zu den Bereichen
  </NuxtLink>
  <div class="mb-8 mt-10 flex items-start gap-4">
    <img :src="categoryImages[route.params.category]" alt="" class="w-24 h-auto opacity-50" />

    <div class="prose">
      <h1>{{ $t(`measure_categories.${route.params.category}.title`) }}</h1>
      {{ $t(`measure_categories.${route.params.category}.description`) }}
    </div>
  </div>
  <div class="prose">
    <h2>Maßnahmen im Bereich {{ $t(`measure_categories.${route.params.category}.title`) }}</h2>
  </div>
  <ul>
    <li
      v-for="measure in massnahmen"
      class="mb-4"
    >
      <NuxtLink :to="`/massnahmen/${measure.slug}`" class="card card-compact shadow">
        <div class="card-body prose hover:underline focus:underline">
          <h3>{{ measure.name }}</h3>
        </div>
      </NuxtLink>
    </li>
  </ul>
</template>
<script setup>
import categoryImages from '../../shared/categoryImages.js';
const { $directus, $readItems, $t } = useNuxtApp();
const route = useRoute();

const { data: massnahmen } = await useAsyncData("massnahmen", () => {
  return $directus.request(
    $readItems("massnahmen", {
      filter: { sektor: { _eq: route.params.category } },
      limit: -1,
    }),
  );
});
console.log(massnahmen.value);
</script>

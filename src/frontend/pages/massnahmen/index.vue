<template>
  <div class="prose mb-8 mt-10">
    <h1>Maßnahmen zur CO<sub>2</sub>-Reduktion:</h1>
    <p>
      Einführungstext Auch gibt es niemanden, der den Schmerz an sich liebt, sucht oder wünscht, nur, weil er Schmerz ist, es sei denn, es kommt zu zufälligen Umständen, in denen Mühen und Schmerz ihm große Freude bereiten können.
    </p>
  </div>
  <ul>
    <li
      v-for="category in categories" :key="category"
      class="mb-4"
    >
      <NuxtLink :to="`/massnahmen/sektoren/${category}`" class="card card-compact shadow">
        <div class="card-body">
          <div class="flex items-start gap-4">
            <img :src="categoryImages[category]" alt="" class="w-24 h-auto opacity-50" />

            <div class="prose">
              <h3>{{ $t(`measure_categories.${category}.title`) }}</h3>
              {{ $t(`measure_categories.${category}.description`) }}
            </div>
          </div>
        </div>
      </NuxtLink>
    </li>
  </ul>
</template>

<script setup>
import { includes } from 'lodash';
import { ref } from 'vue';
import categoryImages from '../../shared/categoryImages.js';
const { $directus, $readItems, $t } = useNuxtApp();
const categories = ref([]);

const { data: massnahmen } = await useAsyncData("massnahmen", () => {
  return $directus.request(
    $readItems("massnahmen", {
      fields: ["slug", "name", "sektor"],
    }),
  );
});

massnahmen.value.forEach((massnahme) => {
  if (!massnahme.sektor) {
    return;
  }

  if (!includes(categories.value, massnahme.sektor)) {
    categories.value.push(massnahme.sektor);
  }
});
</script>

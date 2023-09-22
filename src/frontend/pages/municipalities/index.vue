<template>
  <div class="prose text-center max-w-full mt-10 mb-4">
    <h1 class="mb-0">
      {{ $t('municipalities.heading') }}
    </h1>
    <p class="mt-0">
      {{ $t('municipalities.last_updated_at', {':updated_at': lastUpdatedAtStr }) }}
    </p>
  </div>
  <div class="mx-auto flex justify-center mb-8">
    <implementation-traffic-light />
  </div>
  <section>
    <ul>
      <li v-for="municipality in municipalities" :key="municipality.id">
        <NuxtLink :to="'/municipalities/' + municipality.slug">
          <h1>{{ municipality.name }}</h1>
        </NuxtLink>
      </li>
    </ul>
  </section>
</template>

<script setup>
import { sortBy, last, get } from 'lodash';
import { format } from 'date-fns';
const { $directus, $readItems, $t, $locale } = useNuxtApp();

const { data: municipalities } = await useAsyncData("municipalities", () => {
  return $directus.request(
    $readItems("municipalities", {
      fields: ["slug", "name", "score_total", "date_updated"],
      limit: -1,
    }),
  );
});

const lastUpdatedAt = new Date(get(last(sortBy(municipalities.value, ['date_updated'])), 'date_updated'));
const lastUpdatedAtStr = lastUpdatedAt.toLocaleDateString($locale, {year: 'numeric', month: '2-digit', day: 'numeric'}) + ', ' + lastUpdatedAt.toLocaleTimeString($locale);
</script>

<template>
  <div>
    <NuxtLink :to="`/measures/sectors/${measure.sector}`" class="btn btn-ghost mt-4 normal-case">
      {{ $t("measure.back_label", { ":sector": $t(`measure_sectors.${measure.sector}.title`) }) }}
    </NuxtLink>

    <article class="mb-8 mt-10 flex items-start gap-4">
      <div class="prose">
        <h1>{{ measure.name }}</h1>
        <div v-html="measure.description" />
      </div>
    </article>
  </div>
</template>
<script setup>
const { $directus, $readItems, $t } = useNuxtApp();
const route = useRoute();

const { data: measures } = await useAsyncData("measures", () => {
  return $directus.request(
    $readItems("measures", {
      filter: { slug: { _eq: route.params.slug } },
      limit: 1,
    }),
  );
});
const measure = measures.value[0] || null;
</script>

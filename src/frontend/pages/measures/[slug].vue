<template>
  <div v-if="measure" >
    <NuxtLinkLocale :to="`/measures/sectors/${measure.sector}`" class="font-heading text-h4 text-light-blue">
      {{ t("measure.back_label", { ":sector": t(`measure_sectors.${measure.sector}.title`) }) }}
    </NuxtLinkLocale>

    <article class="mb-8 mt-10 flex items-start gap-4">
      <div class="prose">
        <h1>{{ measure.name }}</h1>
        <div v-html="measure.description" />
      </div>
    </article>
  </div>
  <p v-else class="prose py-8">
    {{ t("page_not_found") }}
  </p>
</template>
<script setup>
const { $directus, $readItems } = useNuxtApp();
const { t } = useI18n();
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

//MetaTags
const title = measure ? ref(measure.name) : t("page_not_found");
useHead({
  title,
});
//
</script>

<template>
  <div>
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
const title = ref(measure.name);
useHead({
  title,
});
//
</script>

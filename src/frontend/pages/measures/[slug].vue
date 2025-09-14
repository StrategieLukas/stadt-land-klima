<template>
  <div v-if="measure" >
    <NuxtLinkLocale :to="`/measures/sectors/${measure.sector}`" class="font-heading text-h4 text-light-blue">
      {{ t("measure.back_label", { ":sector": t(`measure_sectors.${measure.sector}.title`) }) }}
    </NuxtLinkLocale>

    <article class="mb-8 mt-10 flex items-start gap-4">
      <div class="prose">
        <h1>{{ measure.translations[0].name }}</h1>
        <div v-html="measure.translations[0].description" />
      </div>
    </article>
  </div>
  <p v-else class="prose py-8">
    {{ t("page_not_found") }}
  </p>
</template>
<script setup>
import { watch } from "vue";
const { $directus, $readItems } = useNuxtApp();
const { t, locale } = useI18n();
const route = useRoute();

const fetchMeasures = async () => {
  return $directus.request(
    $readItems("measures", {
      filter: { slug: { _eq: route.params.slug } },
      fields: ["*", "translations.*"],
      deep: {
        translations: {
          _filter: {
            languages_code: { _eq: locale.value },
          },
        },
      },
      limit: 1,
    }),
  );
};

const { data: measures } = await useAsyncData("measures", fetchMeasures);

watch(
  locale,
  async () => {
    measures.value = await fetchMeasures();
  },
  { immediate: false },
);

const measure = measures.value[0] || null;

//MetaTags
const title = measure ? ref(measure.translations[0].name) : t("page_not_found");
useHead({
  title,
});
//
</script>

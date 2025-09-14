<template>
  <div>
    <article v-if="page" class="prose py-8" v-html="page.translations[0].contents" />
    <p v-else class="prose py-8">
      {{ t("page_not_found") }}
    </p>
  </div>
</template>
<script setup>
import { watch } from "vue";

const { $directus, $readItems } = useNuxtApp();
const { locale, t } = useI18n();

const fetchIndexPage = async () => {
  return $directus.request(
    $readItems("pages", {
      filter: { slug: { _eq: "index" } },
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

const { data: indexPages } = await useAsyncData("indexPages", fetchIndexPage);

watch(
  locale,
  async () => {
    indexPages.value = await fetchIndexPage();
  },
  { immediate: false },
);

const page = indexPages.value[0] || null;

//MetaTags
const title = page ? ref(page.translations[0].name) : t("page_not_found");

//MetaTags
useHead({
  title,
}); //
</script>

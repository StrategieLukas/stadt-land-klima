<template>
  <div>
    <NuxtLink :to="`/measures/sectors/${measure.sector}?v=${selectedCatalogVersion.name}`" class="font-heading text-h4 text-light-blue">
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
import { ref } from 'vue';
const { $directus, $readItems, $t } = useNuxtApp();
const route = useRoute();
const router = useRouter();
const selectedCatalogVersion = await getCatalogVersion($directus, $readItems, route, true);
onMounted(() => {
  setCatalogVersionUrl(route, router, selectedCatalogVersion);
});

const { data: measures } = await useAsyncData(`measure-${route.params.slug}-${selectedCatalogVersion.id}`, () => {
  return $directus.request(
    $readItems("measures", {
      filter: { 
        slug: { _eq: route.params.slug },
        catalog_version: { _eq: selectedCatalogVersion.id }
      },
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

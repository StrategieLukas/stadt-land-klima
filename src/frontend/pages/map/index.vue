<template>
  <div>
    <TheMap :municipality-scores="municipality_scores" :catalog-version="selectedCatalogVersion" />
  </div>
</template>

<script setup lang="ts">
import TheMap from "~/components/TheMap.vue";
import { getCatalogVersion } from "~/composables/getCatalogVersion";
const fetchContent = useContentFetch();

const { $t } = useNuxtApp();
const route = useRoute();
const selectedCatalogVersion = ref(await getCatalogVersion(route));
const { data } = await useAsyncData(
  () => `map-scores-${selectedCatalogVersion.value.name}`,
  () => fetchContent(`/api/public/stats/${encodeURIComponent(selectedCatalogVersion.value.name)}`),
);
const municipality_scores = computed(() => data.value?.scores ?? []);
watch(
  () => route.query.v,
  async () => {
    selectedCatalogVersion.value = await getCatalogVersion(route);
  },
);
useHead({ title: () => $t("map.title") });
</script>

<template lang="">
  <div class="flex flex-col">
    <ul>
      <li v-for="municipality in publishedMunicipalities" :key="municipality.id">
        <NuxtLink :to="`/municipalities/${municipality.slug}`">
          <item-ranking :municipality="municipality" :is-ranking="true" />
        </NuxtLink>
      </li>
    </ul>
  </div>
</template>
<script setup>
const props = defineProps({
  municipalities: {
    type: Array,
    required: true,
  },
  catalogVersion: {
    required: true,
  }
});

// Hide unpublished municipalities and those with percentage_rated < 95% for the catalog version from the Ranking view
const publishedMunicipalities = computed(() => {
  return props.municipalities.filter(m => m.status === "published" && m.scores && m.scores.filter(s => s.catalog_version === props.catalogVersion && s.percentage_rated > 95)) || []
})
</script>
<style lang=""></style>

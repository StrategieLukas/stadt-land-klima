<template lang="">
  <div class="flex flex-col">
    <ul>
      <li v-for="municipality in publishedMunicipalities" :key="municipality.id">
        <NuxtLinkLocale :to="`/municipalities/${municipality.slug}`">
          <item-ranking :municipality="municipality" :is-ranking="true" />
        </NuxtLinkLocale>
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
});

// Hide unpublished municipalities from the Ranking view
const publishedMunicipalities = computed(() => {
  return props.municipalities.filter(m => m.status === "published") || []
})
</script>
<style lang=""></style>

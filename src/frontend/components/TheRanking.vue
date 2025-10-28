<template lang="">
  <div class="flex flex-col">
    <ul>
      <li
        v-for="municipalityScore in publishedMunicipalityScores"
        :key="municipalityScore.id"
      >
        <NuxtLink :to="`/municipalities/${municipalityScore.municipality.slug}?v=${catalogVersion.name}`">
          <item-ranking
            :municipality-score="municipalityScore"
            :is-ranking="true"
          />
        </NuxtLink>
      </li>

      <li
        v-if="!publishedMunicipalityScores || publishedMunicipalityScores.length === 0"
        class="text-gray-600 text-sm mt-4"
      >
        {{ $t('ranking.no_elements_yet') }}
      </li>
    </ul>
  </div>
</template>
<script setup>
const props = defineProps({
  municipalityScores: {
    type: Array,
    default: () => [],
  },
  catalogVersion: {
    required: true,
  }
});

// Hide unpublished municipalities and those with percentage_rated < 95% for the catalog version from the Ranking view
const publishedMunicipalityScores = computed(() => {
  if (!props.municipalityScores || !Array.isArray(props.municipalityScores)) {
    return []
  }
  return props.municipalityScores.filter(s => s.municipality.status === "published" && s.percentage_rated > 95) || []
})
</script>
<style lang=""></style>

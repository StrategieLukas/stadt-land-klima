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
import { isMunicipalityScorePublished } from '~/shared/municipality-score-publishing.js';

const props = defineProps({
  municipalityScores: {
    type: Array,
    default: () => [],
  },
  catalogVersion: {
    required: true,
  }
});

// Hide municipality scores that are not published for this catalog version.
const publishedMunicipalityScores = computed(() => {
  if (!props.municipalityScores || !Array.isArray(props.municipalityScores)) {
    return []
  }
  return props.municipalityScores
    .filter(isMunicipalityScorePublished)
    // Recalculate indices
    .map((item, index) => ({
        ...item,
        rank: index + 1,
      })) || []
})
</script>
<style lang=""></style>

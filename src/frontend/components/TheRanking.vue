<template lang="">
  <div class="flex flex-col">
    <ul>
      <li
        v-for="municipalityScore in completeMunicipalityScores"
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
        v-if="completeMunicipalityScores.length === 0"
        class="text-gray-600 text-sm mt-4"
      >
        {{ $t('ranking.no_elements_yet') }}
      </li>
    </ul>
  </div>
</template>
<script setup>
import { isMunicipalityScoreComplete } from '~/shared/municipality-score-publishing.js';

const props = defineProps({
  municipalityScores: {
    type: Array,
    default: () => [],
  },
  catalogVersion: {
    required: true,
  }
});

// Show only published scores with every measure completed in this catalog version.
const completeMunicipalityScores = computed(() => {
  if (!props.municipalityScores || !Array.isArray(props.municipalityScores)) {
    return []
  }
  return props.municipalityScores
    .filter(isMunicipalityScoreComplete)
    // Recalculate indices
    .map((item, index) => ({
        ...item,
        rank: index + 1,
      })) || []
})
</script>
<style lang=""></style>

<template>
  <div class="flex flex-col">
    <ul>
      <li
        v-for="municipalityScore in completeMunicipalityScores"
        :key="municipalityScore.id"
      >
        <NuxtLink :to="`/municipalities/${municipalityScore.municipality.slug}?v=${catalogVersion?.name ?? ''}`">
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
<script setup lang="ts">
import type { PropType } from 'vue';
import type { MunicipalityScore } from '~/types/components/municipality';
import type { Catalog } from '~/shared/contracts/search';

import { isMunicipalityScoreComplete } from '~/shared/municipality-score-publishing';

const props = defineProps({
  municipalityScores: {
    type: Array as PropType<MunicipalityScore[] | undefined>,
    default: () => [],
  },
  catalogVersion: { type: null as unknown as PropType<Catalog | null>,
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

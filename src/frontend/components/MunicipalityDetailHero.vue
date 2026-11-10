<template>
  <header class="mb-8 pt-2 sm:pt-4">
    <p class="mb-3 text-sm font-semibold text-gray">
      <span v-if="municipality.state">{{ municipality.state }}</span>
      <span v-if="!complete" class="ml-2 badge badge-outline">{{ $t("municipality.hero.preview") }}</span>
    </p>
    <h1 class="mb-4 font-heading text-4xl leading-tight font-black break-words text-light-green sm:text-6xl">
      {{ municipality.name }}
    </h1>
    <p class="max-w-3xl text-lg leading-relaxed text-gray">
      {{ $t("municipality.hero.introduction") }}
    </p>
  </header>
</template>
<script setup lang="ts">
import type { MunicipalityScore } from "~/types/components/municipality";
import { isMunicipalityScoreComplete } from "~/shared/municipality-score-publishing";
const props = defineProps<{ score: MunicipalityScore }>();
const municipality = computed(() => props.score.municipality);
const complete = computed(() => isMunicipalityScoreComplete(props.score));
</script>

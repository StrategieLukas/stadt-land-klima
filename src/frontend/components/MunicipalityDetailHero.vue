<template>
  <header class="mb-8 pt-2 sm:pt-4">
    <p class="mb-3 text-sm font-semibold text-gray">
      <template v-if="municipality.state">{{ municipality.state }} <span aria-hidden="true">·</span> </template
      >{{ score.catalog_version.name }}
      <span v-if="!complete" class="ml-2 badge badge-outline">{{ $t("municipality.hero.preview") }}</span>
    </p>
    <h1 class="mb-4 font-heading text-4xl leading-tight font-black break-words text-light-green sm:text-6xl">
      {{ municipality.name }}
    </h1>
    <p class="max-w-3xl text-lg leading-relaxed text-gray">
      {{ $t("municipality.hero.description", { ":municipality": municipality.name }) }}
    </p>
    <div class="my-6 flex max-w-xl items-center gap-4">
      <div class="min-w-0 flex-1">
        <div class="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-sm">
          <span>{{ $t("municipality.hero.score") }}</span>
          <span v-if="complete && score.rank" class="font-semibold">{{
            $t("municipality.hero.rank", { ":rank": score.rank })
          }}</span>
        </div>
        <ProgressBar :score-total="Number(score.score_total)" />
      </div>
      <PdfExportForm
        v-if="complete"
        :action="`/api/pdf/municipality/${municipality.slug}`"
        :request="{ slug: municipality.slug, catalogVersion: score.catalog_version.name }"
      >
        <CanonicalButton type="submit" :label="$t('municipality.hero.pdf')" icon-slug="mdi:file-pdf-box" color="gray" />
      </PdfExportForm>
    </div>
  </header>
</template>
<script setup lang="ts">
import type { MunicipalityScore } from "~/types/components/municipality";
import { isMunicipalityScoreComplete } from "~/shared/municipality-score-publishing";
const props = defineProps<{ score: MunicipalityScore }>();
const municipality = computed(() => props.score.municipality);
const complete = computed(() => isMunicipalityScoreComplete(props.score));
</script>

<script setup lang="ts">
  import { ref } from 'vue'
  import { routeSlug } from "~/shared/routeValues"
import type { z } from "zod"
import type { MunicipalityPageSchema } from "~/shared/contracts/municipality"
const route = useRoute()
const slug = routeSlug(route.params.slug)
if (!slug) throw createError({statusCode: 404, statusMessage: "Municipality not found"})
  const { $t } = useNuxtApp()
  const catalogs = await getAllCatalogVersions()
  const currentCatalogVersion = await getCurrentFrontendCatalogVersion()
if (!currentCatalogVersion) throw createError({statusCode: 502, statusMessage: "Catalog unavailable"})
  const usingFallbackCatalog = ref(false)
  type PageData = z.output<typeof MunicipalityPageSchema>["directusData"]
const directusData = ref<(PageData & {ratingsMeasures: NonNullable<PageData["ratingsBySector"]>[keyof NonNullable<PageData["ratingsBySector"]>]}) | null>(null)
  const results = await Promise.all(catalogs.map(catalog => $fetch(`/api/public/municipalities/${encodeURIComponent(slug)}`, { query: { v: catalog.name } })))
  const municipalityMissing = results.every(result => !result.municipality)
  const eligible = results.filter(result => Number(result.directusData?.municipalityScore?.percentage_rated) > 80)
  const selected = eligible.find(result => result.selectedCatalogVersion.id === currentCatalogVersion!.id) ?? eligible.slice().sort((a, b) => new Date(b.selectedCatalogVersion.date_created ?? 0).getTime() - new Date(a.selectedCatalogVersion.date_created ?? 0).getTime())[0]
  if (selected?.directusData) {
    usingFallbackCatalog.value = selected.selectedCatalogVersion.id !== currentCatalogVersion!.id
    directusData.value = {
      ...selected.directusData,
      ratingsMeasures: Object.values(selected.directusData.ratingsBySector ?? {}).flat(),
    }
  }

  // Set title
  const title = ref(directusData?.value?.municipalityScore?.municipality?.name ?? '404');
  useHead({
    title,
  });

</script>

<template>
  <div v-if="directusData?.municipalityScore">
    <ElectionInfo
      :municipality-score="directusData.municipalityScore"
      :ratings-measures="directusData.ratingsMeasures ?? []"
      :using-fallback-catalog="usingFallbackCatalog"
      :current-catalog-version="currentCatalogVersion"
    />
  </div>
  <!-- Municipality completely missing -->
  <div v-else-if="municipalityMissing">
    <p>{{ $t("elections.guide.not_rated") }}</p>
  </div>
  <!-- Municipality exists, but not sufficiently rated to generate questions -->
  <div v-else>
    <p>{{ $t("elections.guide.not_fully_rated") }}</p>
  </div>
  
</template>

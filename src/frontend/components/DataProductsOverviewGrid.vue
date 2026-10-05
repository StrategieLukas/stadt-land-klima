<template>
  <section
    id="alle-datenprodukte"
    class="border-gray-100 border-t py-4"
    :style="`scroll-margin-top: ${scrollMarginTop}px`"
  >
    <div class="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 class="text-gray-900 text-2xl font-black leading-tight sm:text-3xl">Alle Datenprodukte</h2>
      </div>
      <p class="text-gray-500 text-xs">{{ collections.length }} Produkte</p>
    </div>

    <div class="grid grid-cols-1 gap-3 xs:grid-cols-2 lg:grid-cols-4">
      <DataProductsOverviewGridCard
        v-for="collection in collections"
        :key="collection.id"
        :collection="collection"
        :ars="ars"
        :base-url="baseUrl"
        :population="population"
        @select="$emit('select', collection.id)"
      />
      <DataProductsComingSoonTile :collection-count="collections.length" :area-name="areaName" />
    </div>
  </section>
</template>

<script setup lang="ts">
import DataProductsComingSoonTile from "~/components/DataProductsComingSoonTile.vue";
import type { Collection } from "~/types/slz-api";

defineProps<{
  collections: Collection[];
  ars: string;
  baseUrl: string;
  population?: number | null;
  areaName: string;
  scrollMarginTop: number;
}>();

defineEmits<{
  (e: "select", collectionId: string): void;
}>();
</script>

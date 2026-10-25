<template>
  <section
    id="alle-datenprodukte"
    class="border-t border-gray-100 py-4"
    :style="`scroll-margin-top: ${scrollMarginTop}px`"
  >
    <div class="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 class="text-2xl leading-tight font-black text-gray-900 sm:text-3xl">Alle Datenprodukte</h2>
      </div>
      <p class="text-xs text-gray-500">{{ collections.length }} Produkte</p>
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
  population?: number | null | undefined;
  areaName: string;
  scrollMarginTop: number;
}>();

defineEmits<{
  (e: "select", collectionId: string): void;
}>();
</script>

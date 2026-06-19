<template>
  <section
    id="alle-datenprodukte"
    class="border-gray-100 border-t py-4"
    :style="`scroll-margin-top: ${scrollMarginTop}px`"
  >
    <div class="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p class="text-xs font-bold uppercase tracking-widest text-[#006e94]">Datenprodukte</p>
        <h2 class="text-gray-900 text-2xl font-black leading-tight sm:text-3xl">Alle Datenprodukte</h2>
      </div>
      <p class="text-gray-500 text-xs">{{ collections.length }} Produkte</p>
    </div>

    <div class="grid grid-cols-1 gap-3 xs:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
      <DataProductsOverviewGridCard
        v-for="collection in collections"
        :key="collection.id"
        :collection="collection"
        :ars="ars"
        :base-url="baseUrl"
        :population="population"
        @select="$emit('select', collection.id)"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import type { Collection } from "~/types/slz-api";

const props = defineProps<{
  collections: Collection[];
  ars: string;
  baseUrl: string;
  population?: number | null;
  scrollMarginTop: number;
}>();

defineEmits<{
  (e: "select", collectionId: string): void;
}>();
</script>

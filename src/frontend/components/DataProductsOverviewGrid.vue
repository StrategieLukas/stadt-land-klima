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
      <p class="text-gray-500 text-xs">{{ collections.length }} Produkte in {{ sectors.length }} Sektoren</p>
    </div>

    <div class="space-y-5">
      <section v-for="sector in sectors" :key="sector.key">
        <div class="mb-2 flex items-center gap-2">
          <span class="h-2.5 w-2.5 rounded-full" :style="{ backgroundColor: sector.color }" />
          <h3 class="text-gray-900 text-sm font-black">{{ sector.label }}</h3>
          <span class="text-gray-400 text-xs">{{ sector.collections.length }}</span>
        </div>

        <div class="grid grid-cols-1 gap-3 xs:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          <DataProductsOverviewGridCard
            v-for="collection in sector.collections"
            :key="collection.id"
            :collection="collection"
            :ars="ars"
            :base-url="baseUrl"
            :population="population"
            @select="$emit('select', collection.id)"
          />
        </div>
      </section>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { Collection } from "~/types/slz-api";
import { sectorColor, sectorKey, sectorLabel } from "~/utils/dataProducts";

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

const sectors = computed(() => {
  const groups = [];
  const byKey = new Map<string, { key: string; label: string; color: string; collections: Collection[] }>();
  for (const collection of props.collections) {
    const key = sectorKey(collection);
    if (!byKey.has(key)) {
      const group = {
        key,
        label: sectorLabel(collection),
        color: sectorColor(collection),
        collections: [],
      };
      byKey.set(key, group);
      groups.push(group);
    }
    byKey.get(key)!.collections.push(collection);
  }
  return groups;
});
</script>

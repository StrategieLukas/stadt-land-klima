<template>
  <NuxtLink
    :to="to"
    class="group card block overflow-hidden rounded-none bg-white shadow-xl transition-shadow duration-200 hover:shadow-2xl"
  >
    <div class="relative flex h-40 items-center justify-center bg-gray-200">
      <SmartImg
        v-if="image_id"
        :asset-id="image_id"
        :is-raster="true"
        :alt="name"
        :height="160"
        :width="400"
        fit="cover"
        sizes="(max-width: 768px) 312px, 400px"
        img-class="object-cover w-full h-full"
      />
      <div v-else class="flex h-full w-full items-center justify-center bg-gray/5">
        <img v-if="sector" :src="sectorImages[sector]" class="h-12 w-12 opacity-20" alt="" />
      </div>
      <!-- Sector badge top-left -->
      <div
        v-if="sector"
        class="absolute top-2 left-2 flex items-center gap-1 rounded-sm bg-white/80 px-2 py-0.5 text-xs font-bold text-gray backdrop-blur-xs"
      >
        <img :src="sectorImages[sector]" class="h-4 w-4 opacity-60" alt="" />
        {{ $t(`measure_sectors.${sector}.title`) }}
      </div>
      <!-- Image credits overlay on hover -->
      <div
        v-if="image_credits && image_id"
        class="absolute inset-x-0 bottom-0 truncate bg-black/50 px-2 py-1 text-[10px] text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100"
      >
        {{ image_credits }}
      </div>
    </div>

    <div class="p-4">
      <div class="mb-2 flex flex-wrap items-center gap-2">
        <span class="shrink-0 rounded-sm bg-gray px-2 py-0.5 font-mono text-xs text-white">{{ measure_id }}</span>
      </div>
      <h2 class="mb-2 font-heading text-sm leading-snug font-bold text-gray">{{ name }}</h2>
      <p v-if="description" class="line-clamp-3 text-xs text-gray-500">{{ description }}</p>
    </div>
  </NuxtLink>
</template>

<script setup lang="ts">
import type { PropType } from "vue";
import type { Sector } from "~/shared/domain";

import sectorImages from "~/shared/sectorImages";

const { $t } = useNuxtApp();

const _props = defineProps({
  to: { type: String, required: true },
  measure_id: { type: String as PropType<string | undefined>, default: "" },
  name: { type: String as PropType<string | undefined>, default: "" },
  sector: { type: String as PropType<Sector | null | undefined>, default: null },
  description: { type: String as PropType<string | null | undefined>, default: null },
  image_id: { type: String as PropType<string | null | undefined>, default: null },
  image_credits: { type: String as PropType<string | null | undefined>, default: null },
});
</script>

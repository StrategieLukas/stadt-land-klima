<template>
  <NuxtLink :to="to" class="group card bg-white shadow-xl rounded-none overflow-hidden block hover:shadow-2xl transition-shadow duration-200">
    <div class="relative h-40 bg-gray-200 flex items-center justify-center">
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
      <div v-else class="w-full h-full flex items-center justify-center bg-gray/5">
        <img v-if="sector" :src="sectorImages[sector]" class="w-12 h-12 opacity-20" alt="" />
      </div>
      <!-- Sector badge top-left -->
      <div v-if="sector" class="absolute top-2 left-2 flex items-center gap-1 bg-white/80 backdrop-blur-sm px-2 py-0.5 rounded text-xs font-bold text-gray">
        <img :src="sectorImages[sector]" class="w-4 h-4 opacity-60" alt="" />
        {{ $t(`measure_sectors.${sector}.title`) }}
      </div>
      <!-- Image credits overlay on hover -->
      <div v-if="image_credits && image_id" class="absolute inset-x-0 bottom-0 bg-black/50 text-white text-[10px] px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 truncate">
        {{ image_credits }}
      </div>
    </div>

    <div class="p-4">
      <div class="flex items-center gap-2 mb-2 flex-wrap">
        <span class="font-mono bg-gray text-white text-xs px-2 py-0.5 rounded flex-shrink-0">{{ measure_id }}</span>
      </div>
      <h2 class="font-heading font-bold text-gray text-sm leading-snug mb-2">{{ name }}</h2>
      <p v-if="description" class="text-gray-500 text-xs line-clamp-3">{{ description }}</p>
    </div>
  </NuxtLink>
</template>

<script setup lang="ts">
import type { PropType } from 'vue';
import type { Sector } from '~/shared/domain';

import sectorImages from '~/shared/sectorImages';

const { $t } = useNuxtApp();

const _props = defineProps({
  to: { type: String, required: true },
  measure_id: { type: String, default: '' },
  name: { type: String, default: '' },
  sector: { type: String as PropType<Sector | null>, default: null },
  description: { type: String as PropType<string | null>, default: null },
  image_id: { type: String as PropType<string | null>, default: null },
  image_credits: { type: String as PropType<string | null>, default: null },
});
</script>

<template>
  <NuxtLink :to="to" class="card group bg-white shadow-xl rounded-none overflow-hidden block hover:shadow-2xl transition-shadow duration-200">
    <div class="relative h-40 bg-gray-200 flex items-center justify-center">
      <SmartImg
        v-if="image_id"
        :assetId="image_id"
        :isRaster="true"
        :alt="name"
        :height="160"
        :width="400"
        fit="cover"
        sizes="(max-width: 768px) 312px, 400px"
        format="webp"
        img-class="object-cover w-full h-full"
      />
      <div v-else class="w-full h-full flex items-center justify-center bg-solid-gray-05">
        <img v-if="sector" :src="sectorImages[sector]" class="w-12 h-12 opacity-20" alt="" />
      </div>
      <!-- Sector badge top-left -->
      <div v-if="sector" class="absolute top-2 left-2 flex items-center gap-1 bg-white backdrop-blur-sm px-2 py-0.5 rounded text-xs font-bold text-gray">
        <img :src="sectorImages[sector]" class="w-4 h-4 opacity-60" alt="" />
        {{ $t(`measure_sectors.${sector}.title`) }}
      </div>
      <div
        v-if="image_credits"
        class="absolute inset-x-0 bottom-0 bg-solid-gray-80 px-2 py-1 text-[10px] font-medium text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
      >
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

<script setup>
import sectorImages from '~/shared/sectorImages.js';

const { $t } = useNuxtApp();

const props = defineProps({
  to: { type: String, required: true },
  measure_id: { type: String, default: '' },
  name: { type: String, default: '' },
  sector: { type: String, default: null },
  description: { type: String, default: null },
  image_id: { type: String, default: null },
  image_credits: { type: String, default: null },
});
</script>

<template>
    <img
      v-if="src"
      :src="src"
      :alt="alt || ''"
      loading="lazy"
      :class="imgClass"
      :width="width || null"
      :height="height || null"
    />
</template>
  
<script setup>
  // Smarter version of an image, which checks if it is scalable and asks for fitting dimensions if possible to avoid sending very large files

  import { ref, watchEffect } from 'vue'
  import { toAssetUrl } from '~/shared/utils';
  
  const props = defineProps({
    assetId: { type: String, required: true },
    isRaster: { type: Boolean, required: true },
    alt: { type: String, default: '' },
    imgClass: { type: String, default: '' },
  
    // Transform options
    width: { type: Number, default: null },
    height: { type: Number, default: null },
    // Quality for uploads is already reduced to 70 on upload, this would further decrease it
    quality: { type: Number, default: 100 },
    fit: { type: String, default: 'cover' },
  
    // Optional responsive srcset
    // responsiveWidths: { type: Array, default: () => [] }, // e.g. [400, 800, 1200]
    // sizes: { type: String, default: '' } // e.g. "(max-width: 640px) 400px, 800px"
  })
  
  const runtime = useRuntimeConfig()
  
  const src = ref(null)
  const srcset = ref(null)
  
  watchEffect(async () => {
    src.value = null
    srcset.value = null

    src.value = await toAssetUrl(props.assetId, props.isRaster, { width: props.width, height: props.height, quality: props.quality, fit: props.fit });
  
    // Optional responsive srcset (keeps height constant, varies width)
    // if (props.responsiveWidths.length && props.height) {
    //   srcset.value = props.responsiveWidths.map(w => {
    //     const pp = new URLSearchParams(p)
    //     pp.set('width', String(w))
    //     return `${runtime.public.clientDirectusUrl}/assets/${props.assetId}?${pp.toString()} ${w}w`
    //   }).join(', ')
    // }
  })
</script>
  
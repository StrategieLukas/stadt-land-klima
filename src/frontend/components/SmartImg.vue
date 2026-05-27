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
    assetId: { type: String, required: false, default: null },
    isRaster: { type: Boolean, required: false, default: true },
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
  const directusUrl = runtime.public.clientDirectusUrl

  const src = ref(null)
  const srcset = ref(null)

  watchEffect(async () => {
    src.value = null
    srcset.value = null
    if (!props.assetId) return

    const assetUrl = `${directusUrl}/assets/${props.assetId}`

    if (!props.isRaster) {
      src.value = assetUrl
      return
    }

    const p = new URLSearchParams()
    if (props.width) p.set('width', String(props.width))
    if (props.height) p.set('height', String(props.height))
    if (props.quality && props.quality !== 100) p.set('quality', String(props.quality))
    if (props.fit) p.set('fit', props.fit)

    src.value = p.toString() ? `${assetUrl}?${p.toString()}` : assetUrl
  })
</script>

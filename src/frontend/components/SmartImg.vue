<template>
    <img
      v-if="src"
      :src="src"
      :alt="alt || ''"
      loading="lazy"
      :class="imgClass"
      :width="width || undefined"
      :height="height || undefined"
    />
</template>

<script setup lang="ts">
import type { PropType } from 'vue';

  // Smarter version of an image, which checks if it is scalable and asks for fitting dimensions if possible to avoid sending very large files

  import { inject, ref, watchEffect } from 'vue'
  import { TOUR_REPORT_MEDIA } from '~/shared/successProjectTour';

  const props = defineProps({
    assetId: { type: String as PropType<string | null | undefined>, required: false, default: null },
    isRaster: { type: Boolean as PropType<boolean | undefined>, required: false, default: true },
    alt: { type: String as PropType<string | undefined>, default: '' },
    imgClass: { type: String as PropType<string | undefined>, default: '' },
    assetBaseUrl: { type: String as PropType<string | null | undefined>, default: null },
    accessToken: { type: String as PropType<string | null | undefined>, default: null },

    // Transform options
    width: { type: Number as PropType<number | null | undefined>, default: null },
    height: { type: Number as PropType<number | null | undefined>, default: null },
    // Quality for uploads is already reduced to 70 on upload, this would further decrease it
    quality: { type: Number as PropType<number | undefined>, default: 100 },
    fit: { type: String as PropType<string | undefined>, default: 'cover' },

    // Optional responsive srcset
    // responsiveWidths: { type: Array, default: () => [] }, // e.g. [400, 800, 1200]
    // sizes: { type: String, default: '' } // e.g. "(max-width: 640px) 400px, 800px"
  })

  const runtime = useRuntimeConfig()
  const directusUrl = runtime.public.clientDirectusUrl
  const reportMedia = inject(TOUR_REPORT_MEDIA, null)

  const src = ref<string | null>(null)
  const srcset = ref<string | null>(null)

  watchEffect(() => {
    src.value = null
    srcset.value = null
    if (!props.assetId) return

    const ownedReportMedia = reportMedia?.value.fileIds.has(props.assetId)
    const assetUrl = `${props.assetBaseUrl || (ownedReportMedia ? '/api/tour-media' : `${directusUrl}/assets`)}/${props.assetId}`

    const p = new URLSearchParams()
    const accessToken = props.accessToken || (ownedReportMedia ? reportMedia?.value.accessToken : null)
    if (accessToken) p.set('access_token', accessToken)
    if (props.isRaster && props.width) p.set('width', String(props.width))
    if (props.isRaster && props.height) p.set('height', String(props.height))
    if (props.quality && props.quality !== 100) p.set('quality', String(props.quality))
    if (props.isRaster && props.fit) p.set('fit', props.fit)

    src.value = p.toString() ? `${assetUrl}?${p.toString()}` : assetUrl
  })
</script>

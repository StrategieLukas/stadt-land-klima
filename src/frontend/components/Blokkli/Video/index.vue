<template>
  <div class="blokkli-block-video">
    <figure>
      <div class="relative" :class="aspectClass">
        <!-- YouTube / Vimeo embed -->
        <iframe
          v-if="embedUrl"
          :src="embedUrl"
          class="absolute inset-0 w-full h-full rounded"
          frameborder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen
        />
        <!-- Direct video file (MP4, WebM, Directus asset) -->
        <video
          v-else-if="isDirectVideo"
          :src="videoSrc"
          class="absolute inset-0 w-full h-full rounded object-cover"
          :controls="options.controls !== false"
          :muted="options.muted"
          playsinline
        />
        <!-- Placeholder when no valid URL -->
        <div
          v-else
          class="absolute inset-0 flex items-center justify-center bg-gray-100 rounded border-2 border-dashed border-gray-300 text-gray-400"
        >
          <span class="text-sm px-4 text-center">
            {{ options.videoUrl ? 'Ungültige oder nicht unterstützte URL' : 'Video-URL in den Optionen eingeben' }}
          </span>
        </div>
      </div>
      <figcaption
        v-if="props.caption || isEditing"
        v-blokkli-editable:caption
        class="text-sm text-gray mt-2 text-center italic"
        v-text="props.caption"
      />
    </figure>
  </div>
</template>

<script setup lang="ts">
const { options, isEditing } = defineBlokkli({
  bundle: 'video',
  options: {
    videoUrl: {
      type: 'text',
      label: 'Video-URL (YouTube, Vimeo, MP4)',
      default: '',
      inputType: 'text',
    },
    aspect: {
      type: 'radios',
      label: 'Seitenverhältnis',
      default: '16-9',
      options: {
        '16-9': '16:9',
        '4-3': '4:3',
        '1-1': '1:1',
        '9-16': '9:16 (Hochformat)',
      },
    },
    controls: {
      type: 'checkbox',
      label: 'Steuerung anzeigen',
      default: true,
    },
    muted: {
      type: 'checkbox',
      label: 'Stumm starten',
      default: false,
    },
  },
  editor: {
    addBehaviour: 'no-form',
    editTitle: () => 'Video',
    mockProps: () => { return { caption: '' } },
  },
})

const props = defineProps<{
  caption?: string
}>()

function getYouTubeId(url: string): string | null {
  const patterns = [
    /youtube\.com\/watch\?v=([^&]+)/,
    /youtu\.be\/([^?/]+)/,
    /youtube\.com\/embed\/([^?/]+)/,
    /youtube\.com\/shorts\/([^?/]+)/,
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m) return m[1]
  }
  return null
}

function getVimeoId(url: string): string | null {
  const m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/)
  return m ? m[1] : null
}

const embedUrl = computed(() => {
  const url = options.value.videoUrl || ''
  if (!url) return ''

  const ytId = getYouTubeId(url)
  if (ytId) {
    const params = new URLSearchParams({ rel: '0', modestbranding: '1' })
    if (options.value.controls === false) params.set('controls', '0')
    if (options.value.muted) params.set('mute', '1')
    return `https://www.youtube.com/embed/${ytId}?${params}`
  }

  const vimeoId = getVimeoId(url)
  if (vimeoId) {
    const params = new URLSearchParams()
    if (options.value.controls === false) params.set('controls', '0')
    if (options.value.muted) params.set('muted', '1')
    const qs = params.toString()
    return `https://player.vimeo.com/video/${vimeoId}${qs ? '?' + qs : ''}`
  }

  return ''
})

const isDirectVideo = computed(() => {
  const url = options.value.videoUrl || ''
  if (!url || embedUrl.value) return false
  return /\.(mp4|webm|ogg|mov)(\?|$)/i.test(url) || url.includes('/assets/')
})

const videoSrc = computed(() => options.value.videoUrl || '')

const aspectClass = computed(() => {
  const map: Record<string, string> = {
    '16-9': 'pb-[56.25%]',
    '4-3': 'pb-[75%]',
    '1-1': 'pb-[100%]',
    '9-16': 'pb-[177.78%]',
  }
  return map[options.value.aspect] || 'pb-[56.25%]'
})
</script>

<style scoped>
.blokkli-block-video {
  width: 100%;
  margin: 1rem 0;
}
</style>

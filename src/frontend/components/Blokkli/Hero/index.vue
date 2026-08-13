<template>
  <div class="blokkli-block-hero" :id="getBlokkliBlockId(options.anchor, uuid)">
    <section
      class="relative overflow-hidden flex items-center"
      :class="[heightClass, textAlignClass]"
    >
      <!-- Background image (droppable zone) -->
      <div v-blokkli-droppable:imageId class="absolute inset-0 z-0">
        <img
          v-if="imageUrl"
          :src="imageUrl"
          alt=""
          class="w-full h-full object-cover"
        />
        <div
          v-else
          class="w-full h-full flex items-center justify-center"
          :class="backgroundColorClass"
        >
          <span v-if="isEditing" class="text-white text-sm">Hintergrundbild hier ablegen</span>
        </div>
      </div>
      <button
        v-if="isEditing && imageUrl"
        type="button"
        class="btn btn-error btn-sm absolute right-4 top-4 z-30 pointer-events-auto"
        :aria-label="$t('blokkli.media.remove_background_image')"
        :title="$t('blokkli.media.remove_background_image')"
        @click.stop.prevent="clearBackgroundImage"
      >
        <Icon icon="mdi:image-remove-outline" class="h-5 w-5" />
        <span>{{ $t('blokkli.media.remove_image') }}</span>
      </button>
      <!-- Overlay -->
      <div class="absolute inset-0 z-10" :class="overlayClass" />
      <!-- Content -->
      <div class="relative z-20 w-full max-w-5xl mx-auto px-8 py-12" :class="contentAlignClass">
        <h1
          v-blokkli-editable:title
          class="leading-tight mb-4 text-4xl md:text-5xl lg:text-6xl whitespace-pre-line"
          :class="[titleColorClass, titleWeightClass]"
          v-html="props.title || ''"
        />
        <p
          v-if="props.subtitle || isEditing"
          v-blokkli-editable:subtitle
          class="text-xl leading-relaxed opacity-90"
          :class="textColorClass"
          v-text="props.subtitle"
        />
        <BlokkliField
          v-if="(props.blocks && props.blocks.length) || isEditing"
          name="blocks"
          :list="props.blocks || []"
          tag="div"
          class="mt-6 flex flex-col gap-4"
        />
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import type { FieldListItem } from '#blokkli/types'
import { BRAND_COLOR_CLASSES } from '~/utils/blokkliColors'
import { getBlokkliBlockId } from '~/utils/blokkliLinks'

const { options, isEditing, uuid } = defineBlokkli({
  bundle: 'hero',
  globalOptions: ['anchor'],
  options: {
    height: {
      type: 'radios',
      label: 'Höhe',
      default: 'large',
      options: {
        compact: 'Kompakt (40vh)',
        medium: 'Mittel (60vh)',
        large: 'Groß (80vh)',
        fullscreen: 'Vollbild (100vh)',
      },
    },
    overlay: {
      type: 'radios',
      label: 'Überlagerung',
      default: 'dark',
      options: {
        none: 'Keine',
        light: 'Hell',
        dark: 'Dunkel',
        gradient: 'Gradient (unten)',
      },
    },
    backgroundColor: {
      type: 'radios',
      label: 'Hintergrundfarbe',
      default: 'dark',
      displayAs: 'colors',
      options: {
        default: { label: 'Standard', hex: '#111111' },
        black: { label: 'Schwarz', hex: '#000000' },
        gray: { label: 'Grau', hex: '#505050' },
        white: { label: 'Weiß', hex: '#fbfbfb' },
        green: { label: 'Grün', hex: '#1da64a' },
        'dark-green': { label: 'Dunkelgrün', hex: '#339737' },
        blue: { label: 'Blau', hex: '#16bae7' },
        dark: { label: 'Dunkelblau', hex: '#006e94' },
        orange: { label: 'Orange', hex: '#f39200' },
        yellow: { label: 'Gelb', hex: '#ffc80c' },
        lime: { label: 'Lime', hex: '#afca0b' },
        red: { label: 'Rot', hex: '#e30613' },
      },
    },
    textPosition: {
      type: 'radios',
      label: 'Text-Position',
      default: 'center',
      options: {
        left: 'Links',
        center: 'Mitte',
        right: 'Rechts',
      },
    },
    textColor: {
      type: 'radios',
      label: 'Textfarbe',
      default: 'light',
      options: {
        light: 'Hell (Weiß)',
        dark: 'Dunkel (Schwarz)',
      },
    },
    titleColor: {
      type: 'radios',
      label: 'Titelfarbe',
      default: 'inherit',
      displayAs: 'colors',
      options: {
        inherit: { label: 'Wie Textfarbe', hex: '#888888' },
        default: { label: 'Standard', hex: '#111111' },
        black: { label: 'Schwarz', hex: '#000000' },
        gray: { label: 'Grau', hex: '#505050' },
        white: { label: 'Weiß', hex: '#fbfbfb' },
        green: { label: 'Grün', hex: '#1da64a' },
        'dark-green': { label: 'Dunkelgrün', hex: '#339737' },
        blue: { label: 'Blau', hex: '#16bae7' },
        dark: { label: 'Dunkelblau', hex: '#006e94' },
        orange: { label: 'Orange', hex: '#f39200' },
        yellow: { label: 'Gelb', hex: '#ffc80c' },
        lime: { label: 'Lime', hex: '#afca0b' },
        red: { label: 'Rot', hex: '#e30613' },
      },
    },
    titleWeight: {
      type: 'radios',
      label: 'Titel-Schriftstärke',
      default: 'bold',
      options: {
        light: 'Leicht',
        normal: 'Normal',
        semibold: 'Halbfett',
        bold: 'Fett',
      },
    },
  },
  editor: {
    addBehaviour: 'editable:title',
    editTitle: (el) => el.querySelector('h1')?.textContent || 'Hero',
    mockProps: () => { return { title: 'Überschrift', subtitle: 'Untertitel hier eingeben', imageId: '', blocks: [] } },
  },
})

const props = defineProps<{
  title?: string
  subtitle?: string
  imageId?: string
  blocks?: FieldListItem[]
}>()

const config = useRuntimeConfig()
const { $t } = useNuxtApp()
const blokkliApp = isEditing ? useBlokkli() : null

const imageUrl = computed(() => {
  if (!props.imageId) return ''
  return `${config.public.clientDirectusUrl}/assets/${props.imageId}?width=1920&quality=80`
})

const heightClass = computed(() => {
  const map: Record<string, string> = {
    compact: 'min-h-[40vh]',
    medium: 'min-h-[60vh]',
    large: 'min-h-[80vh]',
    fullscreen: 'min-h-screen',
  }
  return map[options.value.height] || 'min-h-[80vh]'
})

const overlayClass = computed(() => {
  const map: Record<string, string> = {
    none: '',
    light: 'bg-white/40',
    dark: 'bg-black/50',
    gradient: 'bg-gradient-to-t from-black/70 via-black/20 to-transparent',
  }
  return map[options.value.overlay] ?? 'bg-black/50'
})

const backgroundColorClass = computed(() => {
  const map: Record<string, string> = {
    default: 'bg-gradient-to-br from-stats-dark to-light-blue',
    black: 'bg-black',
    gray: 'bg-gray',
    white: 'bg-mild-white',
    green: 'bg-ff-green',
    'dark-green': 'bg-green',
    blue: 'bg-light-blue',
    dark: 'bg-stats-dark',
    orange: 'bg-orange',
    yellow: 'bg-localzero-yellow',
    lime: 'bg-light-green',
    red: 'bg-red',
  }
  return map[options.value.backgroundColor] || map.dark
})

const textColorClass = computed(() => {
  return options.value.textColor === 'dark' ? 'text-black' : 'text-white'
})

const titleColorClass = computed(() => {
  if (options.value.titleColor === 'inherit') return textColorClass.value
  return BRAND_COLOR_CLASSES[options.value.titleColor as keyof typeof BRAND_COLOR_CLASSES] ?? textColorClass.value
})

const titleWeightClass = computed(() => {
  const map: Record<string, string> = {
    light: 'font-light',
    normal: 'font-normal',
    semibold: 'font-semibold',
    bold: 'font-bold',
  }
  return map[options.value.titleWeight] || 'font-bold'
})

async function clearBackgroundImage() {
  if (!blokkliApp?.adapter.updateFieldValue) return

  await blokkliApp.state.mutateWithLoadingState(() =>
    blokkliApp.adapter.updateFieldValue!({
      uuid,
      fieldName: 'imageId',
      fieldValue: '',
    }),
  )
}

const textAlignClass = computed(() => {
  const map: Record<string, string> = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  }
  return map[options.value.textPosition] || 'text-center'
})

const contentAlignClass = computed(() => {
  const map: Record<string, string> = {
    left: '',
    center: 'text-center',
    right: 'text-right ml-auto',
  }
  return map[options.value.textPosition] || 'text-center'
})
</script>

<style scoped>
.blokkli-block-hero {
  width: 100vw;
  position: relative;
  left: 50%;
  margin-left: -50vw;
}
</style>

<template>
  <div class="blokkli-block-hero" :id="'block-' + uuid">
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
          class="w-full h-full bg-gradient-to-br from-stats-dark to-light-blue flex items-center justify-center"
        >
          <span v-if="isEditing" class="text-white/50 text-sm">Hintergrundbild hier ablegen</span>
        </div>
      </div>
      <!-- Overlay -->
      <div class="absolute inset-0 z-10" :class="overlayClass" />
      <!-- Content -->
      <div class="relative z-20 w-full max-w-5xl mx-auto px-8 py-12" :class="contentAlignClass">
        <h1
          v-blokkli-editable:title
          class="font-bold leading-tight mb-4 text-4xl md:text-5xl lg:text-6xl"
          :class="textColorClass"
          v-text="props.title"
        />
        <p
          v-if="props.subtitle || isEditing"
          v-blokkli-editable:subtitle
          class="text-xl leading-relaxed opacity-90"
          :class="textColorClass"
          v-text="props.subtitle"
        />
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
const { options, isEditing, uuid } = defineBlokkli({
  bundle: 'hero',
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
  },
  editor: {
    addBehaviour: 'editable:title',
    editTitle: (el) => el.querySelector('h1')?.textContent || 'Hero',
    mockProps: () => { return { title: 'Überschrift', subtitle: 'Untertitel hier eingeben', imageId: '' } },
  },
})

const props = defineProps<{
  title?: string
  subtitle?: string
  imageId?: string
}>()

const config = useRuntimeConfig()

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
  return map[options.value.overlay] || 'bg-black/50'
})

const textColorClass = computed(() => {
  return options.value.textColor === 'dark' ? 'text-black' : 'text-white'
})

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

<template>
  <section
    :id="'block-' + uuid"
    class="blokkli-block-container"
    :class="[bgClass, paddingClass, marginYClass, widthBreakout, bgNarrowClass, borderClass, roundedClass, shadowClass]"
  >
    <div :class="[innerClass]">
      <!-- Nested blokkli field: blocks dropped here live inside this container -->
      <BlokkliField
        name="blocks"
        :list="props.blocks || []"
        :drop-alignment="options.layout === 'columns-2' || options.layout === 'columns-3' ? 'horizontal' : 'vertical'"
        :class="[layoutClass]"
        tag="div"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import type { FieldListItem } from '#blokkli/types'

const { options, uuid } = defineBlokkli({
  bundle: 'container',
  options: {
    layout: {
      type: 'radios',
      label: 'Layout',
      default: 'single',
      displayAs: 'grid',
      group: 'Layout & Abstand',
      options: {
        single: { columns: [1], label: 'Single Column' },
        'columns-2': { columns: [1, 1], label: '2 Columns' },
        'columns-3': { columns: [1, 1, 1], label: '3 Columns' },
        'columns-1-2': { columns: [1, 2], label: '1/3 + 2/3' },
      },
    },
    background: {
      type: 'radios',
      label: 'Background',
      default: 'none',
      displayAs: 'colors',
      options: {
        none: { label: 'None', hex: '#ffffff' },
        'mild-white': { label: 'Off White', hex: '#fbfbfb' },
        'light-green-bg': { label: 'Light Green Bg', hex: '#EBF7EF' },
        'light-blue-bg': { label: 'Light Blue Bg', hex: '#E6F1F5' },
        'light-cyan-bg': { label: 'Light Cyan Bg', hex: '#d6f5ff' },
        lime: { label: 'Lime', hex: '#AFCA0B' },
        green: { label: 'Green', hex: '#1da64a' },
        blue: { label: 'Blue', hex: '#16bae7' },
        dark: { label: 'Dark', hex: '#006e94' },
        orange: { label: 'Orange', hex: '#f39200' },
        yellow: { label: 'Yellow', hex: '#ffc80c' },
        red: { label: 'Red', hex: '#e30613' },
      },
    },
    padding: {
      type: 'radios',
      label: 'Innenabstand',
      default: 'medium',
      displayAs: 'icons',
      group: 'Layout & Abstand',
      options: {
        none: { icon: 'icon-blokkli-option-padding-none', label: 'None' },
        small: { icon: 'icon-blokkli-option-padding-small', label: 'Small' },
        medium: { icon: 'icon-blokkli-option-padding-medium', label: 'Medium' },
        large: { icon: 'icon-blokkli-option-padding-large', label: 'Large' },
      },
    },
    marginY: {
      type: 'radios',
      label: 'Außenabstand (vertikal)',
      default: 'none',
      displayAs: 'icons',
      group: 'Layout & Abstand',
      options: {
        none: { icon: 'icon-blokkli-option-padding-none', label: 'Kein' },
        small: { icon: 'icon-blokkli-option-padding-small', label: 'Klein' },
        medium: { icon: 'icon-blokkli-option-padding-medium', label: 'Mittel' },
        large: { icon: 'icon-blokkli-option-padding-large', label: 'Groß' },
      },
    },
    bgWidth: {
      type: 'radios',
      label: 'Hintergrundbreite',
      default: 'content',
      displayAs: 'icons',
      group: 'Layout & Abstand',
      options: {
        narrow: { icon: 'icon-blokkli-option-width-narrow', label: 'Schmal' },
        content: { icon: 'icon-blokkli-option-width-content', label: 'Inhalt' },
        full: { icon: 'icon-blokkli-option-width-full', label: 'Voll (100vw)' },
      },
    },
    contentWidth: {
      type: 'radios',
      label: 'Inhaltsbreite',
      default: 'full',
      displayAs: 'icons',
      group: 'Layout & Abstand',
      options: {
        full: { icon: 'icon-blokkli-option-width-full', label: 'Voll' },
        page: { icon: 'icon-blokkli-option-width-content', label: 'Seite' },
        narrow: { icon: 'icon-blokkli-option-width-narrow', label: 'Schmal' },
      },
    },
    border: {
      type: 'radios',
      label: 'Rahmen',
      default: 'none',
      group: 'Rahmen & Schatten',
      options: {
        none: 'Kein',
        thin: 'Dünn',
        medium: 'Mittel',
        thick: 'Dick',
      },
    },
    borderColor: {
      type: 'radios',
      label: 'Rahmenfarbe',
      default: 'gray',
      group: 'Rahmen & Schatten',
      displayAs: 'colors',
      options: {
        gray: { label: 'Grau', hex: '#d1d5db' },
        green: { label: 'Grün', hex: '#1da64a' },
        blue: { label: 'Blau', hex: '#16bae7' },
        dark: { label: 'Dunkelblau', hex: '#006e94' },
        orange: { label: 'Orange', hex: '#f39200' },
        black: { label: 'Schwarz', hex: '#000000' },
      },
    },
    rounded: {
      type: 'radios',
      label: 'Abrundung',
      default: 'none',
      group: 'Rahmen & Schatten',
      options: {
        none: 'Keine',
        small: 'Klein',
        medium: 'Mittel',
        large: 'Groß',
        full: 'Rund',
      },
    },
    shadow: {
      type: 'radios',
      label: 'Schatten',
      default: 'none',
      group: 'Rahmen & Schatten',
      options: {
        none: 'Kein',
        small: 'Klein',
        medium: 'Mittel',
        large: 'Groß',
      },
    },
  },
  editor: {
    addBehaviour: 'no-form',
    editTitle: () => 'Container',
    mockProps: () => {
      return { blocks: [] }
    },
  },
})

const props = defineProps<{
  blocks?: FieldListItem[]
}>()

const bgClass = computed(() => {
  const map: Record<string, string> = {
    none: '',
    'mild-white': 'bg-mild-white',
    'light-green-bg': 'bg-rating-4-very-light',
    'light-blue-bg': 'bg-very-light-blue',
    'light-cyan-bg': 'bg-stats-light',
    lime: 'bg-light-green text-white',
    green: 'bg-ff-green text-white',
    blue: 'bg-light-blue text-white',
    dark: 'bg-stats-dark text-white',
    orange: 'bg-orange text-white',
    yellow: 'bg-localzero-yellow text-gray',
    red: 'bg-red text-white',
  }
  return map[options.value.background] || ''
})

const paddingClass = computed(() => {
  const map: Record<string, string> = {
    none: '',
    small: 'py-4 px-4',
    medium: 'py-8 px-6',
    large: 'py-16 px-8',
  }
  return map[options.value.padding] || 'py-8 px-6'
})

const marginYClass = computed(() => {
  const map: Record<string, string> = {
    none: '',
    small: 'my-4',
    medium: 'my-8',
    large: 'my-16',
  }
  return map[options.value.marginY] || ''
})

const innerClass = computed(() => {
  const map: Record<string, string> = {
    full: 'w-full',
    page: 'max-w-4xl mx-auto',
    narrow: 'max-w-2xl mx-auto',
    // legacy fallbacks
    content: 'max-w-4xl mx-auto',
  }
  return map[options.value.contentWidth] || map[options.value.width] || 'w-full'
})

const widthBreakout = computed(() => {
  // bgWidth 'full' = 100vw breakout; legacy 'full' or 'page' keys also trigger breakout
  const v = options.value.bgWidth || options.value.width
  return v === 'full' || v === 'page' ? 'blokkli-block-container--page-width' : ''
})

// When bgWidth='narrow' the background strip is narrower than the content.
// We constrain the section itself to max-w-2xl centred, and let the inner
// content overflow via negative horizontal margins so it sits wider than the bg.
const bgNarrowClass = computed(() => {
  if (options.value.bgWidth !== 'narrow') return ''
  return 'blokkli-block-container--narrow-bg'
})

const layoutClass = computed(() => {
  const map: Record<string, string> = {
    single: 'flex flex-col gap-6',
    'columns-2': 'grid grid-cols-1 md:grid-cols-2 gap-6',
    'columns-3': 'grid grid-cols-1 md:grid-cols-3 gap-6',
    'columns-1-2': 'grid grid-cols-1 md:grid-cols-3 gap-6 [&>*:first-child]:md:col-span-1 [&>*:last-child]:md:col-span-2',
  }
  return map[options.value.layout] || 'flex flex-col gap-6'
})

const borderClass = computed(() => {
  if (options.value.border === 'none') return ''
  const widthMap: Record<string, string> = {
    thin: 'border',
    medium: 'border-2',
    thick: 'border-4',
  }
  const colorMap: Record<string, string> = {
    gray: 'border-gray-300',
    green: 'border-ff-green',
    blue: 'border-light-blue',
    dark: 'border-stats-dark',
    orange: 'border-orange',
    black: 'border-black',
  }
  const w = widthMap[options.value.border] || 'border'
  const c = colorMap[options.value.borderColor] || 'border-gray-300'
  return `${w} ${c}`
})

const roundedClass = computed(() => {
  const map: Record<string, string> = {
    none: '',
    small: 'rounded',
    medium: 'rounded-lg',
    large: 'rounded-2xl',
    full: 'rounded-full',
  }
  return map[options.value.rounded] || ''
})

const shadowClass = computed(() => {
  const map: Record<string, string> = {
    none: '',
    small: 'shadow-sm',
    medium: 'shadow-md',
    large: 'shadow-xl',
  }
  return map[options.value.shadow] || ''
})
</script>

<style scoped>
.blokkli-block-container {
  width: 100%;
}

.blokkli-block-container--page-width {
  width: 100vw;
  position: relative;
  left: 50%;
  right: 50%;
  margin-left: -50vw;
  margin-right: -50vw;
}

/*
  Narrow background: the section itself is constrained to max-w-2xl (centred),
  while the inner content div can overflow it horizontally via negative margins.
  The overflow on the section is kept visible so content is not clipped.
*/
.blokkli-block-container--narrow-bg {
  max-width: 42rem; /* = max-w-2xl */
  margin-left: auto;
  margin-right: auto;
  overflow: visible;
}

.blokkli-block-container--narrow-bg > div {
  /* Push the inner content wider than the narrow background strip */
  margin-left: calc(-1 * max(0px, (100vw - 42rem) / 2 - (100vw - 56rem) / 2));
  margin-right: calc(-1 * max(0px, (100vw - 42rem) / 2 - (100vw - 56rem) / 2));
}
</style>

<template>
  <div
    :id="'block-' + uuid"
    class="blokkli-block-text prose max-w-none"
    :class="[sizeClass, alignClass, colorClass]"
  >
    <div v-blokkli-editable:content v-html="props.content || ''" />
  </div>
</template>

<script setup lang="ts">
import { BRAND_COLORS, BRAND_COLOR_CLASSES } from '~/utils/blokkliColors'

const { options, uuid } = defineBlokkli({
  bundle: 'text',
  options: {
    size: {
      type: 'radios',
      label: 'Text Size',
      default: 'normal',
      displayAs: 'icons',
      options: {
        xs: { icon: 'icon-blokkli-option-size-small', label: 'XS' },
        small: { icon: 'icon-blokkli-option-size-small', label: 'Klein' },
        normal: { icon: 'icon-blokkli-option-size-normal', label: 'Normal' },
        large: { icon: 'icon-blokkli-option-size-large', label: 'Groß' },
        xl: { icon: 'icon-blokkli-option-size-large', label: 'XL' },
      },
    },
    color: {
      type: 'radios',
      label: 'Textfarbe',
      default: 'default',
      displayAs: 'colors',
      options: {
        default:      { label: 'Standard',    hex: '#111111' },
        black:        { label: 'Schwarz',     hex: '#000000' },
        gray:         { label: 'Grau',        hex: '#505050' },
        white:        { label: 'Weiß',        hex: '#fbfbfb' },
        green:        { label: 'Grün',        hex: '#1da64a' },
        'dark-green': { label: 'Dunkelgrün',  hex: '#339737' },
        blue:         { label: 'Blau',        hex: '#16bae7' },
        dark:         { label: 'Dunkelblau',  hex: '#006e94' },
        orange:       { label: 'Orange',      hex: '#f39200' },
        yellow:       { label: 'Gelb',        hex: '#ffc80c' },
        lime:         { label: 'Lime',        hex: '#afca0b' },
        red:          { label: 'Rot',         hex: '#e30613' },
      },
    },
    align: {
      type: 'radios',
      label: 'Ausrichtung',
      default: 'left',
      options: {
        left: 'Links',
        center: 'Zentriert',
        right: 'Rechts',
        justify: 'Blocksatz',
      },
    },
  },
  editor: {
    addBehaviour: 'editable:content',
    editTitle: (el) => el.textContent,
    mockProps: (text) => {
      return {
        content: text || '<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>',
      }
    },
  },
})

const props = defineProps<{
  content?: string
}>()

const sizeClass = computed(() => {
  const map: Record<string, string> = {
    xs: 'prose-xs text-xs',
    small: 'prose-sm',
    normal: 'prose-base',
    large: 'prose-lg',
    xl: 'prose-xl',
  }
  return map[options.value.size] || 'prose-base'
})

const colorClass = computed(() => BRAND_COLOR_CLASSES[options.value.color as keyof typeof BRAND_COLOR_CLASSES] ?? '')

const alignClass = computed(() => {
  const map: Record<string, string> = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
    justify: 'text-justify',
  }
  return map[options.value.align] || 'text-left'
})
</script>

<style scoped>
.blokkli-block-text {
  margin: 0.5rem 0;
}
</style>

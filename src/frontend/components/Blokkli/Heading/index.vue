<template>
  <div class="blokkli-block-heading-wrapper" :id="'block-' + uuid" :class="[alignClass]">
    <component
      :is="headingTag"
      v-blokkli-editable:text
      class="blokkli-block-heading font-bold"
      :class="[colorClass, sizeClass]"
    >{{ props.text || '' }}</component>
  </div>
</template>

<script setup lang="ts">
const { options, uuid } = defineBlokkli({
  bundle: 'heading',
  options: {
    level: {
      type: 'radios',
      label: 'Heading Level',
      default: 'h2',
      displayAs: 'radios',
      options: {
        h1: 'H1',
        h2: 'H2',
        h3: 'H3',
        h4: 'H4',
        h5: 'H5',
        h6: 'H6'
      },
    },
    color: {
      type: 'radios',
      label: 'Farbe',
      default: 'black',
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
      },
    },
  },
  editor: {
    addBehaviour: 'editable:text',
    editTitle: (el) => el.textContent,
    mockProps: (text) => {
      return {
        text: text || 'Neue Überschrift',
      }
    },
  },
})

const props = defineProps<{
  text?: string
}>()

const headingTag = computed(() => options.value.level || 'h2')

const sizeClass = computed(() => {
  const map: Record<string, string> = {
    h1: 'prose-h1 text-4xl',
    h2: 'prose-h2 text-3xl',
    h3: 'prose-h3 text-2xl',
    h4: 'prose-h4 text-xl',
    h5: 'prose-h5',
    h6: 'prose-h6'
  }
  return map[options.value.level] || 'prose-h2 text-3xl'
})

const colorClass = computed(() => {
  const map: Record<string, string> = {
    default:      '',
    black:        'text-black',
    gray:         'text-gray-700',
    white:        'text-mild-white',
    green:        'text-ff-green',
    'dark-green': 'text-green',
    blue:         'text-light-blue',
    'light-blue': 'text-light-blue', // legacy alias
    dark:         'text-stats-dark',
    orange:       'text-orange',
    yellow:       'text-localzero-yellow',
    lime:         'text-light-green',
    red:          'text-red',
  }
  return map[options.value.color] ?? 'text-black'
})

const alignClass = computed(() => {
  const map: Record<string, string> = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  }
  return map[options.value.align] || 'text-left'
})
</script>

<style scoped>
.blokkli-block-heading-wrapper {
  position: relative;
  z-index: 1;
}

.blokkli-block-heading {
  margin-top: 1rem;
  margin-bottom: 0.75rem;
  line-height: 1.2;
}
</style>

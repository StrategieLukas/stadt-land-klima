<template>
  <div class="blokkli-block-heading-wrapper" :class="[alignClass]">
    <component
      :is="headingTag"
      v-blokkli-editable:text
      class="blokkli-block-heading font-bold"
      :class="[colorClass, sizeClass]"
      v-text="props.text || ''"
    />
  </div>
</template>

<script setup lang="ts">
const { options } = defineBlokkli({
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
      label: 'Color',
      default: 'black',
      displayAs: 'colors',
      options: {
        black: { label: 'Black', hex: '#000000' },
        white: { label: 'White', hex: '#fbdbdb'},
        gray: { label: 'Gray', hex: '#505050' },
        green: { label: 'Green', hex: '#1da64a' },
        'light-blue': { label: 'Light Blue', hex: '#16bae7' },
        orange: { label: 'Orange', hex: '#f39200' },
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
    black: 'text-black',
    white: 'text-[#fbfbfb]',
    gray: 'text-gray',
    green: 'text-ff-green',
    'light-blue': 'text-light-blue',
    orange: 'text-orange',
  }
  return map[options.value.color] || 'text-black'
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
.blokkli-block-heading {
  margin-top: 1rem;
  margin-bottom: 0.75rem;
  line-height: 1.2;
}
</style>

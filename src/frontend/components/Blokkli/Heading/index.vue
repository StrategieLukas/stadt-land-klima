<template>
  <component
    :is="headingTag"
    v-blokkli-editable:text
    class="blokkli-block-heading font-bold"
    :class="[colorClass, sizeClass]"
  >{{ props.text || '' }}</component>
</template>

<script setup lang="ts">
const { options } = defineBlokkli({
  bundle: 'heading',
  options: {
    level: {
      type: 'radios',
      label: 'Heading Level',
      default: 'h2',
      displayAs: 'colors',
      options: {
        h1: { label: 'H1', hex: '#1565c0' },
        h2: { label: 'H2', hex: '#42a5f5' },
        h3: { label: 'H3', hex: '#90caf9' },
        h4: { label: 'H4', hex: '#e0e0e0' },
      },
    },
    color: {
      type: 'radios',
      label: 'Color',
      default: 'black',
      displayAs: 'colors',
      options: {
        black: { label: 'Black', hex: '#000000' },
        gray: { label: 'Gray', hex: '#9e9e9e' },
        green: { label: 'Green', hex: '#4caf50' },
        blue: { label: 'Blue', hex: '#2196f3' },
        orange: { label: 'Orange', hex: '#ff9800' },
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
    h1: 'text-4xl',
    h2: 'text-3xl',
    h3: 'text-2xl',
    h4: 'text-xl',
  }
  return map[options.value.level] || 'text-3xl'
})

const colorClass = computed(() => {
  const map: Record<string, string> = {
    black: 'text-black',
    gray: 'text-gray',
    green: 'text-light-green',
    blue: 'text-blue',
    orange: 'text-orange',
  }
  return map[options.value.color] || 'text-black'
})
</script>

<style scoped>
.blokkli-block-heading {
  margin-top: 1rem;
  margin-bottom: 0.75rem;
  line-height: 1.2;
}
</style>

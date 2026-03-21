<template>
  <div
    class="blokkli-block-text prose prose-sm max-w-none"
    :class="[sizeClass, alignClass]"
  >
    <div v-blokkli-editable:content v-html="props.content || ''" />
  </div>
</template>

<script setup lang="ts">
const { options } = defineBlokkli({
  bundle: 'text',
  options: {
    size: {
      type: 'radios',
      label: 'Text Size',
      default: 'normal',
      displayAs: 'colors',
      options: {
        small: { label: 'Small', hex: '#e0e0e0' },
        normal: { label: 'Normal', hex: '#90caf9' },
        large: { label: 'Large', hex: '#1565c0' },
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
    small: 'prose-sm',
    normal: 'prose-base',
    large: 'prose-lg',
  }
  return map[options.value.size] || 'prose-base'
})

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

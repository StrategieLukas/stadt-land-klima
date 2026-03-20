<template>
  <div
    class="blokkli-block-text prose prose-sm max-w-none"
    :class="[sizeClass]"
  >
    <div v-html="props.content || ''"></div>
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
  },
  editor: {
    addBehaviour: 'no-form',
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
</script>

<style scoped>
.blokkli-block-text {
  margin: 0.5rem 0;
}
</style>

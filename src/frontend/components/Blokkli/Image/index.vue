<template>
  <figure
    class="blokkli-block-image"
    :class="[sizeClass]"
  >
    <img
      v-if="imageUrl"
      :src="imageUrl"
      :alt="props.alt || ''"
      loading="lazy"
      class="w-full h-auto rounded"
    />
    <figcaption
      v-if="props.caption"
      class="text-sm text-gray mt-2"
    >
      {{ props.caption }}
    </figcaption>
  </figure>
</template>

<script setup lang="ts">
const { options } = defineBlokkli({
  bundle: 'image',
  options: {
    size: {
      type: 'radios',
      label: 'Size',
      default: 'full',
      displayAs: 'colors',
      options: {
        small: { label: 'Small (25%)', hex: '#e0e0e0' },
        medium: { label: 'Medium (50%)', hex: '#90caf9' },
        large: { label: 'Large (75%)', hex: '#42a5f5' },
        full: { label: 'Full Width', hex: '#1565c0' },
      },
    },
  },
  editor: {
    addBehaviour: 'no-form',
  },
})

const props = defineProps<{
  imageId?: string
  alt?: string
  caption?: string
}>()

const config = useRuntimeConfig()

const imageUrl = computed(() => {
  if (!props.imageId) return ''
  return `${config.public.clientDirectusUrl}/assets/${props.imageId}?width=1200&quality=80`
})

const sizeClass = computed(() => {
  const map: Record<string, string> = {
    small: 'max-w-xs mx-auto',
    medium: 'max-w-md mx-auto',
    large: 'max-w-3xl mx-auto',
    full: 'max-w-full',
  }
  return map[options.value.size] || 'max-w-full'
})
</script>

<style scoped>
.blokkli-block-image {
  margin: 1rem 0;
}

.blokkli-block-image img {
  display: block;
}
</style>

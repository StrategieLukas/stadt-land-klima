<template>
  <figure 
    class="blokkli-block-image"
    :class="[
      alignmentClass,
      sizeClass,
      roundedClass
    ]"
  >
    <img
      :src="imageUrl"
      :alt="alt || ''"
      :loading="lazyLoad ? 'lazy' : 'eager'"
      class="w-full h-auto"
    />
    <figcaption 
      v-if="caption"
      class="text-sm text-gray mt-2"
      :class="alignmentClass"
    >
      {{ caption }}
    </figcaption>
  </figure>
</template>

<script setup lang="ts">
import { defineBlockComponent, defineBlockOptions } from '@blokkli/blocks'

// Define this as a blökkli block
defineBlockComponent({
  bundle: 'image',
  label: 'Image',
  description: 'Image block with caption',
  category: 'media',
})

// Define configurable options
defineBlockOptions({
  alignment: {
    type: 'select',
    label: 'Alignment',
    default: 'left',
    options: [
      { value: 'left', label: 'Left' },
      { value: 'center', label: 'Center' },
      { value: 'right', label: 'Right' },
    ],
  },
  size: {
    type: 'select',
    label: 'Size',
    default: 'full',
    options: [
      { value: 'small', label: 'Small (25%)' },
      { value: 'medium', label: 'Medium (50%)' },
      { value: 'large', label: 'Large (75%)' },
      { value: 'full', label: 'Full Width' },
    ],
  },
  rounded: {
    type: 'select',
    label: 'Rounded Corners',
    default: 'none',
    options: [
      { value: 'none', label: 'None' },
      { value: 'small', label: 'Small' },
      { value: 'medium', label: 'Medium' },
      { value: 'large', label: 'Large' },
      { value: 'full', label: 'Full (Circle)' },
    ],
  },
  lazyLoad: {
    type: 'toggle',
    label: 'Lazy Load Image',
    default: true,
  },
})

// Component props
const props = defineProps<{
  imageId: string
  alt?: string
  caption?: string
  alignment?: string
  size?: string
  rounded?: string
  lazyLoad?: boolean
}>()

const config = useRuntimeConfig()

// Compute image URL from Directus
const imageUrl = computed(() => {
  if (!props.imageId) return ''
  return `${config.public.clientDirectusUrl}/assets/${props.imageId}?width=1200&quality=80`
})

// Computed CSS classes
const alignmentClass = computed(() => {
  const alignMap: Record<string, string> = {
    left: 'text-left',
    center: 'text-center mx-auto',
    right: 'text-right ml-auto',
  }
  return alignMap[props.alignment || 'left'] || 'text-left'
})

const sizeClass = computed(() => {
  const sizeMap: Record<string, string> = {
    small: 'max-w-xs',
    medium: 'max-w-md',
    large: 'max-w-3xl',
    full: 'max-w-full',
  }
  return sizeMap[props.size || 'full'] ||'max-w-full'
})

const roundedClass = computed(() => {
  const roundedMap: Record<string, string> = {
    none: '',
    small: 'rounded',
    medium: 'rounded-lg',
    large: 'rounded-xl',
    full: 'rounded-full',
  }
  return roundedMap[props.rounded || 'none'] || ''
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

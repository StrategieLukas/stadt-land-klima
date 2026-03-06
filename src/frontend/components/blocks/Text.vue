<template>
  <div 
    class="blokkli-block-text prose prose-sm max-w-none"
    :class="[
      backgroundColorClass,
      alignmentClass,
      sizeClass
    ]"
    :style="{ padding: spacing }"
  >
    <div v-html="sanitizedContent"></div>
  </div>
</template>

<script setup lang="ts">
import sanitizeHtml from 'sanitize-html'
import { defineBlockComponent, defineBlockOptions } from '@blokkli/blocks'

// Define this as a blökkli block
defineBlockComponent({
  bundle: 'text',
  label: 'Text',
  description: 'Rich text content block',
  category: 'content',
})

// Define configurable options for this block
defineBlockOptions({
  backgroundColor: {
    type: 'select',
    label: 'Background Color',
    default: 'transparent',
    options: [
      { value: 'transparent', label: 'Transparent' },
      { value: 'white', label: 'White' },
      { value: 'gray', label: 'Light Gray' },
      { value: 'blue', label: 'Light Blue' },
      { value: 'green', label: 'Light Green' },
    ],
  },
  alignment: {
    type: 'select',
    label: 'Text Alignment',
    default: 'left',
    options: [
      { value: 'left', label: 'Left' },
      { value: 'center', label: 'Center' },
      { value: 'right', label: 'Right' },
      { value: 'justify', label: 'Justify' },
    ],
  },
  size: {
    type: 'select',
    label: 'Text Size',
    default: 'normal',
    options: [
      { value: 'small', label: 'Small' },
      { value: 'normal', label: 'Normal' },
      { value: 'large', label: 'Large' },
    ],
  },
  spacing: {
    type: 'select',
    label: 'Padding',
    default: '1rem',
    options: [
      { value: '0', label: 'None' },
      { value: '0.5rem', label: 'Small' },
      { value: '1rem', label: 'Normal' },
      { value: '2rem', label: 'Large' },
    ],
  },
})

// Component props (block data)
const props = defineProps<{
  content: string
  backgroundColor?: string
  alignment?: string
  size?: string
  spacing?: string
}>()

// Sanitize HTML content to prevent XSS
const sanitizedContent = computed(() => {
  return sanitizeHtml(props.content || '', {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      '*': ['class', 'style'],
    },
  })
})

// Computed CSS classes based on options
const backgroundColorClass = computed(() => {
  const bgMap: Record<string, string> = {
    transparent: '',
    white: 'bg-white',
    gray: 'bg-mild-white',
    blue: 'bg-very-light-blue',
    green: 'bg-light-green/10',
  }
  return bgMap[props.backgroundColor || 'transparent'] || ''
})

const alignmentClass = computed(() => {
  const alignMap: Record<string, string> = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
    justify: 'text-justify',
  }
  return alignMap[props.alignment || 'left'] || 'text-left'
})

const sizeClass = computed(() => {
  const sizeMap: Record<string, string> = {
    small: 'text-sm',
    normal: 'text-base',
    large: 'text-lg',
  }
  return sizeMap[props.size || 'normal'] || 'text-base'
})
</script>

<style scoped>
.blokkli-block-text {
  transition: all 0.2s ease;
}

.blokkli-block-text :deep(p:first-child) {
  margin-top: 0;
}

.blokkli-block-text :deep(p:last-child) {
  margin-bottom: 0;
}
</style>

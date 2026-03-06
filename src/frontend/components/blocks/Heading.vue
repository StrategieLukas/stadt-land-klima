<template>
  <component
    :is="headingTag"
    class="blokkli-block-heading"
    :class="[
      alignmentClass,
      colorClass,
      sizeClass,
      fontFamilyClass
    ]"
  >
    {{ text }}
  </component>
</template>

<script setup lang="ts">
import { defineBlockComponent, defineBlockOptions } from '@blokkli/blocks'

// Define this as a blökkli block
defineBlockComponent({
  bundle: 'heading',
  label: 'Heading',
  description: 'Heading text block',
  category: 'content',
})

// Define configurable options
defineBlockOptions({
  level: {
    type: 'select',
    label: 'Heading Level',
    default: 'h2',
    options: [
      { value: 'h1', label: 'Heading 1' },
      { value: 'h2', label: 'Heading 2' },
      { value: 'h3', label: 'Heading 3' },
      { value: 'h4', label: 'Heading 4' },
    ],
  },
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
  color: {
    type: 'select',
    label: 'Color',
    default: 'black',
    options: [
      { value: 'black', label: 'Black' },
      { value: 'gray', label: 'Gray' },
      { value: 'green', label: 'Green' },
      { value: 'blue', label: 'Blue' },
      { value: 'orange', label: 'Orange' },
    ],
  },
  size: {
    type: 'select',
    label: 'Size Override',
    default: 'default',
    options: [
      { value: 'default', label: 'Default' },
      { value: 'small', label: 'Small' },
      { value: 'large', label: 'Large' },
    ],
  },
  fontFamily: {
    type: 'select',
    label: 'Font Family',
    default: 'inter',
    options: [
      { value: 'inter', label: 'Inter' },
      { value: 'roboto', label: 'Roboto Condensed' },
    ],
  },
})

// Component props
const props = defineProps<{
  text: string
  level?: string
  alignment?: string
  color?: string
  size?: string
  fontFamily?: string
}>()

// Computed heading tag
const headingTag = computed(() => props.level || 'h2')

// Computed CSS classes
const alignmentClass = computed(() => {
  const alignMap: Record<string, string> = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  }
  return alignMap[props.alignment || 'left'] || 'text-left'
})

const colorClass = computed(() => {
  const colorMap: Record<string, string> = {
    black: 'text-black',
    gray: 'text-gray',
    green: 'text-light-green',
    blue: 'text-blue',
    orange: 'text-orange',
  }
  return colorMap[props.color || 'black'] || 'text-black'
})

const sizeClass = computed(() => {
  if (props.size === 'default') return ''
  
  const sizeMap: Record<string, string> = {
    small: 'text-lg',
    large: 'text-3xl',
  }
  return sizeMap[props.size || 'default'] || ''
})

const fontFamilyClass = computed(() => {
  const fontMap: Record<string, string> = {
    inter: 'font-sans',
    roboto: 'font-roboto',
  }
  return fontMap[props.fontFamily || 'inter'] || 'font-sans'
})
</script>

<style scoped>
.blokkli-block-heading {
  margin-top: 1rem;
  margin-bottom: 0.75rem;
  font-weight: bold;
  line-height: 1.5;
}
</style>

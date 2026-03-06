<template>
  <div 
    class="blokkli-block-cta"
    :class="[
      backgroundColorClass,
      alignmentClass,
      sizeClass
    ]"
  >
    <h3 v-if="title" class="font-bold mb-4">{{ title }}</h3>
    <p v-if="text" class="mb-6">{{ text }}</p>
    <div class="flex gap-4" :class="buttonAlignmentClass">
      <a
        v-if="primaryButtonText && primaryButtonLink"
        :href="primaryButtonLink"
        class="inline-flex items-center justify-center px-6 py-3 font-bold transition-all"
        :class="primaryButtonClass"
        :target="openInNewTab ? '_blank' : '_self'"
        :rel="openInNewTab ? 'noopener noreferrer' : undefined"
      >
        {{ primaryButtonText }}
        <span class="ml-2">→</span>
      </a>
      <a
        v-if="secondaryButtonText && secondaryButtonLink"
        :href="secondaryButtonLink"
        class="inline-flex items-center justify-center px-6 py-3 font-bold border-2 transition-all"
        :class="secondaryButtonClass"
        :target="openInNewTab ? '_blank' : '_self'"
        :rel="openInNewTab ? 'noopener noreferrer' : undefined"
      >
        {{ secondaryButtonText }}
        <span class="ml-2">→</span>
      </a>
    </div>
  </div>
</template>

<script setup lang="ts">
import { defineBlockComponent, defineBlockOptions } from '@blokkli/blocks'

// Define this as a blökkli block
defineBlockComponent({
  bundle: 'cta',
  label: 'Call to Action',
  description: 'Call to action block with buttons',
  category: 'action',
})

// Define configurable options
defineBlockOptions({
  backgroundColor: {
    type: 'select',
    label: 'Background Color',
    default: 'light-blue',
    options: [
      { value: 'transparent', label: 'Transparent' },
      { value: 'white', label: 'White' },
      { value: 'light-blue', label: 'Light Blue' },
      { value: 'light-green', label: 'Light Green' },
      { value: 'blue', label: 'Blue' },
      { value: 'green', label: 'Green' },
    ],
  },
  alignment: {
    type: 'select',
    label: 'Content Alignment',
    default: 'center',
    options: [
      { value: 'left', label: 'Left' },
      { value: 'center', label: 'Center' },
      { value: 'right', label: 'Right' },
    ],
  },
  size: {
    type: 'select',
    label: 'Padding Size',
    default: 'large',
    options: [
      { value: 'small', label: 'Small' },
      { value: 'medium', label: 'Medium' },
      { value: 'large', label: 'Large' },
    ],
  },
  buttonStyle: {
    type: 'select',
    label: 'Button Style',
    default: 'green',
    options: [
      { value: 'green', label: 'Green' },
      { value: 'orange', label: 'Orange' },
      { value: 'blue', label: 'Blue' },
    ],
  },
  openInNewTab: {
    type: 'toggle',
    label: 'Open Links in New Tab',
    default: false,
  },
})

// Component props
const props = defineProps<{
  title?: string
  text?: string
  primaryButtonText?: string
  primaryButtonLink?: string
  secondaryButtonText?: string
  secondaryButtonLink?: string
  backgroundColor?: string
  alignment?: string
  size?: string
  buttonStyle?: string
  openInNewTab?: boolean
}>()

// Computed CSS classes
const backgroundColorClass = computed(() => {
  const bgMap: Record<string, string> = {
    transparent: '',
    white: 'bg-white',
    'light-blue': 'bg-very-light-blue',
    'light-green': 'bg-light-green/10',
    blue: 'bg-blue text-white',
    green: 'bg-light-green text-white',
  }
  return bgMap[props.backgroundColor || 'light-blue'] || 'bg-very-light-blue'
})

const alignmentClass = computed(() => {
  const alignMap: Record<string, string> = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  }
  return alignMap[props.alignment || 'center'] || 'text-center'
})

const buttonAlignmentClass = computed(() => {
  const alignMap: Record<string, string> = {
    left: 'justify-start',
    center: 'justify-center',
    right: 'justify-end',
  }
  return alignMap[props.alignment || 'center'] || 'justify-center'
})

const sizeClass = computed(() => {
  const sizeMap: Record<string, string> = {
    small: 'p-4',
    medium: 'p-8',
    large: 'p-12',
  }
  return sizeMap[props.size || 'large'] || 'p-12'
})

const primaryButtonClass = computed(() => {
  const styleMap: Record<string, string> = {
    green: 'bg-light-green text-white hover:brightness-110',
    orange: 'bg-orange text-white hover:brightness-110',
    blue: 'bg-blue text-white hover:brightness-110',
  }
  return styleMap[props.buttonStyle || 'green'] || 'bg-light-green text-white hover:brightness-110'
})

const secondaryButtonClass = computed(() => {
  const styleMap: Record<string, string> = {
    green: 'border-light-green text-light-green hover:bg-light-green hover:text-white',
    orange: 'border-orange text-orange hover:bg-orange hover:text-white',
    blue: 'border-blue text-blue hover:bg-blue hover:text-white',
  }
  return styleMap[props.buttonStyle || 'green'] || 'border-light-green text-light-green hover:bg-light-green hover:text-white'
})
</script>

<style scoped>
.blokkli-block-cta {
  margin: 2rem 0;
  border-radius: 0.5rem;
  transition: all 0.2s ease;
}

.blokkli-block-cta h3 {
  font-size: clamp(1.5rem, 3vw, 2rem);
  line-height: 1.3;
}

.blokkli-block-cta p {
  font-size: 1.125rem;
  line-height: 1.6;
}
</style>

<template>
  <div
    class="blokkli-block-cta rounded-lg"
    :class="[bgClass, sizeClass]"
  >
    <h3 v-if="props.title" v-blokkli-editable:title class="font-bold mb-4 text-xl">{{ props.title }}</h3>
    <p v-if="props.text" v-blokkli-editable:text class="mb-6">{{ props.text }}</p>
    <div class="flex gap-4 flex-wrap">
      <a
        v-if="props.primaryButtonText && props.primaryButtonLink"
        :href="props.primaryButtonLink"
        class="inline-flex items-center justify-center px-6 py-3 font-bold rounded transition-all bg-light-green text-white hover:brightness-110"
      >
        {{ props.primaryButtonText }}
        <span class="ml-2">→</span>
      </a>
      <a
        v-if="props.secondaryButtonText && props.secondaryButtonLink"
        :href="props.secondaryButtonLink"
        class="inline-flex items-center justify-center px-6 py-3 font-bold rounded border-2 border-light-green text-light-green hover:bg-light-green hover:text-white transition-all"
      >
        {{ props.secondaryButtonText }}
        <span class="ml-2">→</span>
      </a>
    </div>
  </div>
</template>

<script setup lang="ts">
const { options } = defineBlokkli({
  bundle: 'cta',
  options: {
    background: {
      type: 'radios',
      label: 'Background',
      default: 'light-blue',
      displayAs: 'colors',
      options: {
        transparent: { label: 'Transparent', hex: '#ffffff' },
        'light-blue': { label: 'Light Blue', hex: '#bbdefb' },
        'light-green': { label: 'Light Green', hex: '#c8e6c9' },
        blue: { label: 'Blue', hex: '#2196f3' },
        green: { label: 'Green', hex: '#4caf50' },
      },
    },
    size: {
      type: 'radios',
      label: 'Padding',
      default: 'large',
      displayAs: 'colors',
      options: {
        small: { label: 'Small', hex: '#e0e0e0' },
        medium: { label: 'Medium', hex: '#90caf9' },
        large: { label: 'Large', hex: '#1565c0' },
      },
    },
  },
  editor: {
    addBehaviour: 'no-form',
    mockProps: (text) => {
      return {
        title: 'Handeln Sie jetzt!',
        text: text || 'Gemeinsam können wir den Klimaschutz in Ihrer Kommune vorantreiben.',
        primaryButtonText: 'Mehr erfahren',
        primaryButtonLink: '#',
      }
    },
  },
})

const props = defineProps<{
  title?: string
  text?: string
  primaryButtonText?: string
  primaryButtonLink?: string
  secondaryButtonText?: string
  secondaryButtonLink?: string
}>()

const bgClass = computed(() => {
  const map: Record<string, string> = {
    transparent: '',
    'light-blue': 'bg-very-light-blue',
    'light-green': 'bg-light-green/10',
    blue: 'bg-blue text-white',
    green: 'bg-light-green text-white',
  }
  return map[options.value.background] || 'bg-very-light-blue'
})

const sizeClass = computed(() => {
  const map: Record<string, string> = {
    small: 'p-4',
    medium: 'p-8',
    large: 'p-12',
  }
  return map[options.value.size] || 'p-12'
})
</script>

<style scoped>
.blokkli-block-cta {
  margin: 2rem 0;
  transition: all 0.2s ease;
}
</style>

<template>
  <figure
    class="blokkli-block-image"
    :class="[sizeClass]"
  >
    <!-- Conditional link wrapper -->
    <component
      :is="linkTag"
      v-bind="linkAttrs"
      :class="options.linkType !== 'none' && !isEditing ? 'block' : ''"
    >
      <!-- v-blokkli-droppable:imageId enables drag-and-drop and media library selection -->
      <div v-blokkli-droppable:imageId class="relative">
        <img
          v-if="imageUrl"
          :src="imageUrl"
          :alt="props.alt || ''"
          loading="lazy"
          class="w-full h-auto rounded"
        />
        <!-- Placeholder shown when no image is selected -->
        <div
          v-else
          class="flex items-center justify-center bg-gray-100 rounded border-2 border-dashed border-gray-300 min-h-[12rem] text-gray-400"
        >
          <span class="text-sm">Bild aus Medienbibliothek auswählen oder hierher ziehen</span>
        </div>
      </div>
    </component>
    <figcaption
      v-if="props.caption || isEditing"
      v-blokkli-editable:caption
      class="text-sm text-gray mt-2 text-center italic"
      v-text="props.caption"
    />
  </figure>
</template>

<script setup lang="ts">
import { resolveComponent } from 'vue'

const { options, isEditing } = defineBlokkli({
  bundle: 'image',
  options: {
    size: {
      type: 'radios',
      label: 'Größe',
      default: 'full',
      options: {
        small: 'Klein (25%)',
        medium: 'Mittel (50%)',
        large: 'Groß (75%)',
        full: 'Volle Breite',
      },
    },
    linkType: {
      type: 'radios',
      label: 'Link-Typ',
      default: 'none',
      options: {
        none: 'Kein',
        internal: 'Intern',
        external: 'Extern',
      },
    },
    link: {
      type: 'text',
      label: 'Link (Slug oder URL)',
      default: '',
      inputType: 'text',
    },
  },
  editor: {
    addBehaviour: 'no-form',
    editTitle: () => 'Bild',
    mockProps: () => {
      return { imageId: '', alt: '', caption: '' }
    },
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

const linkTag = computed(() => {
  if (isEditing.value) return 'div'
  if (options.value.linkType === 'external') return 'a'
  if (options.value.linkType === 'internal') return resolveComponent('NuxtLink')
  return 'div'
})

const linkAttrs = computed(() => {
  if (isEditing.value || options.value.linkType === 'none') return {}
  const lv = options.value.link || '#'
  if (options.value.linkType === 'external') {
    return { href: lv, target: '_blank', rel: 'noopener noreferrer' }
  }
  return { to: '/' + lv.replace(/^\//, '') }
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

<template>
  <div
    :id="'block-' + uuid"
    class="blokkli-block-richtext"
    :class="[sizeClass, alignClass]"
  >
    <!-- Edit mode: show raw markdown source for inline editing -->
    <pre
      v-if="isEditing"
      v-blokkli-editable:content
      class="markdown-source prose prose-sm max-w-none whitespace-pre-wrap font-mono text-sm bg-gray-50 p-3 rounded border border-gray-200 min-h-[6rem]"
      v-text="props.content || ''"
    />

    <!-- View mode: render markdown as HTML -->
    <div
      v-else
      class="prose max-w-none"
      :class="[sizeClass]"
      v-html="renderedContent"
    />
  </div>
</template>

<script setup lang="ts">
// @ts-expect-error no types package needed at runtime
import MarkdownIt from 'markdown-it'

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  breaks: true,
})

const { options, isEditing, uuid } = defineBlokkli({
  bundle: 'richtext',
  options: {
    size: {
      type: 'radios',
      label: 'Text Size',
      default: 'normal',
      displayAs: 'icons',
      options: {
        small: { icon: 'icon-blokkli-option-size-small', label: 'Small' },
        normal: { icon: 'icon-blokkli-option-size-normal', label: 'Normal' },
        large: { icon: 'icon-blokkli-option-size-large', label: 'Large' },
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
        content: text || '## Überschrift\n\nHier können Sie **Markdown** schreiben.',
      }
    },
  },
})

const props = defineProps<{
  content?: string
}>()

const renderedContent = computed(() => {
  if (!props.content) return ''
  return md.render(props.content)
})

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
.blokkli-block-richtext {
  margin: 0.5rem 0;
}

.markdown-source {
  outline: 2px dashed #60a5fa;
  outline-offset: 2px;
}
</style>

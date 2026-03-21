<template>
  <div
    class="blokkli-block-richtext"
    :class="[sizeClass]"
  >
    <!-- Edit mode: show raw markdown source for inline editing -->
    <pre
      v-if="isEditing"
      v-blokkli-editable:content
      class="markdown-source prose prose-sm max-w-none whitespace-pre-wrap font-mono text-sm bg-gray-50 p-3 rounded border border-gray-200 min-h-[6rem]"
    >{{ props.content || '' }}</pre>

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
import MarkdownIt from 'markdown-it'

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  breaks: true,
})

const { options, isEditing } = defineBlokkli({
  bundle: 'richtext',
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
    addBehaviour: 'editable:content',
    editTitle: (el) => el.textContent,
    mockProps: (text) => ({
      content: text || '## Überschrift\n\nHier können Sie **Markdown-Text** eingeben.\n\n- Punkt 1\n- Punkt 2\n- Punkt 3',
    }),
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

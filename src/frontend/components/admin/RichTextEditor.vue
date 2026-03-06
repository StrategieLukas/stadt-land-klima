<template>
  <div class="rich-text-editor border border-gray-300 rounded-lg overflow-hidden">
    <!-- Toolbar -->
    <div class="flex items-center gap-1 p-2 bg-gray-50 border-b border-gray-300 flex-wrap">
      <button
        type="button"
        @click="editor.chain().focus().toggleBold().run()"
        :class="{ 'bg-gray-200': editor?.isActive('bold') }"
        class="p-2 rounded hover:bg-gray-200 transition-colors"
        title="Bold"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path>
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path>
        </svg>
      </button>
      
      <button
        type="button"
        @click="editor.chain().focus().toggleItalic().run()"
        :class="{ 'bg-gray-200': editor?.isActive('italic') }"
        class="p-2 rounded hover:bg-gray-200 transition-colors"
        title="Italic"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 4h8m-4 0v16m-4 0h8"></path>
        </svg>
      </button>
      
      <button
        type="button"
        @click="editor.chain().focus().toggleUnderline().run()"
        :class="{ 'bg-gray-200': editor?.isActive('underline') }"
        class="p-2 rounded hover:bg-gray-200 transition-colors"
        title="Underline"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3m-13 18h14"></path>
        </svg>
      </button>

      <div class="w-px h-6 bg-gray-300 mx-1"></div>

      <button
        type="button"
        @click="editor.chain().focus().toggleBulletList().run()"
        :class="{ 'bg-gray-200': editor?.isActive('bulletList') }"
        class="p-2 rounded hover:bg-gray-200 transition-colors"
        title="Bullet List"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
        </svg>
      </button>

      <button
        type="button"
        @click="editor.chain().focus().toggleOrderedList().run()"
        :class="{ 'bg-gray-200': editor?.isActive('orderedList') }"
        class="p-2 rounded hover:bg-gray-200 transition-colors"
        title="Numbered List"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5h12M9 12h12M9 19h12M4 6v4m0 0v4m0-4h.01"></path>
        </svg>
      </button>

      <div class="w-px h-6 bg-gray-300 mx-1"></div>

      <button
        type="button"
        @click="setLink"
        :class="{ 'bg-gray-200': editor?.isActive('link') }"
        class="p-2 rounded hover:bg-gray-200 transition-colors"
        title="Link"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path>
        </svg>
      </button>

      <button
        type="button"
        @click="editor.chain().focus().unsetLink().run()"
        :disabled="!editor?.isActive('link')"
        class="p-2 rounded hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="Remove Link"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
      </button>

      <div class="w-px h-6 bg-gray-300 mx-1"></div>

      <button
        type="button"
        @click="editor.chain().focus().toggleHeading({ level: 2 }).run()"
        :class="{ 'bg-gray-200': editor?.isActive('heading', { level: 2 }) }"
        class="p-2 px-3 rounded hover:bg-gray-200 transition-colors font-bold"
        title="Heading 2"
      >
        H2
      </button>

      <button
        type="button"
        @click="editor.chain().focus().toggleHeading({ level: 3 }).run()"
        :class="{ 'bg-gray-200': editor?.isActive('heading', { level: 3 }) }"
        class="p-2 px-3 rounded hover:bg-gray-200 transition-colors font-bold"
        title="Heading 3"
      >
        H3
      </button>
    </div>

    <!-- Editor Content -->
    <EditorContent :editor="editor" class="prose prose-sm max-w-none p-4 min-h-[200px] focus:outline-none" />
  </div>
</template>

<script setup>
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Underline from '@tiptap/extension-underline'
import { watch } from 'vue'

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['update:modelValue'])

const editor = useEditor({
  extensions: [
    StarterKit,
    Link.configure({
      openOnClick: false,
      HTMLAttributes: {
        class: 'text-blue-600 hover:underline'
      }
    }),
    Underline
  ],
  content: props.modelValue,
  onUpdate: ({ editor }) => {
    emit('update:modelValue', editor.getHTML())
  },
  editorProps: {
    attributes: {
      class: 'prose prose-sm max-w-none focus:outline-none'
    }
  }
})

// Watch for external changes to modelValue
watch(() => props.modelValue, (newValue) => {
  const isSame = editor.value.getHTML() === newValue
  if (!isSame && newValue !== editor.value.getHTML()) {
    editor.value.commands.setContent(newValue, false)
  }
})

function setLink() {
  const previousUrl = editor.value.getAttributes('link').href
  const url = window.prompt('URL:', previousUrl)

  if (url === null) {
    return
  }

  if (url === '') {
    editor.value.chain().focus().unsetLink().run()
    return
  }

  editor.value.chain().focus().setLink({ href: url }).run()
}
</script>

<style>
.ProseMirror {
  outline: none;
}

.ProseMirror p {
  margin-top: 0.5em;
  margin-bottom: 0.5em;
}

.ProseMirror ul,
.ProseMirror ol {
  padding-left: 1.5em;
  margin-top: 0.5em;
  margin-bottom: 0.5em;
}

.ProseMirror h2 {
  font-size: 1.5em;
  font-weight: bold;
  margin-top: 1em;
  margin-bottom: 0.5em;
}

.ProseMirror h3 {
  font-size: 1.25em;
  font-weight: bold;
  margin-top: 0.75em;
  margin-bottom: 0.5em;
}

.ProseMirror a {
  color: #2563eb;
  text-decoration: underline;
}
</style>

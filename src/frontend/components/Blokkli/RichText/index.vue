<template>
  <div
    :id="getBlokkliBlockId(options.anchor, uuid)"
    class="blokkli-block-richtext w-full overflow-x-auto"
    :class="[alignClass]"
  >
    <!-- Edit mode: show raw markdown source for inline editing -->
    <pre
      v-if="isEditing"
      v-blokkli-editable:content
      class="markdown-source prose prose-sm min-h-24 max-w-none rounded-sm border border-gray-200 bg-gray-50 p-3 font-mono text-sm whitespace-pre-wrap"
      v-text="props.content || ''"
    />

    <!-- View mode: render markdown as HTML -->
    <div v-else class="prose max-w-none" :class="[sizeClass, alignClass]" v-html="sanitizeHtml(renderedContent)" />
  </div>
</template>

<script setup lang="ts">
import MarkdownIt from "markdown-it";
import { getBlokkliBlockId } from "~/utils/blokkliLinks";
import { sanitizeHtml } from "~/utils/sanitizeHtml";

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  breaks: true,
});

const isEditing = import.meta.blokkliEditing;

const { options, uuid } = defineBlokkli({
  bundle: "richtext",
  propsFieldMapping: {
    content: { name: "content", type: "editable" },
  },
  globalOptions: ["anchor"],
  options: {
    size: {
      type: "radios",
      label: "Text Size",
      default: "normal",
      displayAs: "icons",
      options: {
        small: { icon: "icon-blokkli-option-size-small", label: "Small" },
        normal: { icon: "icon-blokkli-option-size-normal", label: "Normal" },
        large: { icon: "icon-blokkli-option-size-large", label: "Large" },
      },
    },
    align: {
      type: "radios",
      label: "Ausrichtung",
      default: "left",
      options: {
        left: "Links",
        center: "Zentriert",
        right: "Rechts",
        justify: "Blocksatz",
      },
    },
  },
  editor: {
    addBehaviour: "editable:content",
    editTitle: (el) => el.textContent,
    mockProps: (text) => {
      return {
        content: text || "## Überschrift\n\nHier kannst du **Markdown** schreiben.",
      };
    },
  },
});

const props = defineProps<{
  content?: string | undefined;
}>();

const renderedContent = computed(() => {
  if (!props.content) return "";
  return sanitizeHtml(md.render(props.content));
});

const sizeClass = computed(() => {
  const map: Record<string, string> = {
    small: "prose-sm",
    normal: "prose-base",
    large: "prose-lg",
  };
  return map[options.value.size] || "prose-base";
});

const alignClass = computed(() => {
  const map: Record<string, string> = {
    left: "text-left",
    center: "text-center",
    right: "text-right",
    justify: "text-justify",
  };
  return map[options.value.align] || "text-left";
});
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

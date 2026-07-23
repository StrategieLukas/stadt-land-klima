<template>
  <div
    v-if="html"
    class="question-background has-long-links prose prose-sm max-w-none rounded-lg border border-solid-light-blue-30 bg-solid-very-light-blue-60 p-4 text-gray"
    v-html="html"
  />
</template>

<script setup lang="ts">
import MarkdownIt from "markdown-it";
import sanitizeHtml from "sanitize-html";

const props = defineProps<{
  content?: string | null;
}>();

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
});

const markdownSanitizeOptions = {
  allowedTags: ["a", "blockquote", "br", "code", "em", "h1", "h2", "h3", "h4", "li", "ol", "p", "pre", "strong", "ul"],
  allowedAttributes: {
    a: ["href", "name", "target", "rel"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", {
      rel: "noopener noreferrer",
      target: "_blank",
    }),
  },
};

const html = computed(() => {
  if (!props.content?.trim()) return "";
  return sanitizeHtml(md.render(props.content), markdownSanitizeOptions);
});
</script>

<style scoped>
.question-background :deep(:first-child) {
  margin-top: 0;
}

.question-background :deep(:last-child) {
  margin-bottom: 0;
}
</style>

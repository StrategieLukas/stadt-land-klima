<template>
  <section class="py-6 first:pt-0 last:pb-0">
    <h2 class="mb-4 text-xl font-bold text-(--slk-text-strong)">
      {{ title }}
    </h2>
    <div class="prose max-w-none break-words prose-gray" v-html="sanitizeHtml(sanitizedHtml)" />
  </section>
</template>

<script setup lang="ts">
import { sanitizeHtml } from "~/utils/sanitizeHtml";

const props = defineProps<{
  title: string;
  html: string;
}>();

const sanitizedHtml = computed(() => sanitizeHtml(props.html));
</script>

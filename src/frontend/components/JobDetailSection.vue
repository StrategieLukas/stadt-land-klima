<template>
  <section class="rounded-lg border border-gray-100 bg-white p-5 shadow-sm sm:p-6 lg:p-7">
    <h2 class="mb-4 flex items-center gap-3 text-xl font-bold text-gray-900">
      <span class="h-2 w-2 rounded-full bg-light-green" aria-hidden="true" />
      {{ title }}
    </h2>
    <div class="prose prose-gray max-w-none" v-html="sanitizeHtml(sanitizedHtml)" />
  </section>
</template>

<script setup lang="ts">
import { sanitizeHtml } from '~/utils/sanitizeHtml'

const props = defineProps<{
  title: string
  html: string
}>()

const sanitizedHtml = computed(() => sanitizeHtml(props.html))
</script>

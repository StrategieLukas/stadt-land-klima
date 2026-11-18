<template>
  <header class="mb-8 pt-2 sm:pt-4">
    <p v-if="preview" class="mb-3 text-sm font-semibold text-gray">
      <span class="badge badge-outline">{{ $t("municipality.hero.preview") }}</span>
    </p>
    <h1 class="mb-4 font-heading text-4xl leading-tight font-black break-words text-light-green sm:text-6xl">
      {{ name }}
    </h1>
    <p class="max-w-3xl text-lg leading-relaxed text-gray">
      {{ introduction ?? $t("municipality.hero.introduction") }}
    </p>
  </header>
</template>
<script setup lang="ts">
defineProps<{ name: string; preview?: boolean; introduction?: string }>();
</script>

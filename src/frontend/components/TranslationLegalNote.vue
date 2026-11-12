<template>
  <p
    v-if="$locale !== 'de-DE'"
    data-translation-legal-note
    class="relative z-10 mx-auto mt-6 max-w-(--breakpoint-xl) text-center text-xs text-rating-4-very-light"
  >
    {{ $t("translation.machine_notice") }}
  </p>
</template>
<script setup lang="ts">
const { $locale } = useNuxtApp();
</script>

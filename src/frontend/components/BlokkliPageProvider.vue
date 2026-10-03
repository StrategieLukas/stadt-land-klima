<template>
  <!-- Preview drafts require the browser's authenticated session and storage. -->
  <ClientOnly v-if="isPreview">
    <BlokkliProvider v-bind="$attrs">
      <template #default="state"><slot v-bind="state" /></template>
    </BlokkliProvider>
  </ClientOnly>
  <BlokkliProvider v-else v-bind="$attrs">
    <template #default="state"><slot v-bind="state" /></template>
  </BlokkliProvider>
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false })

const route = useRoute()
const isPreview = computed(() => Boolean(route.query.blokkliPreview))
</script>

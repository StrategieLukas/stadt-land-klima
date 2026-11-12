<template>
  <div />
</template>

<script setup lang="ts">
const config = useRuntimeConfig();
// Keep old bookmarks and navigation links working with either a prefix or a CMS origin.
const cmsBase = String(config.public.clientDirectusUrl || "/backend").replace(/\/+$/, "");
await navigateTo(`${cmsBase}/admin/`, { external: true, redirectCode: 302 });
</script>

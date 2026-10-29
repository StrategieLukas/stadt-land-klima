<template>
  <form :action="action" method="post" target="_blank" v-bind="{ rel: 'noopener', 'accept-charset': 'UTF-8' }">
    <input type="hidden" name="request" :value="JSON.stringify(request)" />
    <slot />
  </form>
</template>
<script setup lang="ts">
defineProps<{ action: string; request: Record<string, unknown> }>();
</script>

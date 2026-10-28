<template>
  <ElectionsWahlCheckFlow embedded />
</template>

<script setup lang="ts">
definePageMeta({ layout: "wahlcheck", key: (route) => route.path });
</script>

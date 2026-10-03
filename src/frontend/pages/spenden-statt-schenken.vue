<template>
  <div />
</template>

<script setup lang="ts">
import { DONATION_PAGE_PATH } from "~/shared/donation";

await navigateTo(DONATION_PAGE_PATH, { redirectCode: 301 });
</script>

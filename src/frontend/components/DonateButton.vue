<template>
  <CanonicalButton
    :label="$t('donate.label')"
    href="https://www.betterplace.org/de/projects/157241-stadt-land-klima-bringe-kommunalen-klimaschutz-voran"
    icon-slug="icon_hand_holding_heart"
    color="orange"
    :external="true"
  />
</template>

<script setup lang="ts">
const { $t } = useNuxtApp()
</script>

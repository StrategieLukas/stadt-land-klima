<template>
  <CanonicalButton
    :label="$t('generic.log_in')"
    href="/backend"
    icon-slug="icon_login_arrow"
    color="bright-green"
    text-color="white"
  />
</template>

<script setup lang="ts">
const { $t } = useNuxtApp()
</script>

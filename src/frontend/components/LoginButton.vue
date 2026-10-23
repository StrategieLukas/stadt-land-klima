<template>
  <CanonicalButton
    :on-click="props.onClick"
    :label="$t('generic.log_in')"
    href="/backend"
    icon-slug="icon_login_arrow"
    color="bright-green"
    text-color="white"
  />
</template>

<script setup lang="ts">
const props = defineProps<{ onClick?: ((event: MouseEvent) => void) | undefined }>()
const { $t } = useNuxtApp()
</script>

<template>
  <CanonicalButton
    :on-click="props.onClick"
    :label="$t('donate.label')"
    :href="DONATION_PAGE_PATH"
    icon-slug="icon_hand_holding_heart"
    color="orange"
  />
</template>

<script setup lang="ts">
import { DONATION_PAGE_PATH } from "~/shared/donation";

const props = defineProps<{ onClick?: ((event: MouseEvent) => void) | undefined }>()
const { $t } = useNuxtApp()
</script>

<template>
  <CanonicalButton
    :label="$t('donate.label')"
    :href="DONATION_PAGE_PATH"
    icon-slug="icon_hand_holding_heart"
    color="orange"
  />
</template>

<script setup lang="ts">
import { DONATION_PAGE_PATH } from "~/shared/donation";

const { $t } = useNuxtApp()
</script>

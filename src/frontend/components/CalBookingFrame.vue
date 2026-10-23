<template>
  <iframe
    src="https://app.cal.com/stadt-land-klima/onboarding?embed=onboarding&layout=month_view"
    :title="$t('onboarding.title')"
    class="block h-full min-h-[400px] w-full border-0 bg-white"
    referrerpolicy="no-referrer"
  />
</template>
<script setup lang="ts">
const { $t } = useNuxtApp();
</script>

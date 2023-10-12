<template>
  <div class="mb-6 mr-2 flex max-w-2xl flex-col items-center justify-stretch gap-4 xs:flex-row sm:mr-0">
    <div>{{ $t("implementation_traffic_light") }}</div>
    <div class="grid grow grid-cols-5 text-center text-xs text-white sm:text-sm">
      <div class="overlfow-visible relative bg-ranking-0-2 p-1 sm:p-2">0-20</div>
      <div class="overlfow-visible relative bg-ranking-2-4 p-1 text-black sm:p-2">20-40</div>
      <div class="overlfow-visible relative bg-ranking-4-6 p-1 text-black sm:p-2">40-60</div>
      <div class="overlfow-visible relative bg-ranking-6-8 p-1 text-black sm:p-2">60-80</div>
      <div class="overlfow-visible relative bg-ranking-8-10 p-1 sm:p-2">80-100</div>
    </div>
  </div>
</template>
<script setup>
const { $t } = useNuxtApp();
</script>

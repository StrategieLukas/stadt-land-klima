<template>
  <div class="mb-6 mr-2 flex max-w-2xl flex-col items-center justify-stretch gap-4 xs:flex-row sm:mr-0">
    <div>{{ $t("implementation_traffic_light") }}</div>
    <div class="grid grow grid-cols-5 text-center text-xs text-white sm:text-sm">
      <div class="overlfow-visible relative bg-ranking-0-2 p-1 sm:p-2">
        0-2
        <div class="absolute left-0 right-0 top-[100%] hidden overflow-visible text-center text-black xs:block">
          0-20
        </div>
      </div>
      <div class="overlfow-visible relative bg-ranking-2-4 p-1 text-black sm:p-2">
        &lt;2-4
        <div class="absolute left-0 right-0 top-[100%] hidden overflow-visible text-center text-black xs:block">
          &lt;20-40
        </div>
      </div>
      <div class="overlfow-visible relative bg-ranking-4-6 p-1 text-black sm:p-2">
        &lt;4-6
        <div class="absolute left-0 right-0 top-[100%] hidden overflow-visible text-center text-black xs:block">
          &lt;40-60
        </div>
      </div>
      <div class="overlfow-visible relative bg-ranking-6-8 p-1 text-black sm:p-2">
        &lt;6-8
        <div class="absolute left-0 right-0 top-[100%] hidden overflow-visible text-center text-black xs:block">
          &lt;60-80
        </div>
      </div>
      <div class="overlfow-visible relative bg-ranking-8-10 p-1 sm:p-2">
        &lt;8-10
        <div class="absolute left-0 right-0 top-[100%] hidden overflow-visible text-center text-black xs:block">
          &lt;80-100%
        </div>
      </div>
    </div>
  </div>
</template>
<script setup>
const { $t } = useNuxtApp();
</script>

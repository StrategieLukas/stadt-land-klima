<template>
  <div class="flex flex-col xs:flex-row items-center justify-stretch gap-4 mb-6 mr-2 sm:mr-0 max-w-2xl">
    <div>{{ $t('implementation_traffic_light') }}</div>
    <div class="grow grid grid-cols-5 text-white text-xs sm:text-sm text-center">
      <div class="bg-ranking-0-2 p-1 sm:p-2 relative overlfow-visible">
        0-2
        <div class="hidden xs:block absolute top-[100%] left-0 right-0 overflow-visible text-center text-black">
          0-20
        </div>
      </div>
      <div class="bg-ranking-2-4 p-1 sm:p-2 relative overlfow-visible text-black">
        &lt;2-4
        <div class="hidden xs:block absolute top-[100%] left-0 right-0 overflow-visible text-center text-black">
          &lt;20-40
        </div>
      </div>
      <div class="bg-ranking-4-6 p-1 sm:p-2 relative overlfow-visible text-black">
        &lt;4-6
        <div class="hidden xs:block absolute top-[100%] left-0 right-0 overflow-visible text-center text-black">
          &lt;40-60
        </div>
      </div>
      <div class="bg-ranking-6-8 p-1 sm:p-2 relative overlfow-visible text-black">
        &lt;6-8
        <div class="hidden xs:block absolute top-[100%] left-0 right-0 overflow-visible text-center text-black">
          &lt;60-80
        </div>
      </div>
      <div class="bg-ranking-8-10 p-1 sm:p-2 relative overlfow-visible">
        &lt;8-10
        <div class="hidden xs:block absolute top-[100%] left-0 right-0 overflow-visible text-center text-black">
          &lt;80-100%
        </div>
      </div>
    </div>
  </div>
</template>
<script setup>
const { $t } = useNuxtApp();
</script>

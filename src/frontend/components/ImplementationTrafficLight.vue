<template>
  <div
    :class="{ 'small_light gap-1': small, 'gap-4': !small }"
    class="mr-2 mb-6 flex max-w-2xl flex-col items-center justify-stretch xs:flex-row sm:mr-0"
  >
    <div class="grid grow grid-cols-5 text-center text-white" :class="{ 'text-xs sm:text-sm': !small }">
      <div class="overlfow-visible relative bg-rating-0 p-1" :class="{ 'sm:p-2': !small }">0-20</div>
      <div class="overlfow-visible relative bg-rating-1 p-1 text-black" :class="{ 'sm:p-2': !small }">20-40</div>
      <div class="overlfow-visible relative bg-rating-2 p-1 text-black" :class="{ 'sm:p-2': !small }">40-60</div>
      <div class="overlfow-visible relative bg-rating-3 p-1 text-black" :class="{ 'sm:p-2': !small }">60-80</div>
      <div class="overlfow-visible relative bg-rating-4 p-1" :class="{ 'sm:p-2': !small }">80-100</div>
    </div>
  </div>
</template>
<script setup lang="ts">
const _props = defineProps({
  small: {
    type: Boolean as PropType<boolean | undefined>,
    default: false,
  },
});

const { $t: _$t } = useNuxtApp();
</script>

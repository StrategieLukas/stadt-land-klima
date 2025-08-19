<template>
  <div :class="{'small_light gap-1': small,'gap-4': !small}" class="mb-6 mr-2 flex max-w-2xl flex-col items-center justify-stretch xs:flex-row sm:mr-0">
    <div class="grid grow grid-cols-5 text-center text-white" :class="{'text-xs sm:text-sm': !small}">
      <div class="overlfow-visible relative bg-ranking-0-2 p-1" :class="{'sm:p-2': !small}">0-20</div>
      <div class="overlfow-visible relative bg-ranking-2-4 p-1 text-black" :class="{'sm:p-2': !small}">20-40</div>
      <div class="overlfow-visible relative bg-ranking-4-6 p-1 text-black" :class="{'sm:p-2': !small}">40-60</div>
      <div class="overlfow-visible relative bg-ranking-6-8 p-1 text-black" :class="{'sm:p-2': !small}">60-80</div>
      <div class="overlfow-visible relative bg-ranking-8-10 p-1" :class="{'sm:p-2': !small}">80-100</div>
    </div>
  </div>
</template>
<script setup>
const { $t } = useNuxtApp();

const props = defineProps({
  small: {  // display traffic light smaller used for pdf export
    type: Boolean,
    default: false 
  }
});
</script>

<style scoped>
.small_light{
  font-size: 7px;
}
</style>

<template>
  <figure class="m-0 flex w-12 md:w-14 lg:w-18 flex-col items-center">
    <img :src="icon" class="h-auto w-12 md:w-14 lg:w-18 opacity-50" />
    <figcaption class="-mt-2 w-full">
      <div class="flex h-10 flex-row items-end gap-x-1">
        <div
          v-for="index in range(0, max)"
          :class="value >= index + 1 ? 'bg-light-blue' : 'bg-black bg-opacity-20'"
          :style="{ height: valuePercent(index + 1) + '%', width: 100 / max + '%' }"
        ></div>
      </div>
      <div class="text-center">
        {{ label }}
      </div>
    </figcaption>
  </figure>
</template>
<script setup>
import lodash from "lodash";
import { defineProps } from "vue";
const { range } = lodash;

const props = defineProps({
  icon: {
    type: String,
    required: true,
  },
  label: {
    type: String,
    required: true,
  },
  value: {
    type: Number,
    default: 0,
  },
  max: {
    type: Number,
    default: 5,
  },
});

function valuePercent(index) {
  return (index / props.max) * 100;
}
</script>

<template lang="">
  <div class="my-3 flex flex-row px-10 py-5" :class="{ 'shadow-list': isRanking }">
    <div class="relative flex">
      <svg
        id="Ebene_1"
        version="1.1"
        class="mt-2 h-14 w-14"
        color="red"
        xmlns="http://www.w3.org/2000/svg"
        xmlns:xlink="http://www.w3.org/1999/xlink"
        viewBox="0 0 47.5 62.2"
        style="enable-background: new 0 0 47.5 62.2  transform: rotate(45deg)"
        xml:space="preserve"
      >
        <g>
          <path
            fill="gray"
            d="M40.4,21.1c0-9.2-8-16.6-16.6-16.6S7.1,12,7.1,21.1c0,1.7-0.4,3.6,2.1,10c1.4,3.5,14.5,26.6,14.5,26.6s13.1-23,14.5-26.6
		C40.8,24.7,40.4,22.9,40.4,21.1z M23.8,28.7c-3.9,0-7.1-3.2-7.1-7.3c0-4,3.2-7.3,7.1-7.3c3.9,0,7.1,3.2,7.1,7.3
		C30.9,25.4,27.7,28.7,23.8,28.7z"
          />
        </g>
      </svg>

      <div class="absolute top-0 flex w-full items-center justify-center">
        <h2>
          {{ props.index }}
        </h2>
      </div>
    </div>
    <div class="grow">
      <div class="flex flex-row">
        <div class="grow">
          <h2>{{ kommune.name }}</h2>
          <p>{{ kommune.bundesland }}</p>
        </div>
        <div v-if="isRanking" class="flex items-center">Btton</div>
      </div>
      <progress-bar :score-total="kommune.score_total"></progress-bar>
    </div>
  </div>
</template>
<script setup>
const props = defineProps({
  kommune: {
    type: Object,
    required: true,
  },
  index: {
    type: Number,
    required: true,
  },
  isRanking: {
    type: Boolean,
    required: false,
    default: false,
  },
});
const kommune = props.kommune;
</script>
<style lang=""></style>

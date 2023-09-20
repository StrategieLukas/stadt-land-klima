<template lang="">
  <NuxtLink :to="'/kommunen/' + kommune.slug">
    <div class="px-10 py-5 my-3 shadow-list flex flex-row">
      <div class="flex items-center">
        <h2>
          {{ props.index }}
        </h2>
      </div>
      <div class="grow">
        <div class="flex flex-row">
          <div class="grow">
            <h2>{{ kommune.name }}</h2>
            <p>{{ kommune.bundesland }}</p>
          </div>
          <div class="flex items-center">Btton</div>
        </div>
        <progress-bar :score-total="kommune.score_total"></progress-bar>
      </div>
    </div>
  </NuxtLink>
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
});
const kommune = props.kommune;
</script>
<style lang=""></style>

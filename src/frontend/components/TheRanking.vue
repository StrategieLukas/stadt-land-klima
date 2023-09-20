<template lang="">
  <div class="flex flex-col my-3">
    The Ranking:

    <ul>
      <li v-for="(kommune, index) in kommunen" :key="kommune.id">
        <item-ranking :kommune="kommune" :index="index + 1"></item-ranking>
      </li>
    </ul>
  </div>
</template>
<script setup>
const props = defineProps({
  kommunen: {
    type: Array,
    required: true,
  },
});
const kommunen = props.kommunen;
console.log('kommunen:::', kommunen);
</script>
<style lang=""></style>

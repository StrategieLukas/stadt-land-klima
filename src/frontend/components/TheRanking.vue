<template lang="">
  <div m-5>
    The Ranking:
    <ul>
      <li v-for="kommune in kommunen" :key="kommune.id">
        <item-ranking :kommune="kommune"></item-ranking>
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

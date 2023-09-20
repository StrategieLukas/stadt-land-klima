<template lang="">
  <div m-5>
    The Ranking:
    <ul>
      <li v-for="kommune in kommunen" :key="kommune.id">
        <ItemRanking :kommune="kommune"></ItemRanking>
      </li>
    </ul>
  </div>
</template>
<script setup>
const props = defineProps(['kommunen']);
const { kommunen } = props;
console.log(kommunen);
</script>
<style lang=""></style>

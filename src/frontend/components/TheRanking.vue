<template lang="">
  <div class="my-3 flex flex-col">
    <ul>
      <li v-for="(kommune, index) in kommunen" :key="kommune.id">
        <NuxtLink :to="'/kommunen/' + kommune.slug">
          <item-ranking :kommune="kommune" :index="index + 1" :is-ranking="true"></item-ranking>
        </NuxtLink>
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
console.log("kommunen:::", kommunen);
</script>
<style lang=""></style>

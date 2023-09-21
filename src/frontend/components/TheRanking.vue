<template lang="">
  <div class="my-3 flex flex-col">
    The Ranking:

    <ul>
      <li v-for="(municipality, index) in municipalities" :key="municipality.id">
        <item-ranking :municipality="municipality" :index="index + 1"></item-ranking>
      </li>
    </ul>
  </div>
</template>
<script setup>
const props = defineProps({
  municipalities: {
    type: Array,
    required: true,
  },
});
const municipalities = props.municipalities;
console.log("municipalities:::", municipalities);
</script>
<style lang=""></style>

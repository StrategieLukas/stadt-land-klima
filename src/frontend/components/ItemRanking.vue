<template lang="">
  <div>
    ITEM IN RANKING
    <p>{{ kommune.score_total }}</p>
    <p>{{ kommune.name }}</p>
    <progress-bar-city></progress-bar-city>
    <progress class="progress progress-success w-56" :value="kommune.score_total" max="100"></progress>
    <detail-city-ranking></detail-city-ranking>
  </div>
</template>
<script setup>
const props = defineProps(['kommune']);
const { kommune } = props;
</script>
<style lang=""></style>

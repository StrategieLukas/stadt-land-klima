<template lang="">
  <div>
    <h2>{{ kommune.name }}</h2>
    <p>{{ kommune.b }}</p>
    <progress-bar-city></progress-bar-city>
    <progress class="progress progress-success w-56" :value="kommune.score_total" max="100"></progress>
  </div>
</template>
<script setup>
const props = defineProps({
  kommune: {
    type: Object,
    required: true,
  },
});
const kommune = props.kommune;
</script>
<style lang=""></style>

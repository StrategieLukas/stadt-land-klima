<template lang="">
  <div>
    <progress class="progress progress-success" :value="props.scoreTotal" max="100"></progress>
  </div>
</template>
<script setup>
const props = defineProps({
  scoreTotal: {
    type: Number,
    required: true,
  },
});
</script>
<style lang=""></style>

<template lang="">
  <div>
    <div tabindex="0" class="collapse-arrow collapse shadow-list">
      <div class="collapse-title text-xl font-medium">{{ measuresAssessments[0].massnahme.sektor }}</div>
      <div class="collapse-content">
        <ul>
          <li v-for="measuresAssessment in measuresAssessments" :key="measuresAssessment.id">
            {{ measuresAssessment.massnahme.name }}
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
<script setup>
const props = defineProps({
  measuresAssessments: {
    type: Array,
    required: true,
  },
});
const measuresAssessments = props.measuresAssessments;
console.log("collabse", measuresAssessments);
</script>
<style lang=""></style>

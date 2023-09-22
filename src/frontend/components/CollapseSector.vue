<template lang="">
  <div>
    <div tabindex="0" class="collapse-arrow collapse shadow-list">
      <div class="collapse-title text-xl font-medium">
        <div>
          <img :src="sectorImages[ratingsSector[0].measure.sector]" alt="" class="w-24 h-auto opacity-50" />
            {{ $t(`measure_sectors.${sector}.title`) }}
          </div>
        </div>
      <div class="collapse-content">
        <ul>
          <li v-for="measuresAssessment in ratingsSector" :key="measuresAssessment.id">
            {{ measuresAssessment.measure.name }}
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
<script setup>
import sectorImages from '../../shared/sectorImages.js';
const {$t } = useNuxtApp();

const props = defineProps({
  ratingsSector: {
    type: Array,
    required: true,
  },
});
const ratingsSector = props.ratingsSector;
const sector = ratingsSector[0].measure.sector
console.log("collabse", ratingsSector);
</script>
<style lang=""></style>

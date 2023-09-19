<template lang="">
    <div class="bg-white">
      Polar Chart:
      <PolarArea
      :data="chartData"
      :options="chartOptions"
    />
    </div>
</template>
<script setup>
import { PolarArea } from 'vue-chartjs'

const props = defineProps(['subScores']);
//const subScoreArray = createSubScoreArray(props.subScores);

const chartData = ref({
  
  datasets: [{
    label: 'My First Dataset',
    data: [0.5,1,2,3,4,5],
    backgroundColor: [
      'rgba(255, 99, 132,0.5)',
      'rgb(75, 192, 192, 0.5)',
      'rgb(255, 205, 86 , 0.5)',
      'rgb(201, 203, 207, 0.5)',
      'rgb(54, 162, 235, 0.5)'
    ],
    borderWidth: 0,
  }]
})
const chartOptions = ref({
  responsive: false,
  maintainAspectRatio: false,
  animation:{animateScale:true}
   	
})
    
function createSubScoreArray(subScoreObject) {
    let temp = []
    for (const [key, value] of Object.entries(subScoreObject)) {
        if (key.includes('score')) {
            temp[key] = value;
        }
    }
    return temp;
};
</script>
<style lang="">
    
</style>
<template lang="">
  <div class="bg-white">
    Polar Chart:
    <PolarArea :data="chartData" :options="chartOptions" />
  </div>
</template>
<script setup>
import { PolarArea } from 'vue-chartjs';
const chartData = ref({
  labels: ['Red', 'Green', 'Yellow', 'Grey', 'Blue'],
  datasets: [
    {
      label: 'My First Dataset',
      data: [10, 9, 0, 9, 8],
      backgroundColor: [
        'rgba(255, 99, 132,0.5)',
        'rgb(75, 192, 192, 0.5)',
        'rgb(255, 205, 86 , 0.5)',
        'rgb(201, 203, 207, 0.5)',
        'rgb(54, 162, 235, 0.5)',
      ],
      borderWidth: 0,
    },
  ],
});
const chartOptions = ref({
  responsive: false,
  maintainAspectRatio: false,
  animation: { animateScale: true },
});
</script>
<style lang=""></style>

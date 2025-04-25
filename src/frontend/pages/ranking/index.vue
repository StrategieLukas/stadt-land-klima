<script setup>
import { ref } from 'vue'

// Toggle between "grossstaedte" and "gemeinden"
const selected = ref('city')

import citySelected from '~/assets/images/city-light.svg'
import cityNotSelected from '~/assets/images/city-dark.svg'
import townSelected from '~/assets/images/town-light.svg'
import townNotSelected from '~/assets/images/town-dark.svg'

// todo - fetch all municipalities and then split them locally

</script>

<template>
  <div class="flex flex-col items-center">
    <!-- Date -->
    <p class="text-sm text-gray-500 mb-4">
      Letzte Aktualisierung: 14.09.2023, 10:12
    </p>

    <!-- Button row -->
    <div class="flex gap-2 mb-1">
      <!-- Großstädte -->
      <img
        :src="selected === 'city'
          ? citySelected
          : cityNotSelected"
        alt="Großstädte"
        class="cursor-pointer h-10"
        @click="selected = 'city'"
      />

      <!-- Städte und Gemeinden -->
      <img
        :src="selected === 'town'
          ? townSelected
          : townNotSelected"
        alt="Städte und Gemeinden"
        class="cursor-pointer h-10"
        @click="selected = 'town'"
      />
    </div>


    <!-- Conditional Content -->
    <div v-if="selected === 'city'">
      <!-- Replace with actual Großstädte content -->
      <div class="p-4 bg-gray-100 rounded-xl w-full max-w-2xl text-center">
        Großstädte (>100.000 EW)
      </div>
    </div>
    <div v-else>
      <!-- Replace with actual Gemeinden content -->
      <div class="p-4 bg-gray-100 rounded-xl w-full max-w-2xl text-center">
        Gemeinden und Städte (100.000 EW)
      </div>
    </div>
  </div>
</template>

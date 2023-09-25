<template lang="">
  <div class="flex flex-col">
    <ul>
      <li v-for="(municipality, index) in municipalities" :key="municipality.id">
        <NuxtLink :to="`/municipalities/${municipality.slug}`">
          <item-ranking
            :municipality="municipality"
            :is-ranking="true"
          />
        </NuxtLink>
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
</script>
<style lang=""></style>

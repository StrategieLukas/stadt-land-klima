<template lang="">
  <div class="flex flex-col">
    <ul>
      <li v-for="municipality in municipalities" :key="municipality.id">
        <NuxtLinkLocale :to="`/municipalities/${municipality.slug}`">
          <item-ranking :municipality="municipality" :is-ranking="true" />
        </NuxtLinkLocale>
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

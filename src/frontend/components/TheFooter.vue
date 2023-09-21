<template lang="">
  <footer class="bg-light-green px-2 py-4 text-base-100">
    <div class="mx-auto max-w-screen-xl w-full">
      <h3 class="text-md">Sitemap</h3>

      <ul class="grid grid-2-cols">
        <li v-for="page in pages">
          <NuxtLink :to="page.slug" class="btn btn-link pl-0 text-base-100 text-md normal-case">
            {{ page.name }}
          </NuxtLink>
        </li>
      </ul>
    </div>
  </footer>
</template>
<script setup>
import { defineProps } from 'vue';
const props = defineProps(['pages']);
</script>
<style lang=""></style>

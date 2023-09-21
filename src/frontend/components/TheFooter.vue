<template lang="">
  <footer class="bg-light-green px-2 py-4 text-base-100">
    <div class="mx-auto w-full max-w-screen-xl">
      <h3 class="text-md">Sitemap</h3>

      <ul class="grid-2-cols grid">
        <li v-for="page in pages" :key="page.id">
          <NuxtLink :to="page.slug" class="text-md btn btn-link pl-0 normal-case text-base-100">
            {{ page.name }}
          </NuxtLink>
        </li>
      </ul>
    </div>
  </footer>
</template>
<script setup>
import { defineProps } from "vue";
const props = defineProps(["pages"]);
</script>
<style lang=""></style>

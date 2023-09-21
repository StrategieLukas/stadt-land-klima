<template lang="">
  <nav class="drawer-side">
    <label for="page-drawer" class="drawer-overlay"></label>
    <ul tabindex="0" class="bg-light-green menu min-h-full w-80 p-4">
      <li>
        <NuxtLink to="/" class="text-md btn btn-ghost normal-case text-base-100">Home</NuxtLink>
      </li>
      <li>
        <NuxtLink to="/kommunen" class="text-md btn btn-ghost normal-case text-base-100"> Staedte und Kreise</NuxtLink>
      </li>
      <li>
        <NuxtLink to="/massnahmen" class="text-md btn btn-ghost normal-case text-base-100"> Maßnahmen</NuxtLink>
      </li>
      <li v-for="page in pages" :key="page.id">
        <NuxtLink :to="page.slug" class="text-md btn btn-ghost normal-case text-base-100">
          {{ page.name }}
        </NuxtLink>
      </li>
    </ul>
  </nav>
</template>
<script setup>
import { defineProps } from "vue";
const props = defineProps(["pages"]);
</script>
<style lang=""></style>

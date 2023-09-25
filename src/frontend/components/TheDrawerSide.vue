<template lang="">
  <nav class="drawer-side">
    <label for="page-drawer" class="drawer-overlay"></label>
    <ul tabindex="0" class="bg-light-green menu min-h-full w-80 p-4">
      <li>
        <NuxtLink to="/" class="text-md btn btn-ghost normal-case text-black">{{ $t('home.nav_label') }}</NuxtLink>
      </li>
      <li>
        <NuxtLink to="/municipalities" class="text-md btn btn-ghost normal-case text-black">{{ $t('municipalities.nav_label') }}</NuxtLink>
      </li>
      <li>
        <NuxtLink to="/measures" class="text-md btn btn-ghost normal-case text-black">{{ $t('measures.nav_label') }}</NuxtLink>
      </li>
      <li v-for="page in pages" :key="page.id">
        <NuxtLink :to="page.slug" class="text-md btn btn-ghost normal-case text-black">
          {{ page.name }}
        </NuxtLink>
      </li>
    </ul>
  </nav>
</template>
<script setup>
import { defineProps } from "vue";
const { $t } = useNuxtApp();
const props = defineProps(["pages"]);
</script>
<style lang=""></style>

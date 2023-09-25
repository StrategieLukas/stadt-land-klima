<template lang="">
  <footer class="bg-light-green px-2 py-4 text-black">
    <div class="mx-auto w-full max-w-screen-xl">
      <h3 class="text-md">{{ $t('sitemap') }}</h3>

      <ul class="grid-2-cols grid">
        <li v-for="page in pages" :key="page.id">
          <NuxtLink :to="page.slug" class="text-md btn btn-link pl-0 normal-case text-black">
            {{ page.name }}
          </NuxtLink>
        </li>
      </ul>
    </div>
  </footer>
</template>
<script setup>
import { defineProps } from "vue";
const { $t } = useNuxtApp();
const props = defineProps(["pages"]);
</script>
<style lang=""></style>

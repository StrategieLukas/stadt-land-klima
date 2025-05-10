<template lang="">
  <footer class="bg-light-green px-2 py-4 text-black">
    <div class="mx-auto w-full max-w-screen-xl">

      <ul tabindex="0" class="menu min-h-full w-80 bg-light-green font-semibold text-left text-white">
        <li v-for="page in pages" :key="page.id" class="w-full">
          <NuxtLink
            :to="'/' + page.slug"
            class="text-md"
          >
            <span class="text-lg">→</span> {{ page.name }}
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

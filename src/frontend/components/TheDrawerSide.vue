<template>
  <nav class="drawer-side z-20">
    <label for="page-drawer" class="drawer-overlay"></label>
    <ul tabindex="0" class="menu min-h-full w-80 bg-light-green p-4">
      <li v-for="page in pages" :key="page.id">
        <NuxtLink :to="'/' + page.slug" class="text-md btn btn-ghost normal-case text-black" @click="closeDrawer">
          {{ page.name }}
        </NuxtLink>
      </li>
      <li>
        <a href="/backend" class="text-md btn btn-ghost normal-case text-black" @click="closeDrawer"> Login </a>
      </li>
    </ul>
  </nav>
</template>

<script setup>

import { defineProps } from "vue";
const { $t } = useNuxtApp();
const props = defineProps(["pages"]);

function closeDrawer() {
  document.getElementById("page-drawer-toggle").click();
}

</script>

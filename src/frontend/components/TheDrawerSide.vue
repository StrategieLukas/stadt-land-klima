<template>
  <nav class="drawer-side z-20">
    <label for="page-drawer" class="drawer-overlay" @click="closeDrawer"></label>
    <ul tabindex="0" class="menu min-h-full w-80 bg-light-green font-semibold text-left text-white">
      
      <li v-for="page in pages" :key="page.id" class="w-full">
        <NuxtLink
          :to="'/' + page.slug"
          class="text-md"
          @click="closeDrawer"
        >
          <span class="text-lg">→</span> {{ page.name }}
        </NuxtLink>
      </li>

      <!-- Last two elements not NuxtLinks because they reference different applications -->

      <li class="pt-4 border-t border-white mt-4 w-full">
        <a
          href="/backend"
          class="text-md bg-orange"
          @click="closeDrawer"
        >
          <span class="text-lg">→</span>{{ $t('generic.log_in') }}
        </a>
      </li>

      <li class="pt-4 w-full">
        <a
          href="https://www.betterplace.org/de/projects/157241-stadt-land-klima-bringe-kommunalen-klimaschutz-voran"
          class="text-md bg-orange"
          @click="closeDrawer"
        >
          <span class="text-lg">→</span>{{ $t('donate.label') }}
          <img src="~/assets/icons/icon_hand_holding_heart.svg"/>
        </a>
      </li>

    </ul>
  </nav>
</template>

<script setup>

import { defineProps } from "vue";
const { $t } = useNuxtApp();
const props = defineProps(["pages"]);

function closeDrawer() {
  const drawerCheckbox = document.getElementById('page-drawer');
  if (drawerCheckbox) {
    drawerCheckbox.checked = false;
  }
}

</script>

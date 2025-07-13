<template>
  <nav class="drawer-side z-20">
    <label for="page-drawer" class="drawer-overlay"></label>
    <ul tabindex="0" class="menu min-h-full w-80 bg-light-green font-semibold text-left text-white">

      <li v-for="page in pages" :key="page.id" class="w-full">
        <NuxtLinkLocale
          :to="'/' + page.slug"
          class="text-md"
          @click="closeDrawer"
        >
          <span class="text-lg">→</span> {{ page.translations[0].name }}
        </NuxtLinkLocale>
      </li>

      <!-- Last two elements not NuxtLinks because they reference different applications -->

      <li class="pt-4 border-t border-white mt-4 w-full">
        <a
          href="/backend"
          class="text-md bg-orange"
          @click="closeDrawer"
        >
          <span class="text-lg">→</span>{{ t('generic.log_in') }}
        </a>
      </li>

      <li class="pt-4 w-full">
        <a
          href="https://spenden.twingle.de/together-for-future-e-v/stadt-land-klima/tw6613dcb5d0a0d/page"
          class="text-md bg-orange"
          @click="closeDrawer"
        >
          <span class="text-lg">→</span>{{ t('donate.label') }}
          <img src="~/assets/icons/icon_hand_holding_heart.svg"/>
        </a>
      </li>

      <li class="w-full pt-4">
        <LanguageSelectorMobile />
      </li>

    </ul>
  </nav>
</template>


<script setup>

import { defineProps } from "vue";
const { t } = useI18n();
const props = defineProps(["pages"]);

function closeDrawer() {
  document.getElementById("page-drawer-toggle").click();
}

</script>

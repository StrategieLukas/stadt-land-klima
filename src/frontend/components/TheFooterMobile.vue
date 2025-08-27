<template lang="">
  <div class="max-w-screen-xl mx-auto text-center mb-8">
    <NuxtLink v-if="shouldDisplayOnboardingLink" to="/mitmachen">
      <img src="~/assets/icons/icon_klimachecker.svg" class="m-4" :alt="$t('logo.alt')" />
    </NuxtLink>
    <p class="mb-4">
      {{ $t('generic.social_media.support_by_sharing') }}
    </p>
    <div class="flex justify-center items-center gap-6">
      <a href="https://www.instagram.com/stadt.land.klima/" target="_blank" aria-label="Instagram">
        <img src="~/assets/icons/icon_instagram.svg" alt="Instagram" class="h-12 w-12" />
      </a>
      <a href="https://www.linkedin.com/company/stadt-land-klima/" target="_blank" aria-label="LinkedIn">
        <img src="~/assets/icons/icon_linkedin.svg" alt="LinkedIn" class="h-12 w-12" />
      </a>
    </div>
  </div>
  
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
const route = useRoute();
const shouldDisplayOnboardingLink = !(route.path === "/" || route.path.includes("mitmachen"))
</script>
<style lang=""></style>

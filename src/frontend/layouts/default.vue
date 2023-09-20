<template>
  <div class="drawer text-neutral bg-gray-200">
    <input id="page-drawer" type="checkbox" class="drawer-toggle" />
    <div class="drawer-content h-full min-h-screen flex flex-col items-stretch">
      <the-drawer-side-toggle />
      <the-header />
      <main class="flex flex-col grow px-2 bg-white">
        <div class="mx-auto max-w-screen-xl w-full">
          <slot />
        </div>
      </main>
      <the-footer :pages="pages.filter((page) => { return includes(page.menus, 'footer') })" />
    </div>
    <the-drawer-side :pages="pages.filter((page) => { return includes(page.menus, 'main') })" />
  </div>
</template>
<script setup>
import { includes } from 'lodash';
const { $directus, $readItems } = useNuxtApp();

const { data: pages } = await useAsyncData('pages', () => {
  return $directus.request($readItems('pages', {limit: -1}));
});
console.log(pages);
</script>

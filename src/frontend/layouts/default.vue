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
      <the-footer :pages="pages"></the-footer>
    </div>
    <the-drawer-side />
  </div>
</template>
<script setup>
const { $directus, $readItems } = useNuxtApp();

const { data: pages } = await useAsyncData('pages', () => {
  return $directus.request($readItems('pages', {limit: -1}));
});
</script>

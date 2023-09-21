<template>
  <div class="flex">
    <div class="drawer bg-gray-200 text-neutral">
      <input id="page-drawer" type="checkbox" class="drawer-toggle" />
      <div class="drawer-content flex h-full min-h-screen flex-col items-stretch">
        <the-drawer-side-toggle />
        <!-- <the-header /> -->
        <main class="flex grow flex-col bg-white px-2 py-4">
          <div class="mx-auto w-full max-w-screen-xl">
            <slot />
          </div>
        </main>
        <the-footer
          :pages="
            pages.filter((page) => {
              return includes(page.menus, 'footer');
            })
          "
        />
      </div>
      <the-drawer-side
        :pages="
          pages.filter((page) => {
            return includes(page.menus, 'main');
          })
        "
      />
    </div>
  </div>
</template>
<script setup>
import { includes } from "lodash";
const { $directus, $readItems } = useNuxtApp();

const { data: pages } = await useAsyncData("pages", () => {
  return $directus.request($readItems("pages", { limit: -1 }));
});
console.log(pages);
</script>

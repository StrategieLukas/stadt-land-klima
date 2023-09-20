<template>
  <div class="drawer text-neutral bg-white">
    <input id="page-drawer" type="checkbox" class="drawer-toggle" />
    <div class="drawer-content h-full min-h-screen flex flex-col items-stretch">
      <the-nav-bar></the-nav-bar>
      <the-header></the-header>
      <main class="flex flex-col pt-20 grow">
        <slot />
      </main>
      <the-footer :pages="pages"></the-footer>
    </div>
    <nav class="drawer-side">
      <label for="page-drawer" class="drawer-overlay"></label>
      <ul tabindex="0" class="menu p-4 w-80 min-h-full bg-light-green">
        <li>
          <NuxtLink to="/" class="btn btn-ghost text-base-100 text-md normal-case">Home</NuxtLink>
        </li>
        <li>
          <NuxtLink to="/kommunen" class="btn btn-ghost text-base-100 text-md normal-case"> Staedte und Kreise</NuxtLink>
        </li>
        <li>
          <NuxtLink to="/massnahmen" class="btn btn-ghost text-base-100 text-md normal-case"> Maßnahmen</NuxtLink>
        </li>
      </ul>
    </nav>
  </div>
</template>
<script setup>
const { $directus, $readItems } = useNuxtApp();

const { data: pages } = await useAsyncData('pages', () => {
  return $directus.request($readItems('pages', {limit: -1}));
});
</script>

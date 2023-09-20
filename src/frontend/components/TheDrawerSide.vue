<template lang="">
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
</template>
<script setup></script>
<style lang=""></style>

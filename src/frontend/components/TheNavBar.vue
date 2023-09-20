<template lang="">
  <nav class="w-full fixed top-0 left-0 right-0 navbar bg-white shadow">
    <div class="flex-none lg:hidden absolute top-0 right-0">
      <label for="page-drawer" class="btn btn-square rounded-t-none rounded-br-none border-none bg-light-green text-white">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="inline-block w-6 h-6 stroke-current"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
      </label>
    </div>
    <div class="max-w-screen-xl w-full mx-auto flex items-center justify-between">
      <div class="flex-1 mr-auto">Klima2035</div>
      <div class="flex-none hidden lg:block ml-auto">
        <ul tabindex="0" class="menu menu-horizontal">
          <!-- Navbar menu content here -->
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
      </div>
    </div>
  </nav>
</template>
<script setup></script>
<style lang=""></style>

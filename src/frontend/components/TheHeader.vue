<template lang="">
  <header class="mb-3 bg-white px-2 py-4 shadow">
    <div class="mx-auto flex w-full max-w-screen-xl flex-col items-center gap-x-8 lg:flex-row lg:items-end">
      <NuxtLink to="/">
        <img src="~/assets/images/StadtLandKlima-Logo.svg" class="h-32 w-auto" alt="StadtLandKlima - Land und Stadt Ranking" />
      </NuxtLink>
      <form class="mb-1">
        <div class="form-control">
          <label for="search-input" class="label"> Suche nach PLZ oder Ort </label>
          <input
            id="search-input"
            class="input input-bordered input-primary w-64 sm:w-96 max-w-full bg-white"
            name="q"
            type="text"
          />
        </div>
      </form>
    </div>
  </header>
</template>
<script setup></script>
<style lang=""></style>

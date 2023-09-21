<template lang="">
  <header class="bg-white shadow py-4 px-2 mb-3">
    <div class="mx-auto w-full max-w-screen-xl flex flex-col lg:flex-row items-center lg:items-end gap-x-8">
      <NuxtLink to="/">
        <img
          src="~/assets/images/Signet-Klima2035.svg"
          class="h-32 w-auto "
          alt="Klima2035 - Land und Stadt Ranking"
        />
      </NuxtLink>
      <form class="mb-1">
        <div class="form-control">
          <label
            for="search-input"
            class="label"
          >
            Suche nach PLZ oder Ort
          </label>
          <input
            id="search-input"
            class="input input-bordered input-primary bg-white max-w-full w-96"
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

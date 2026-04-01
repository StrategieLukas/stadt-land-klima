<template>
  <header
    class="sticky top-0 w-full z-50 backdrop-blur-md border-b border-gray-300 transition-[box-shadow] duration-300"
    style="background: rgba(255,255,255,0.82)"
    :class="scrolled ? 'shadow-lg' : ''"
  >
    <div
      class="grid grid-cols-[1fr_auto_1fr] items-center gap-4 mx-auto w-full max-w-screen-xl px-3 transition-[padding] duration-300 ease-in-out"
      :class="scrolled ? 'py-1' : 'py-2'"
    >
      <!-- Left: Logo -->
      <NuxtLink
        to="/"
        class="flex-shrink-0 justify-self-start overflow-hidden transition-[height] duration-300 ease-in-out"
        :class="scrolled ? 'h-10' : 'h-14'"
      >
        <img
          src="~/assets/images/Stadt-Land-Klima-Logo.svg"
          class="h-full w-auto"
          :alt="$t('logo.alt')"
        />
      </NuxtLink>

      <!-- Centre: empty -->
      <div></div>

      <!-- Right: Search button -->
      <div class="flex items-center gap-2 flex-shrink-0 justify-self-end">
        <button
          @click="open()"
          class="flex items-center justify-center h-9 w-9 flex-shrink-0 rounded-full border border-gray-200 bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          :aria-label="$t('generic.search')"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
        </button>
      </div>
    </div>
  </header>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useSearchPalette } from '~/composables/useSearchPalette.js'

const { $t } = useNuxtApp()
const { open } = useSearchPalette()

const scrolled = ref(false)

function onScroll() {
  scrolled.value = window.scrollY > 8
}

onMounted(() => window.addEventListener('scroll', onScroll, { passive: true }))
onUnmounted(() => window.removeEventListener('scroll', onScroll))
</script>
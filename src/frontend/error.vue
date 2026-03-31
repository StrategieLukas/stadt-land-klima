<template>
  <NuxtLayout name="default">
    <div class="flex flex-col items-center justify-center py-16 text-center px-6">

      <!-- Monstrous 404 number -->
      <div
        class="font-black leading-none select-none w-full"
        style="
          font-size: clamp(12rem, 40vw, 24rem);
          color: transparent;
          -webkit-text-stroke: 4px #AFCA0B;
          line-height: 1;
        "
      >
        {{ error?.statusCode ?? 404 }}
      </div>

      <!-- Headline -->
      <h1 class="mt-6 text-3xl font-bold text-gray-800">
        <template v-if="is404">Seite nicht gefunden</template>
        <template v-else>Etwas ist schiefgelaufen</template>
      </h1>

      <!-- Description -->
      <p class="mt-3 text-gray-500 text-base leading-relaxed max-w-md">
        <template v-if="is404">
          Die gesuchte Seite existiert leider nicht oder wurde verschoben.
        </template>
        <template v-else>
          Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es später noch einmal.
        </template>
      </p>

      <!-- Dev error message -->
      <p v-if="error?.message && isDev" class="mt-3 text-xs font-mono text-red bg-red/5 rounded px-3 py-2 text-left break-all max-w-lg">
        {{ error.message }}
      </p>

      <!-- CTAs -->
      <div class="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
        <NuxtLink
          to="/"
          class="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-full bg-olive-green text-white text-sm font-semibold hover:bg-green transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          Zur Startseite
        </NuxtLink>
        <button
          class="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-full border-2 border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-100 transition-colors"
          @click="handleError"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Zurück
        </button>
      </div>

    </div>
  </NuxtLayout>
</template>

<script setup>
import { computed } from 'vue'
import { useError, clearError } from '#app'

const error = useError()

const isDev = process.env.NODE_ENV === 'development'

const is404 = computed(() => error.value?.statusCode === 404)

function handleError() {
  clearError({ redirect: '/' })
}
</script>

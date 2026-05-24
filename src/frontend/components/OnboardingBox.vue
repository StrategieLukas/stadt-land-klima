<template>
  <div class="flex flex-col bg-white shadow-xl border-2 p-4 h-36" style="border-color: #339737;">
    <div class="flex items-center gap-3 flex-1 min-h-0">
      <img v-if="avatarSrc" :src="avatarSrc" :alt="name"
           class="w-12 h-12 rounded-full flex-shrink-0 object-cover" />
      <div v-else class="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0" style="background-color: #339737;">
        <svg class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
          <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
      <div class="min-w-0">
        <h2 class="text-base font-bold font-heading leading-tight" style="color: #339737;">{{ $t("onboarding.title") }}</h2>
        <p class="text-xs text-gray-500 mt-0.5 line-clamp-2">{{ $t("onboarding.book_appointment.long") }}</p>
      </div>
    </div>
    <button
      @click="openCal"
      class="mt-2 inline-block w-full text-center px-3 py-2 text-white text-sm font-semibold rounded-md hover:opacity-90 transition-opacity"
      style="background-color: #339737;"
    >
      {{ $t("onboarding.book_appointment.short") }} →
    </button>
  </div>
  <!-- Teleport overlay -->
  <teleport to="body">
    <transition name="fade">
      <div
        v-if="showCal"
        class="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center"
        @click.self="closeCal"
      >
        <!-- Now sized to viewport -->
        <div id="my-cal-inline-onboarding" class="w-[90vw] h-[90vh]"></div>

        <button
          @click="closeCal"
          class="absolute top-3 right-3 text-white text-2xl"
          aria-label="Close"
        >
          ✕
        </button>
      </div>
    </transition>
  </teleport>

</template>

<script setup>
import { ref, nextTick, watch } from 'vue'
const { $t } = useNuxtApp()

defineProps({
  avatarSrc: { type: String, default: '' },
  name: { type: String },
})

const showCal = ref(false)
let renderedOnce = false

async function openCal() {
  showCal.value = true
  await nextTick()

  const container = document.getElementById("my-cal-inline-onboarding")
  if (container) container.innerHTML = "" // clear old iframe

  if (window?.Cal?.ns?.onboarding) {
    window.Cal.ns.onboarding("inline", {
      elementOrSelector: "#my-cal-inline-onboarding",
      config: { layout: "month_view" },
      calLink: "stadt-land-klima/onboarding",
    })
  }
}

function closeCal() {
  showCal.value = false
}

// Scroll lock for body
watch(showCal, (open) => {
  document.body.style.overflow = open ? 'hidden' : ''
})
</script>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity .2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>

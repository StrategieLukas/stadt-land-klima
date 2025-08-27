<template>
  <div class="card bg-white shadow-xl rounded-none overflow-hidden border-2 border-green p-4 h-52 max-w-md">
    <!-- Title -->
    <h2 class="text-2xl font-bold text-green text-center mb-4 mt-0">
      {{ $t("onboarding.title") }}
    </h2>

    <!-- Avatar + Text row -->
    <div class="flex items-center gap-6 ">
      <!-- Avatar -->
      <div class="avatar">
        <div class="w-24 h-24 rounded-full flex-shrink-0">
          <img
            v-if="avatarSrc"
            :src="avatarSrc"
            :alt="name"
            class="w-full h-full object-cover rounded-full mt-0"
          />
        </div>
      </div>

      <!-- Text -->
      <p class="text-base">
        {{ $t("onboarding.book_appointment.long") }}
      </p>
    </div>

    <!-- Book Button -->
    <div class="flex justify-center">
      <button
        @click="openCal"
        class="flex items-center gap-2 text-green hover:underline"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <span class="text-lg font-semibold">
          {{ $t("onboarding.book_appointment.short") }}
        </span>
      </button>
    </div>
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

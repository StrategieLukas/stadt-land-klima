<template>
  <div class="flex h-36 flex-col border-2 bg-white p-4 shadow-xl" style="border-color: #339737">
    <div class="flex min-h-0 flex-1 items-center gap-3">
      <img v-if="avatarSrc" :src="avatarSrc" :alt="name" class="h-12 w-12 shrink-0 rounded-full object-cover" />
      <div
        v-else
        class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
        style="background-color: #339737"
      >
        <svg class="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </div>
      <div class="min-w-0">
        <h2 class="font-heading text-base leading-tight font-bold" style="color: #339737">
          {{ $t("onboarding.title") }}
        </h2>
        <p class="mt-0.5 line-clamp-2 text-xs text-gray-500">{{ $t("onboarding.book_appointment.long") }}</p>
      </div>
    </div>
    <button
      class="mt-2 inline-block w-full rounded-md px-3 py-2 text-center text-sm font-semibold text-white transition-opacity hover:opacity-90"
      style="background-color: #339737"
      @click="openCal"
    >
      {{ $t("onboarding.book_appointment.short") }} →
    </button>
  </div>
  <!-- Teleport overlay -->
  <teleport to="body">
    <transition name="fade">
      <div
        v-if="showCal"
        class="fixed inset-0 z-9999 flex items-center justify-center bg-black/60"
        @click.self="closeCal"
      >
        <!-- Now sized to viewport -->
        <div class="h-[90vh] w-[90vw]"><CalBookingFrame /></div>

        <button class="absolute top-3 right-3 text-2xl text-white" :aria-label="$t('generic.close')" @click="closeCal">
          ✕
        </button>
      </div>
    </transition>
  </teleport>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
const { $t } = useNuxtApp();

defineProps({
  avatarSrc: { type: String as PropType<string | undefined>, default: "" },
  name: { type: String as PropType<string | undefined> },
});

const showCal = ref(false);
const _renderedOnce = false;

function openCal() {
  showCal.value = true;
}

function closeCal() {
  showCal.value = false;
}

// Scroll lock for body
watch(showCal, (open) => {
  document.body.style.overflow = open ? "hidden" : "";
});
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>

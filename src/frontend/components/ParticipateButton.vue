<template>
  <div>
    <button
      @click="openRegisterModal"
      class="inline-flex items-center px-6 py-3 bg-orange text-white font-bold rounded-md hover:brightness-110 transition-all shadow-md"
    >
      <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
      </svg>
      {{ $t('auth.participate_button') }}
    </button>
    
    <!-- Register Modal -->
    <AuthRegisterModal
      :is-open="isRegisterModalOpen"
      :prefilled-municipality="prefilledMunicipality"
      @close="isRegisterModalOpen = false"
      @success="handleRegisterSuccess"
      @switch-to-login="switchToLogin"
    />
    
    <!-- Login Modal (if user switches from register) -->
    <AuthLoginModal
      :is-open="isLoginModalOpen"
      @close="isLoginModalOpen = false"
      @success="handleLoginSuccess"
      @switch-to-register="switchToRegister"
    />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';

const { $t } = useNuxtApp();

// Props
const props = defineProps({
  municipality: {
    type: Object,
    required: true
    // Expected: { ars: string, name: string, prefix?: string, population?: number }
  }
});

// State
const isRegisterModalOpen = ref(false);
const isLoginModalOpen = ref(false);

// Computed prefilled municipality for the register modal
const prefilledMunicipality = computed(() => {
  if (!props.municipality) return null;
  
  return {
    ars: props.municipality.ars,
    name: props.municipality.name,
    prefix: props.municipality.prefix || props.municipality.municipality_type,
    population: props.municipality.population
  };
});

// Methods
function openRegisterModal() {
  isRegisterModalOpen.value = true;
}

function handleRegisterSuccess() {
  isRegisterModalOpen.value = false;
}

function handleLoginSuccess() {
  isLoginModalOpen.value = false;
}

function switchToLogin() {
  isRegisterModalOpen.value = false;
  isLoginModalOpen.value = true;
}

function switchToRegister() {
  isLoginModalOpen.value = false;
  isRegisterModalOpen.value = true;
}
</script>

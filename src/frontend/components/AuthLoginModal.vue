<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="isOpen"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
        @click.self="close"
      >
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black bg-opacity-50" />

        <!-- Modal Content -->
        <div
          class="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="login-modal-title"
        >
          <!-- Close Button -->
          <button
            @click="close"
            class="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Schließen"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <!-- Header -->
          <div class="mb-6">
            <h2 id="login-modal-title" class="text-2xl font-bold text-gray-900">
              Anmelden
            </h2>
          </div>

          <!-- Login Form -->
          <form @submit.prevent="handleSubmit" class="space-y-4">
            <!-- Email Field -->
            <div>
              <label for="login-email" class="block text-sm font-medium text-gray-700 mb-1">
                E-Mail
              </label>
              <input
                id="login-email"
                v-model="email"
                type="email"
                required
                autocomplete="email"
                :disabled="isLoading"
                class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-orange focus:border-orange disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder="name@example.com"
              />
            </div>

            <!-- Password Field -->
            <div>
              <label for="login-password" class="block text-sm font-medium text-gray-700 mb-1">
                Passwort
              </label>
              <div class="relative">
                <input
                  id="login-password"
                  v-model="password"
                  :type="showPassword ? 'text' : 'password'"
                  required
                  autocomplete="current-password"
                  :disabled="isLoading"
                  class="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-orange focus:border-orange disabled:bg-gray-100 disabled:cursor-not-allowed"
                  placeholder="Passwort eingeben"
                />
                <button
                  type="button"
                  @click="showPassword = !showPassword"
                  class="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                  :aria-label="showPassword ? 'Passwort verbergen' : 'Passwort anzeigen'"
                >
                  <svg v-if="!showPassword" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                </button>
              </div>
            </div>

            <!-- Error Message -->
            <div v-if="errorMessage" class="p-3 bg-red-50 border border-red-200 rounded-md">
              <p class="text-sm text-red-600 flex items-center">
                <svg class="w-4 h-4 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                </svg>
                {{ errorMessage }}
              </p>
            </div>

            <!-- Submit Button -->
            <button
              type="submit"
              :disabled="isLoading || !isFormValid"
              class="w-full py-2.5 px-4 bg-orange text-white font-semibold rounded-md hover:bg-orange-dark focus:outline-none focus:ring-2 focus:ring-orange focus:ring-offset-2 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              <span v-if="isLoading" class="flex items-center justify-center gap-1.5">
                <SlkFlowerSpinner :size="16" />
                Anmeldung läuft...
              </span>
              <span v-else>Anmelden</span>
            </button>
          </form>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useAuth } from '~/composables/useAuth';

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['close', 'success']);

const { login, isLoading } = useAuth();

const email = ref('');
const password = ref('');
const showPassword = ref(false);
const errorMessage = ref('');

const isFormValid = computed(() => {
  return email.value.length > 0 && password.value.length > 0;
});

watch(() => props.isOpen, (newValue) => {
  if (newValue) {
    errorMessage.value = '';
  } else {
    password.value = '';
    showPassword.value = false;
    errorMessage.value = '';
  }
});

async function handleSubmit() {
  if (!isFormValid.value || isLoading.value) return;

  errorMessage.value = '';

  try {
    const result = await login(email.value, password.value);

    if (result.success) {
      emit('success', result.user);
      emit('close');
      email.value = '';
      password.value = '';
    }
  } catch (err) {
    errorMessage.value = err.message || 'Anmeldung fehlgeschlagen.';
  }
}

function close() {
  emit('close');
}
</script>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>

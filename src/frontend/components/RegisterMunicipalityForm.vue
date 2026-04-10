<template>
  <!-- Success state -->
  <div
    v-if="formState === 'success'"
    class="flex flex-col items-center justify-center rounded-sm shadow-list p-10 text-center bg-rating-3-light"
  >
    <img src="~/assets/icons/icon_location_green_marker.svg" class="h-14 w-auto mb-4" />
    <h2 class="font-heading text-h2 font-bold text-green mb-2">Anfrage erfolgreich gesendet!</h2>
    <p class="text-gray-600 max-w-sm">
      Dein Account für <strong>{{ municipalityName }}</strong> wird eingerichtet.
      Du erhältst in Kürze eine E-Mail mit einem Link zum Festlegen deines Passworts.
    </p>
  </div>

  <!-- Registration form -->
  <div v-else class="rounded-sm shadow-list bg-white overflow-hidden">
    <!-- Form header -->
    <div class="px-8 pt-7 pb-5 border-b border-gray-100">
      <h2 class="font-heading text-h3 font-bold text-gray-800 mb-1">Deine Kontaktdaten</h2>
      <p class="text-sm text-gray-500">
        Füll das Formular aus – wir richten dann deinen Account für
        <strong class="text-gray-700">{{ municipalityName }}</strong> ein.
      </p>
    </div>

    <form class="px-8 py-6 space-y-5" @submit.prevent="submit">

      <!-- Name -->
      <div>
        <label for="reg-name" class="block text-sm font-medium text-gray-700 mb-1">
          Dein Name <span class="text-red-500">*</span>
        </label>
        <input
          id="reg-name"
          v-model="form.name"
          type="text"
          required
          autocomplete="name"
          placeholder="z.B. Maria Muster"
          class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green focus:border-green transition-colors"
        />
      </div>

      <!-- Email -->
      <div>
        <label for="reg-email" class="block text-sm font-medium text-gray-700 mb-1">
          E-Mail-Adresse <span class="text-red-500">*</span>
        </label>
        <input
          id="reg-email"
          v-model="form.email"
          type="email"
          required
          autocomplete="email"
          placeholder="z.B. maria@example.de"
          class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green focus:border-green transition-colors"
        />
        <p class="mt-1 text-xs text-gray-400">An diese Adresse wird dein Link zum Passwort-Setzen gesendet.</p>
      </div>

      <!-- Organisation -->
      <div>
        <label for="reg-org" class="block text-sm font-medium text-gray-700 mb-1">
          Organisation / Rolle
          <span class="text-gray-400 font-normal">(optional)</span>
        </label>
        <input
          id="reg-org"
          v-model="form.organisation"
          type="text"
          autocomplete="organization"
          placeholder="z.B. BUND Ortsgruppe, Gemeindeverwaltung, Privatperson …"
          class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green focus:border-green transition-colors"
        />
      </div>

      <!-- Altcha CAPTCHA widget (open-source, self-hosted proof-of-work) -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">
          Sicherheitsabfrage <span class="text-red-500">*</span>
        </label>
        <ClientOnly>
          <altcha-widget
            ref="altchaRef"
            challenge="/api/altcha"
            hidefooter
            language="de"
            style="--altcha-border-radius: 6px; --altcha-color-border: #d1d5db; width: 100%;"
          />
          <template #fallback>
            <div class="h-16 bg-gray-50 border border-gray-200 rounded-md flex items-center justify-center">
              <span class="text-xs text-gray-400">Sicherheitsabfrage wird geladen …</span>
            </div>
          </template>
        </ClientOnly>
        <p v-if="captchaError" class="mt-1 text-xs text-red-500">{{ captchaError }}</p>
      </div>

      <!-- Error message -->
      <div v-if="errorMessage" class="p-3 bg-red-50 border border-red-200 rounded-md">
        <p class="text-sm text-red-600 flex items-start gap-2">
          <svg class="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
          </svg>
          {{ errorMessage }}
        </p>
      </div>

      <!-- Actions -->
      <div class="flex flex-col sm:flex-row gap-3 pt-1 items-center justify-between">
        <button
          v-if="canChange"
          type="button"
          class="text-sm text-light-blue hover:underline order-last sm:order-first"
          @click="$emit('change-municipality')"
        >
          ← Andere Kommune wählen
        </button>
        <button
          type="submit"
          :disabled="formState === 'submitting'"
          class="w-full sm:w-auto sm:ml-auto py-2.5 px-6 bg-green text-white font-semibold rounded-md hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-green focus:ring-offset-2 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          <span v-if="formState === 'submitting'" class="flex items-center justify-center gap-2">
            <svg class="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Wird gesendet …
          </span>
          <span v-else>Lokalteam beantragen →</span>
        </button>
      </div>

      <p class="text-xs text-gray-400 pt-1">
        Mit dem Absenden stimmst du der Verarbeitung deiner Daten zum Zweck der Einrichtung deines Accounts zu.
        Weitere Informationen findest du in unserer
        <NuxtLink to="/datenschutz" class="underline hover:text-gray-600">Datenschutzerklärung</NuxtLink>.
      </p>
    </form>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  municipalityName: string;
  ars: string;
  canChange?: boolean;
}>();

const emit = defineEmits<{ (e: 'change-municipality'): void }>()

const formState = ref<'idle' | 'submitting' | 'success' | 'error'>('idle');
const errorMessage = ref('');
const captchaError = ref('');
const altchaRef = ref<HTMLElement | null>(null);
// Captured via statechange event — more reliable than reading .value on submit
const altchaPayload = ref('');

const form = reactive({ name: '', email: '', organisation: '' });

// Watch the ref so we attach the listener as soon as ClientOnly renders the element
watch(altchaRef, (el) => {
  if (!el) return;
  el.addEventListener('statechange', (e: Event) => {
    const detail = (e as CustomEvent<{ state: string }>).detail;
    if (detail?.state === 'verified') {
      altchaPayload.value = (el as any).value ?? '';
      captchaError.value = '';
    } else {
      altchaPayload.value = '';
    }
  });
});

async function submit() {
  errorMessage.value = '';
  captchaError.value = '';

  // Fallback: try reading .value directly in case statechange was missed
  const payload = altchaPayload.value || (altchaRef.value as any)?.value;
  if (!payload) {
    captchaError.value = 'Bitte bestätige zunächst die Sicherheitsabfrage.';
    return;
  }

  formState.value = 'submitting';
  try {
    await $fetch('/api/register-municipality', {
      method: 'POST',
      body: {
        name: form.name,
        email: form.email,
        organisation: form.organisation,
        ars: props.ars,
        municipalityName: props.municipalityName,
        altcha: payload,
      },
    });
    formState.value = 'success';
  } catch (err: any) {
    formState.value = 'error';
    errorMessage.value =
      err?.data?.message ?? 'Ein Fehler ist aufgetreten. Bitte versuche es erneut.';
  }
}
</script>

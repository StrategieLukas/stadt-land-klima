<template>
  <!-- Processing + Durchstarten (merged) -->
  <div v-if="formState === 'processing' || formState === 'success'" class="rounded-sm shadow-list bg-white overflow-hidden">

    <!-- Header: green tint once done, neutral while processing -->
    <div
      class="px-8 pt-7 pb-5 border-b flex items-center gap-4 transition-colors duration-500"
      :class="processingDone && !processingError ? 'bg-rating-3-light border-green/20' : 'bg-white border-gray-100'"
    >
      <div
        class="flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center transition-colors duration-500"
        :class="processingDone && !processingError ? 'bg-green' : processingError ? 'bg-red-500' : 'bg-gray-100'"
      >
        <!-- Spinner while processing -->
        <SlkFlowerSpinner v-if="!processingDone" :size="20" />
        <!-- Success checkmark -->
        <svg v-else-if="!processingError" class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
        </svg>
        <!-- Error X -->
        <svg v-else class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
      <div>
        <h2
          class="font-heading text-h3 font-bold leading-tight transition-colors duration-500"
          :class="processingDone && !processingError ? 'text-green' : processingError ? 'text-red-600' : 'text-gray-500'"
        >
          {{ processingError ? 'Fehler aufgetreten' : processingDone ? 'Durchstarten!' : 'Wird eingerichtet …' }}
        </h2>
        <p class="text-sm text-gray-600">
          Lokalteam für <strong>{{ municipalityName }}</strong>
        </p>
      </div>
    </div>

    <!-- Flow step indicators -->
    <div class="px-8 pt-6 pb-4 space-y-3 border-b border-gray-100">
      <div v-for="step in stepInfos" :key="step.key" class="flex items-center gap-3">
        <div class="w-6 h-6 flex items-center justify-center flex-shrink-0">
          <SlkFlowerSpinner v-if="stepStatuses[step.key] === 'loading'" :size="20" />
          <div v-else-if="stepStatuses[step.key] === 'success'" class="w-5 h-5 rounded-full bg-green flex items-center justify-center">
            <svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div v-else-if="stepStatuses[step.key] === 'error'" class="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
            <svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <div v-else class="w-4 h-4 rounded-full border-2 border-gray-200" />
        </div>
        <p class="text-sm" :class="stepStatuses[step.key] === 'error' ? 'text-red-600 font-medium' : stepStatuses[step.key] === 'success' ? 'text-gray-700' : 'text-gray-400'">
          {{ stepStatuses[step.key] === 'error' ? step.errorLabel : step.label }}
        </p>
      </div>
    </div>

    <!-- Error: retry -->
    <div v-if="processingError" class="px-8 py-5">
      <p class="text-sm text-red-600 mb-3">{{ processingError }}</p>
      <button type="button" class="text-sm text-light-blue hover:underline" @click="resetToIdle">← Erneut versuchen</button>
    </div>

    <!-- Success: Durchstarten content (fades in once done) -->
    <Transition name="fade-down">
      <div v-if="formState === 'success'" class="px-8 py-6 space-y-5">

        <!-- Activation email -->
        <div class="flex gap-4">
          <div class="flex-shrink-0 w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center mt-0.5">
            <svg class="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h3 class="text-sm font-semibold text-gray-800 mb-0.5">Aktivierungs-E-Mail</h3>
            <p class="text-sm text-gray-500">
              Wir haben eine E-Mail an <strong class="text-gray-700">{{ submittedEmail }}</strong> gesendet.
              Klick auf den Link darin, um dein Passwort festzulegen und dich einzuloggen.
            </p>
          </div>
        </div>

        <div class="border-t border-gray-100" />

        <!-- Onboarding -->
        <div class="flex gap-4">
          <div class="flex-shrink-0 w-9 h-9 rounded-full bg-green/10 flex items-center justify-center mt-0.5">
            <svg class="w-5 h-5 text-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h3 class="text-sm font-semibold text-gray-800 mb-0.5">Onboarding</h3>
            <p class="text-sm text-gray-500">
              Unser Team richtet dein Lokalteam für <strong class="text-gray-700">{{ municipalityName }}</strong> ein
              und begleitet dich durch die ersten Schritte – von der Bewertung bis zur Veröffentlichung.
            </p>
          </div>
        </div>

        <div class="border-t border-gray-100" />

        <!-- Newsletter -->
        <div class="flex gap-4">
          <div class="flex-shrink-0 w-9 h-9 rounded-full bg-yellow-50 flex items-center justify-center mt-0.5">
            <svg class="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
          <div class="flex-1">
            <h3 class="text-sm font-semibold text-gray-800 mb-0.5">Newsletter</h3>
            <p class="text-sm text-gray-500 mb-3">
              Bleib auf dem Laufenden: Neuigkeiten aus dem Netzwerk, neue Maßnahmen und Klimaschutz-Tipps direkt in dein Postfach.
            </p>
            <div v-if="newsletterState === 'success'" class="flex items-center gap-2 text-sm text-green font-medium">
              <svg class="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
              </svg>
              {{ newsletterAlreadySubscribed ? 'Du bist bereits angemeldet.' : 'Bestätigungsmail wurde gesendet. Bitte prüfe dein Postfach.' }}
            </div>
            <div v-else class="flex gap-2">
              <input
                v-model="newsletterEmail"
                type="email"
                autocomplete="email"
                placeholder="Deine E-Mail-Adresse"
                class="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green focus:border-green transition-colors"
                @keydown.enter.prevent="subscribeNewsletter"
              />
              <button
                type="button"
                :disabled="newsletterState === 'subscribing'"
                class="px-4 py-2 bg-green text-white text-sm font-semibold rounded-md hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                @click="subscribeNewsletter"
              >
                <span v-if="newsletterState === 'subscribing'">…</span>
                <span v-else>Anmelden</span>
              </button>
            </div>
            <p v-if="newsletterError" class="mt-1 text-xs text-red-500">{{ newsletterError }}</p>
            <p class="mt-1.5 text-xs text-gray-400">Abmeldung jederzeit möglich. Kein Spam.</p>
          </div>
        </div>

      </div>
    </Transition>
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

    <form class="px-8 py-6 space-y-5" novalidate @submit.prevent="submit">

      <!-- Name -->
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label for="reg-firstname" class="block text-sm font-medium text-gray-700 mb-1">
            Vorname <span class="text-red-500">*</span>
          </label>
          <input
            id="reg-firstname"
            v-model="form.firstName"
            type="text"
            required
            autocomplete="given-name"
            placeholder="z.B. Maria"
            class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green focus:border-green transition-colors"
          />
        </div>
        <div>
          <label for="reg-lastname" class="block text-sm font-medium text-gray-700 mb-1">
            Nachname <span class="text-red-500">*</span>
          </label>
          <input
            id="reg-lastname"
            v-model="form.lastName"
            type="text"
            required
            autocomplete="family-name"
            placeholder="z.B. Muster"
            class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green focus:border-green transition-colors"
          />
        </div>
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
          class="w-full sm:w-auto sm:ml-auto py-2.5 px-6 bg-green text-white font-semibold rounded-md hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-green focus:ring-offset-2 transition-colors"
        >
          Lokalteam beantragen →
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
  population?: number | null;
  state?: string | null;
  geolocation?: object | null;
  canChange?: boolean;
}>();

const emit = defineEmits<{
  (e: 'change-municipality'): void
  (e: 'success'): void
}>()

const formState = ref<'idle' | 'processing' | 'success'>('idle');
const captchaError = ref('');
const altchaRef = ref<HTMLElement | null>(null);
const altchaPayload = ref('');
const submittedEmail = ref('');

const form = reactive({ firstName: '', lastName: '', email: '', organisation: '' });

// Newsletter state
const newsletterEmail = ref('');
const newsletterState = ref<'idle' | 'subscribing' | 'success'>('idle');
const newsletterAlreadySubscribed = ref(false);
const newsletterError = ref('');

// Processing step state
type StepStatus = 'pending' | 'loading' | 'success' | 'error';
const stepStatuses = reactive<Record<string, StepStatus>>({ user: 'pending', team: 'pending', email: 'pending' });
const processingError = ref('');
const processingDone = ref(false);
const stepInfos = [
  { key: 'user', label: 'Account erstellen', errorLabel: 'E-Mail-Adresse bereits registriert' },
  { key: 'team', label: 'Lokalteam anlegen', errorLabel: 'Lokalteam konnte nicht angelegt werden' },
  { key: 'email', label: 'Passwort-E-Mail versenden', errorLabel: 'E-Mail konnte nicht gesendet werden' },
];
const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

async function resetToIdle() {
  formState.value = 'idle';
  stepStatuses.user = 'pending';
  stepStatuses.team = 'pending';
  stepStatuses.email = 'pending';
  processingError.value = '';
  processingDone.value = false;
  altchaPayload.value = '';
  captchaError.value = '';
  // The altcha-widget was unmounted while formState was 'processing' (v-else hides the form).
  // After setting idle, wait two ticks for ClientOnly to re-render the new widget, then
  // re-attach the statechange listener so the auto-solved payload is captured again.
  await nextTick();
  await nextTick();
  const el = document.querySelector('altcha-widget');
  if (el) {
    el.removeEventListener('statechange', onAltchaStateChange); // guard against double-attach
    el.addEventListener('statechange', onAltchaStateChange);
  }
}

function onAltchaStateChange(e: Event) {
  const { state, payload } = (e as CustomEvent).detail ?? {};
  if (state === 'verified' && payload) {
    altchaPayload.value = payload;
    captchaError.value = '';
  } else {
    altchaPayload.value = '';
  }
}

onMounted(async () => {
  // Wait for <ClientOnly> to render its slot content (two ticks: one for ClientOnly to flip, one for Vue to render)
  await nextTick();
  await nextTick();
  const el = document.querySelector('altcha-widget');
  if (el) {
    el.addEventListener('statechange', onAltchaStateChange);
  }
})

onUnmounted(() => {
  const el = document.querySelector('altcha-widget');
  if (el) el.removeEventListener('statechange', onAltchaStateChange);
})

async function submit() {
  captchaError.value = '';

  const widgetEl = document.querySelector('altcha-widget') as any;
  const payload = altchaPayload.value || widgetEl?.value;
  if (!payload) {
    captchaError.value = 'Bitte bestätige zunächst die Sicherheitsabfrage.';
    return;
  }

  const submitData = {
    firstName: form.firstName,
    lastName: form.lastName,
    email: form.email,
    organisation: form.organisation,
    ars: props.ars,
    municipalityName: props.municipalityName,
    population: props.population ?? null,
    state: props.state ?? null,
    geolocation: props.geolocation ?? null,
    altcha: payload,
  };
  submittedEmail.value = form.email;
  newsletterEmail.value = form.email;

  formState.value = 'processing';
  processingDone.value = false;
  processingError.value = '';
  stepStatuses.user = 'loading';
  stepStatuses.team = 'loading';
  stepStatuses.email = 'loading';

  try {
    const result = await $fetch<{ success: boolean; steps: { user: boolean; team: boolean; email: boolean } }>('/api/register-municipality', {
      method: 'POST',
      body: submitData,
    });
    stepStatuses.user = result?.steps?.user !== false ? 'success' : 'error';
    await delay(400);
    stepStatuses.team = result?.steps?.team !== false ? 'success' : 'error';
    await delay(400);
    stepStatuses.email = result?.steps?.email !== false ? 'success' : 'error';
    await delay(600);
    processingDone.value = true;
    formState.value = 'success';
    emit('success');
  } catch (err: any) {
    // err.data.data.steps is present when the server threw a 422 with step info
    const errSteps = err?.data?.data?.steps as { user?: boolean; team?: boolean; email?: boolean } | undefined;
    stepStatuses.user = errSteps?.user === true ? 'success' : 'error';
    await delay(300);
    // Steps that never ran (undefined) stay 'pending' (grey circle) to distinguish from failed
    stepStatuses.team = errSteps?.team === true ? 'success' : errSteps?.team === false ? 'error' : 'pending';
    await delay(300);
    stepStatuses.email = errSteps?.email === true ? 'success' : errSteps?.email === false ? 'error' : 'pending';
    await delay(400);
    processingDone.value = true;
    processingError.value = err?.data?.message ?? 'Ein Fehler ist aufgetreten. Bitte versuche es erneut.';
  }
}

async function subscribeNewsletter() {
  newsletterError.value = '';
  if (!newsletterEmail.value.trim()) {
    newsletterError.value = 'Bitte gib deine E-Mail-Adresse ein.';
    return;
  }
  newsletterState.value = 'subscribing';
  try {
    const result = await $fetch<{ success: boolean; alreadySubscribed: boolean }>('/api/newsletter-subscribe', {
      method: 'POST',
      body: { email: newsletterEmail.value.trim(), name: form.name || undefined },
    });
    newsletterAlreadySubscribed.value = result.alreadySubscribed;
    newsletterState.value = 'success';
  } catch (err: any) {
    newsletterState.value = 'idle';
    newsletterError.value = err?.data?.message ?? 'Anmeldung fehlgeschlagen. Bitte versuche es erneut.';
  }
}
</script>

<style scoped>
.fade-down-enter-active {
  transition: opacity 0.4s ease, transform 0.4s ease;
}
.fade-down-enter-from {
  opacity: 0;
  transform: translateY(-8px);
}
</style>

<template>
  <!-- Success state -->
  <div
    v-if="formState === 'success'"
    class="flex flex-col items-center justify-center rounded-sm shadow-list p-10 text-center bg-rating-3-light"
  >
    <img src="~/assets/icons/icon_location_green_marker.svg" class="h-14 w-auto mb-4" />
    <h2 class="font-heading text-h2 font-bold text-green mb-2">Vielen Dank!</h2>
    <p class="text-gray-600 max-w-sm">
      Deine Anfrage wurde erfolgreich übermittelt. Wir melden uns in Kürze bei dir.
    </p>
  </div>

  <!-- CTA card (pre-form) -->
  <div
    v-else-if="!showForm"
    class="flex flex-col items-center justify-center rounded-sm shadow-list p-10 text-center bg-rating-3-light"
  >
    <img src="~/assets/icons/icon_location_green_marker.svg" class="h-14 w-auto mb-4 opacity-80" />
    <h2 class="font-heading text-h2 font-bold text-green mb-2">Noch keine Bewertung</h2>
    <p class="text-gray-600 max-w-sm mb-6">
      Diese Kommune wurde noch nicht bewertet. Werde Teil eines Lokalteams und bringe
      Klimaschutz nach <strong>{{ municipalityName }}</strong>!
    </p>
    <button
      class="btn bg-green text-white hover:opacity-90 font-heading px-8"
      @click="showForm = true"
    >
      Lokalteam gründen →
    </button>
  </div>

  <!-- Registration form -->
  <div v-else class="rounded-sm shadow-list p-8 bg-white">
    <h2 class="font-heading text-h2 font-bold text-green mb-1">Lokalteam gründen</h2>
    <p class="text-sm text-gray-500 mb-6">Alle mit <span class="text-red-500">*</span> markierten Felder sind Pflichtfelder.</p>

    <form class="space-y-4" @submit.prevent="submit">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          Name <span class="text-red-500">*</span>
        </label>
        <input
          v-model="form.name"
          type="text"
          required
          autocomplete="name"
          placeholder="Max Mustermann"
          class="input input-bordered w-full"
        />
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          E-Mail <span class="text-red-500">*</span>
        </label>
        <input
          v-model="form.email"
          type="email"
          required
          autocomplete="email"
          placeholder="max@example.de"
          class="input input-bordered w-full"
        />
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          Organisation / Rolle
          <span class="text-gray-400 font-normal">(optional)</span>
        </label>
        <input
          v-model="form.organisation"
          type="text"
          autocomplete="organization"
          placeholder="z.B. BUND Ortsgruppe, Gemeindeverwaltung, …"
          class="input input-bordered w-full"
        />
      </div>

      <!-- Altcha CAPTCHA widget (open-source, self-hosted proof-of-work) -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Sicherheitsabfrage</label>
        <ClientOnly>
          <altcha-widget
            ref="altchaRef"
            challengeurl="/api/altcha"
            hidefooter
            style="--altcha-border-radius: 2px;"
          />
        </ClientOnly>
      </div>

      <div v-if="errorMessage" class="text-red-600 text-sm rounded bg-red-50 px-3 py-2">
        {{ errorMessage }}
      </div>

      <div class="flex gap-3 pt-2">
        <button
          type="submit"
          :disabled="formState === 'submitting'"
          class="btn bg-green text-white hover:opacity-90 flex-1"
        >
          <span v-if="formState === 'submitting'">Wird gesendet …</span>
          <span v-else>Anfrage senden</span>
        </button>
        <button type="button" class="btn btn-ghost" @click="showForm = false">
          Abbrechen
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  municipalityName: string;
  ars: string;
}>();

const showForm = ref(false);
const formState = ref<'idle' | 'submitting' | 'success' | 'error'>('idle');
const errorMessage = ref('');
const altchaRef = ref<HTMLElement | null>(null);

const form = reactive({ name: '', email: '', organisation: '' });

// Load Altcha web component from CDN (MIT-licensed, open-source, no external tracking)
useHead({
  script: [
    {
      src: 'https://cdn.jsdelivr.net/npm/@altcha/altcha/dist/altcha.min.js',
      type: 'module',
      tagPriority: 'low',
    },
  ],
});

async function submit() {
  errorMessage.value = '';

  const altchaPayload = (altchaRef.value as any)?.value as string | undefined;
  if (!altchaPayload) {
    errorMessage.value = 'Bitte bestätige zunächst die Sicherheitsabfrage.';
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
        altcha: altchaPayload,
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

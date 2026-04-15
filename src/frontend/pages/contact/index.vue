<template>
  <div class="max-w-xl mx-auto px-4 py-12 sm:py-16">
    <div class="bg-white rounded shadow p-6">
      <h2 class="text-xl font-bold mb-4">{{ $t("feedback.nav_label") }}</h2>

      <!-- Success state -->
      <div v-if="successMessage" class="py-4">
        <p class="text-green font-semibold">{{ successMessage }}</p>
        <button class="mt-3 text-sm text-light-blue hover:underline" @click="resetForm">
          Weitere Nachricht senden
        </button>
      </div>

      <form v-else @submit.prevent="submitFeedback">
        <!-- Title -->
        <div class="mb-4">
          <label class="block mb-1 font-semibold">{{ $t("feedback.form.title") }}*</label>
          <input v-model="form.title" type="text" class="w-full border rounded p-2" required />
        </div>

        <!-- Type -->
        <div class="mb-4">
          <label class="block mb-1 font-semibold">{{ $t("feedback.form.type") }}*</label>
          <select v-model="form.type" class="w-full border rounded p-2" required>
            <option disabled value="">{{ $t("generic.form.please_select") }}</option>
            <option value="legal">{{ $t("feedback.type.legal") }}</option>
            <option value="bug">{{ $t("feedback.type.bug") }}</option>
            <option value="inaccuracy">{{ $t("feedback.type.inaccuracy") }}</option>
            <option value="suggestion">{{ $t("feedback.type.suggestion") }}</option>
            <option value="cooperation">{{ $t("feedback.type.cooperation") }}</option>
            <option value="other">{{ $t("feedback.type.other") }}</option>
          </select>
        </div>

        <!-- Content -->
        <div class="mb-4">
          <label class="block mb-1 font-semibold">{{ $t("feedback.form.content") }}*</label>
          <textarea v-model="form.content" class="w-full border rounded p-2" rows="4" required></textarea>
        </div>

        <!-- Name -->
        <div class="mb-4">
          <label class="block mb-1 font-semibold">{{ $t("feedback.form.sender.name") }}*</label>
          <input v-model="form.name" type="text" autocomplete="name" class="w-full border rounded p-2" required />
        </div>

        <!-- Contact -->
        <div class="mb-4">
          <label class="block mb-1 font-semibold">{{ $t("feedback.form.sender.contact") }}*</label>
          <input v-model="form.contact" type="email" autocomplete="email" class="w-full border rounded p-2" required />
        </div>

        <!-- Altcha CAPTCHA -->
        <div class="mb-4">
          <ClientOnly>
            <altcha-widget
              ref="altchaRef"
              challenge="/api/altcha"
              hidefooter
              language="de"
              style="--altcha-border-radius: 4px; width: 100%;"
            />
            <template #fallback>
              <div class="h-14 bg-gray-50 border border-gray-200 rounded flex items-center justify-center">
                <span class="text-xs text-gray-400">Sicherheitsabfrage wird geladen …</span>
              </div>
            </template>
          </ClientOnly>
          <p v-if="captchaError" class="mt-1 text-xs text-red-500">{{ captchaError }}</p>
        </div>

        <!-- Error Message -->
        <p v-if="errorMessage" class="text-red-600 text-sm mb-3">{{ errorMessage }}</p>

        <!-- Submit Button -->
        <button
          type="submit"
          :disabled="loading"
          class="w-full bg-[#AFCA0B] text-white font-bold py-2 rounded hover:bg-green disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span v-if="loading">Wird gesendet …</span>
          <span v-else>{{ $t("feedback.form.submit") }}</span>
        </button>
      </form>

      <p class="mt-4 text-xs italic">{{ $t('generic.privacy.disclaimer') }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'

const { $t } = useNuxtApp();
const route = useRoute();

useHead({ title: ref($t("feedback.nav_label")) });

const ALLOWED_TYPES = ['legal', 'bug', 'inaccuracy', 'suggestion', 'cooperation', 'other']

// Form state — pre-fill from query params when arriving from a content page
const form = ref({
  title:   route.query.title   ? String(route.query.title)   : '',
  type:    route.query.type && ALLOWED_TYPES.includes(String(route.query.type)) ? String(route.query.type) : '',
  content: route.query.content ? String(route.query.content) : '',
  name:    '',
  contact: '',
})

// Altcha
const altchaRef = ref(null)
const altchaPayload = ref('')
const captchaError = ref('')

function onAltchaStateChange(e) {
  const { state, payload } = e.detail || {}
  if (state === 'verified' && payload) {
    altchaPayload.value = payload
    captchaError.value = ''
  } else {
    altchaPayload.value = ''
  }
}

onMounted(async () => {
  await nextTick()
  await nextTick()
  const el = document.querySelector('altcha-widget')
  if (el) el.addEventListener('statechange', onAltchaStateChange)
})

onUnmounted(() => {
  const el = document.querySelector('altcha-widget')
  if (el) el.removeEventListener('statechange', onAltchaStateChange)
})

// Status
const loading = ref(false)
const successMessage = ref('')
const errorMessage = ref('')

async function submitFeedback() {
  errorMessage.value = ''
  captchaError.value = ''

  const payload = altchaPayload.value || document.querySelector('altcha-widget')?.value
  if (!payload) {
    captchaError.value = 'Bitte bestätige zunächst die Sicherheitsabfrage.'
    return
  }

  loading.value = true
  try {
    await $fetch('/api/submit-feedback', {
      method: 'POST',
      body: {
        title:   form.value.title,
        type:    form.value.type,
        content: form.value.content,
        name:    form.value.name,
        contact: form.value.contact,
        altcha:  payload,
      },
    })
    successMessage.value = $t('feedback.form.submit.success')
  } catch (err) {
    errorMessage.value = err?.data?.message ?? $t('generic.technical_error')
  } finally {
    loading.value = false
  }
}

function resetForm() {
  form.value = { title: '', type: '', content: '', name: '', contact: '' }
  altchaPayload.value = ''
  successMessage.value = ''
  errorMessage.value = ''
}
</script>

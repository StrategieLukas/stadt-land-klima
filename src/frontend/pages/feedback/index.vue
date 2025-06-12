<template>
  <div class="max-w-md mx-auto p-6 bg-white rounded shadow">
    <h2 class="text-xl font-bold mb-4">{{ $t("feedback.nav_label") }}</h2>

    <form @submit.prevent="submitFeedback">
      <!-- Title -->
      <div class="mb-4">
        <label class="block mb-1 font-semibold">{{ $t("feedback.form.title") }}</label>
        <input v-model="form.title" type="text" class="w-full border rounded p-2" required />
      </div>

      <!-- Type -->
      <div class="mb-4">
        <label class="block mb-1 font-semibold">{{ $t("feedback.form.type") }}</label>
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
        <label class="block mb-1 font-semibold">{{ $t("feedback.form.content") }}</label>
        <textarea v-model="form.content" class="w-full border rounded p-2" rows="4" required></textarea>
      </div>

      <!-- Name -->
      <div class="mb-4">
        <label class="block mb-1 font-semibold">{{ $t("feedback.form.sender.name") }}</label>
        <input v-model="form.name" type="text" class="w-full border rounded p-2" />
      </div>

      <!-- Contact -->
      <div class="mb-4">
        <label class="block mb-1 font-semibold">{{ $t("feedback.form.sender.contact") }}</label>
        <input v-model="form.contact" type="email" class="w-full border rounded p-2" required />
      </div>

      <!-- Simple CAPTCHA -->
      <div class="mb-4">
        <label class="block mb-1 font-semibold">
          {{ $t("captcha.question", { ":first": captcha.num1, ":second": captcha.num2 }) }}
        </label>
        <input v-model="captchaAnswer" type="number" class="w-full border rounded p-2" required />
      </div>

      

      <!-- Submit Button -->
      <button type="submit" class="w-full bg-[#AFCA0B] text-white font-bold py-2 rounded hover:bg-green">
        {{ $t("feedback.form.submit") }}
      </button>
    </form>

    <!-- Success Message -->
    <p v-if="successMessage" class="text-green font-semibold mt-4">
      {{ successMessage }}
    </p>
    <!-- Error Message -->
    <p v-if="errorMessage" class="text-red font-semibold mt-4">
      {{ errorMessage }}
    </p>

    <p class="mt-4 text-xs italic">{{ $t('generic.privacy.disclaimer') }}</p>


  </div>
</template>



<script setup>
import { ref } from 'vue'
import { createItem } from '@directus/sdk'

const { $t, $directus, $readItems } = useNuxtApp();

//MetaTags
const title = ref($t("feedback.nav_label"));
useHead({
  title,
});

// Form state
const form = ref({
  title: '',
  type: '',
  content: '',
  name: '',
  contact: '',
})

// Captcha state
const captcha = ref(generateCaptcha())
const captchaAnswer = ref('')

// Loading and feedback messages
const loading = ref(false)
const successMessage = ref('')
const errorMessage = ref('')

// Generate a new simple captcha
function generateCaptcha() {
  const num1 = Math.floor(Math.random() * 10) + 10 // 10-19
  const num2 = Math.floor(Math.random() * 10) + 1  // 1-10
  return { num1, num2, correctAnswer: num1 + num2 }
}

// Submit function
async function submitFeedback() {
  errorMessage.value = ''
  successMessage.value = ''

  if (parseInt(captchaAnswer.value) !== captcha.value.correctAnswer) {
    errorMessage.value = $t('captcha.incorrect_answer')
    captcha.value = generateCaptcha()
    captchaAnswer.value = ''
    return
  }

  loading.value = true

  try {
    await $directus.request(
      createItem('feedback', {
        title: form.value.title,
        type: form.value.type,
        content: form.value.content,
        sender_name: form.value.name,
        sender_contact: form.value.contact,
      })
    )

    successMessage.value = $t('feedback.form.submit.success')
    form.value = { title: '', type: '', content: '', name: '', contact: '' }
    captcha.value = generateCaptcha()
    captchaAnswer.value = ''

  } catch (error) {
    console.error(error)
    errorMessage.value = $t('generic.technical_error')
  } finally {
    loading.value = false
  }
}
</script>
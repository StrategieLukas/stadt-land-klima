<template>
  <div class="container mx-auto px-4 py-8">
    <header class="mb-10">
      <h1 class="mb-4 font-heading text-4xl font-black text-gray sm:text-6xl">{{ $t("feedback.nav_label") }}</h1>
      <p class="max-w-3xl text-lg leading-relaxed text-gray">{{ $t("contact.hero.description") }}</p>
    </header>
    <div class="mx-auto w-full max-w-xl rounded-sm bg-white p-6 shadow-sm">
      <h2 class="mb-4 font-heading text-2xl font-bold text-gray">{{ $t("feedback.give") }}</h2>

      <!-- Success state -->
      <div v-if="successMessage" class="py-4">
        <p class="font-semibold text-green">{{ successMessage }}</p>
        <button class="mt-3 text-sm text-light-blue hover:underline" @click="resetForm">
          {{ $t("feedback.form.send_another") }}
        </button>
      </div>

      <form v-else @submit.prevent="submitFeedback">
        <!-- Title -->
        <div class="mb-4">
          <label class="mb-1 block font-semibold">{{ $t("feedback.form.title") }}*</label>
          <input v-model="form.title" type="text" class="w-full rounded-sm border p-2" required />
        </div>

        <!-- Type -->
        <div class="mb-4">
          <label class="mb-1 block font-semibold">{{ $t("feedback.form.type") }}*</label>
          <select v-model="form.type" class="w-full rounded-sm border p-2" required>
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
          <label class="mb-1 block font-semibold">{{ $t("feedback.form.content") }}*</label>
          <textarea v-model="form.content" class="w-full rounded-sm border p-2" rows="4" required></textarea>
        </div>

        <!-- Name -->
        <div class="mb-4">
          <label class="mb-1 block font-semibold">{{ $t("feedback.form.sender.name") }}*</label>
          <input v-model="form.name" type="text" autocomplete="name" class="w-full rounded-sm border p-2" required />
        </div>

        <!-- Contact -->
        <div class="mb-4">
          <label class="mb-1 block font-semibold">{{ $t("feedback.form.sender.contact") }}*</label>
          <input
            v-model="form.contact"
            type="email"
            autocomplete="email"
            class="w-full rounded-sm border p-2"
            required
          />
        </div>

        <!-- Copy to sender -->
        <label class="mb-4 flex items-start gap-3 text-sm">
          <input v-model="form.sendCopy" type="checkbox" class="checkbox mt-0.5 border-gray-300 checkbox-sm" />
          <span>{{ $t("feedback.form.send_copy") }}</span>
        </label>

        <!-- Math challenge -->
        <div class="mb-4">
          <label class="mb-1 block font-semibold">
            {{ $t("captcha.question", { ":first": mathChallenge.num1, ":second": mathChallenge.num2 }) }}*
          </label>
          <input
            v-model="mathChallengeAnswer"
            type="text"
            inputmode="numeric"
            pattern="[0-9]+"
            class="w-full rounded-sm border p-2"
            required
          />
          <p v-if="mathChallengeError" class="mt-1 text-xs text-red-500">{{ mathChallengeError }}</p>
        </div>

        <!-- Altcha CAPTCHA -->
        <div class="mb-4">
          <ClientOnly>
            <div
              v-if="runtimeConfig.public.captchaDevBypass"
              class="flex h-14 items-center justify-center rounded-sm border border-yellow-200 bg-yellow-50"
            >
              <span class="text-xs text-yellow-600">Dev-Modus: Sicherheitsabfrage übersprungen</span>
            </div>
            <altcha-widget
              v-else
              ref="altchaRef"
              challenge="/api/altcha?purpose=contact"
              hidefooter
              :language="$locale.startsWith('en') ? 'en' : 'de'"
              style="--altcha-border-radius: 4px; width: 100%"
            />
            <template #fallback>
              <div class="flex h-14 items-center justify-center rounded-sm border border-gray-200 bg-gray-50">
                <span class="text-xs text-gray-400">{{ $t("captcha.loading") }}</span>
              </div>
            </template>
          </ClientOnly>
          <p v-if="captchaError" class="mt-1 text-xs text-red-500">{{ captchaError }}</p>
        </div>

        <!-- Error Message -->
        <p v-if="errorMessage" class="mb-3 text-sm text-red-600">{{ errorMessage }}</p>

        <!-- Submit Button -->
        <button
          type="submit"
          :disabled="loading"
          class="w-full rounded-sm bg-[#AFCA0B] py-2 font-bold text-white hover:bg-green disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span v-if="loading">{{ $t("feedback.form.submit.loading") }}</span>
          <span v-else>{{ $t("feedback.form.submit") }}</span>
        </button>
      </form>

      <p class="mt-4 text-xs italic">{{ $t("generic.privacy.disclaimer") }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { FeedbackRequestSchema } from "~/shared/contracts/submissions";
import { routeText } from "~/shared/routeValues";
import { captchaEventData, captchaWidgetValue, requestErrorMessage } from "~/shared/requestError";

const { $t, $locale } = useNuxtApp();
const route = useRoute();
const runtimeConfig = useRuntimeConfig();

usePageSeo({ title: ref($t("feedback.nav_label")) });

const ALLOWED_TYPES = ["legal", "bug", "inaccuracy", "suggestion", "cooperation", "other"];

// Form state — pre-fill from query params when arriving from a content page
const form = ref({
  title: routeText(route.query.title, 200),
  type: ALLOWED_TYPES.includes(routeText(route.query.type, 40)) ? routeText(route.query.type, 40) : "",
  content: routeText(route.query.content, 5000),
  name: "",
  contact: "",
  sendCopy: false,
});

const { mathChallenge, mathChallengeAnswer, mathChallengeError, loadMathChallenge, validateMathChallenge } =
  useMathChallenge("contact");

// Altcha
const altchaRef = ref(null);
const altchaPayload = ref("");
const captchaError = ref("");

function onAltchaStateChange(e: Event) {
  const { state, payload } = captchaEventData(e);
  if (state === "verified" && payload) {
    altchaPayload.value = payload;
    captchaError.value = "";
  } else if (state === "unverified" || state === "error" || state === "expired") {
    // Only clear on explicit reset states — not on 'verifying' (re-solving after
    // background-tab resume), which would wipe a still-valid captured payload.
    altchaPayload.value = "";
  }
}

onMounted(async () => {
  await loadMathChallenge();
  // In dev, the altcha widget refuses to work over plain HTTP (no isSecureContext).
  // Pre-seed a static bypass payload; the server accepts it when appEnv=development.
  if (runtimeConfig.public.captchaDevBypass) {
    altchaPayload.value = btoa(JSON.stringify({ dev: true }));
    return;
  }
  await nextTick();
  await nextTick();
  const el = document.querySelector("altcha-widget");
  if (el) el.addEventListener("statechange", onAltchaStateChange);
});

onUnmounted(() => {
  const el = document.querySelector("altcha-widget");
  if (el) el.removeEventListener("statechange", onAltchaStateChange);
});

// Status
const loading = ref(false);
const successMessage = ref("");
const errorMessage = ref("");

async function submitFeedback() {
  errorMessage.value = "";
  captchaError.value = "";
  mathChallengeError.value = "";

  if (!validateMathChallenge()) return;

  const payload = altchaPayload.value || captchaWidgetValue(document.querySelector("altcha-widget"));
  if (!payload) {
    captchaError.value = $t("captcha.required");
    return;
  }

  loading.value = true;
  try {
    const request = FeedbackRequestSchema.safeParse({
      ...form.value,
      altcha: payload,
      mathChallenge: { token: mathChallenge.value.token, answer: mathChallengeAnswer.value },
    });
    if (!request.success) {
      errorMessage.value = $t("generic.technical_error");
      return;
    }
    await $fetch("/api/submit-feedback", {
      method: "POST",
      body: request.data,
    });
    successMessage.value = form.value.sendCopy
      ? $t("feedback.form.submit.success_with_copy")
      : $t("feedback.form.submit.success");
  } catch (err) {
    errorMessage.value = requestErrorMessage(err, $t("generic.technical_error"));
  } finally {
    loading.value = false;
  }
}

function resetForm() {
  form.value = { title: "", type: "", content: "", name: "", contact: "", sendCopy: false };
  altchaPayload.value = "";
  mathChallengeAnswer.value = "";
  mathChallengeError.value = "";
  successMessage.value = "";
  errorMessage.value = "";
  void loadMathChallenge();
}
</script>

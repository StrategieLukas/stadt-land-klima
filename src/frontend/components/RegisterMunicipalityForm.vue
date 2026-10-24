<template>
  <!-- Processing + Durchstarten (merged) -->
  <div
    v-if="formState === 'processing' || formState === 'success'"
    class="overflow-hidden rounded-xs bg-white shadow-list"
  >
    <!-- Header: green tint once done, neutral while processing -->
    <div
      class="flex items-center gap-4 border-b px-4 pt-7 pb-5 transition-colors duration-500 sm:px-8"
      :class="
        processingDone && !processingError ? 'border-solid-green-20 bg-rating-3-light' : 'border-gray-100 bg-white'
      "
    >
      <div
        class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors duration-500"
        :class="processingDone && !processingError ? 'bg-green' : processingError ? 'bg-red-500' : 'bg-gray-100'"
      >
        <!-- Spinner while processing -->
        <SlkFlowerSpinner v-if="!processingDone" :size="20" />
        <!-- Success checkmark -->
        <svg
          v-else-if="!processingError"
          class="h-6 w-6 text-white"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
        </svg>
        <!-- Error X -->
        <svg v-else class="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
      <div>
        <h2
          class="font-heading text-h3 leading-tight font-bold transition-colors duration-500"
          :class="
            processingDone && !processingError ? 'text-green' : processingError ? 'text-red-600' : 'text-gray-500'
          "
        >
          {{
            processingError
              ? $t("generic.error_occurred")
              : processingDone
                ? $t("localteam.register.step.get_started_bang")
                : $t("localteam.register.processing")
          }}
        </h2>
        <p class="text-sm text-gray-600">
          {{ $t("localteam.for_municipality") }} <strong>{{ municipalityName }}</strong>
        </p>
      </div>
    </div>

    <!-- Flow step indicators -->
    <div class="space-y-3 border-b border-gray-100 px-4 pt-6 pb-4 sm:px-8">
      <div v-for="step in stepInfos" :key="step.key" class="flex items-center gap-3">
        <div class="flex h-6 w-6 shrink-0 items-center justify-center">
          <SlkFlowerSpinner v-if="stepStatuses[step.key] === 'loading'" :size="20" />
          <div
            v-else-if="stepStatuses[step.key] === 'success'"
            class="flex h-5 w-5 items-center justify-center rounded-full bg-green"
          >
            <svg class="h-3 w-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div
            v-else-if="stepStatuses[step.key] === 'error'"
            class="flex h-5 w-5 items-center justify-center rounded-full bg-red-500"
          >
            <svg class="h-3 w-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <div v-else class="h-4 w-4 rounded-full border-2 border-gray-200" />
        </div>
        <p
          class="text-sm"
          :class="
            stepStatuses[step.key] === 'error'
              ? 'font-medium text-red-600'
              : stepStatuses[step.key] === 'success'
                ? 'text-gray-700'
                : 'text-gray-400'
          "
        >
          {{ stepStatuses[step.key] === "error" ? stepErrorLabels[step.key] || step.errorLabel : step.label }}
        </p>
      </div>
    </div>

    <!-- Error: retry -->
    <div v-if="processingError" class="px-4 py-5 sm:px-8">
      <p class="mb-3 text-sm text-red-600">{{ processingError }}</p>
      <button type="button" class="text-sm text-light-blue hover:underline" @click="resetToIdle">
        ← {{ $t("generic.try_again") }}
      </button>
    </div>

    <!-- Success: Durchstarten content (fades in once done) -->
    <Transition name="fade-down">
      <div v-if="formState === 'success'" class="space-y-5 px-4 py-6 sm:px-8">
        <!-- Activation email -->
        <div class="flex gap-4">
          <div class="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50">
            <svg class="h-5 w-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>
          <div>
            <h3 class="mb-0.5 text-sm font-semibold text-gray-800">
              {{ $t("localteam.register.activation_email.title") }}
            </h3>
            <p class="text-sm text-gray-500">
              <span
                v-html="sanitizeHtml($t('localteam.register.activation_email.body', { ':email': submittedEmail }))"
              ></span>
            </p>
          </div>
        </div>

        <div class="border-t border-gray-100" />

        <!-- Onboarding -->
        <div class="flex gap-4">
          <div class="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-solid-green-10">
            <svg class="h-5 w-5 text-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h3 class="mb-0.5 text-sm font-semibold text-gray-800">{{ $t("localteam.register.onboarding.title") }}</h3>
            <p class="text-sm text-gray-500">
              <span
                v-html="sanitizeHtml($t('localteam.register.onboarding.body', { ':name': municipalityName }))"
              ></span>
            </p>
          </div>
        </div>

        <div class="border-t border-gray-100" />

        <!-- Newsletter -->
        <div class="flex gap-4">
          <div class="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-yellow-50">
            <svg class="h-5 w-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
          </div>
          <div class="flex-1">
            <h3 class="mb-0.5 text-sm font-semibold text-gray-800">Newsletter</h3>
            <p class="mb-3 text-sm text-gray-500">
              {{ $t("newsletter.register.description") }}
            </p>
            <div v-if="newsletterState === 'success'" class="flex items-center gap-2 text-sm font-medium text-green">
              <svg class="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fill-rule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clip-rule="evenodd"
                />
              </svg>
              {{
                newsletterAlreadySubscribed ? $t("newsletter.already_subscribed") : $t("newsletter.confirmation_sent")
              }}
            </div>
            <div class="flex flex-col gap-2 xs:flex-row">
              <input
                v-model="newsletterEmail"
                type="email"
                autocomplete="email"
                :placeholder="$t('newsletter.email.placeholder')"
                class="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm transition-colors focus:border-green focus:ring-2 focus:ring-green focus:outline-hidden"
                @keydown.enter.prevent="subscribeNewsletter"
              />
              <CanonicalButton
                :label="newsletterState === 'subscribing' ? '...' : $t('newsletter.subscribe')"
                icon-slug="icon_newsletter_click"
                color="green"
                :disabled="newsletterState === 'subscribing'"
                class="w-full xs:w-auto"
                @click="subscribeNewsletter"
              />
            </div>
            <p v-if="newsletterError" class="mt-1 text-xs text-red-500">{{ newsletterError }}</p>
            <p class="mt-1.5 text-xs text-gray-400">{{ $t("newsletter.no_spam_hint") }}</p>
          </div>
        </div>
      </div>
    </Transition>
  </div>

  <!-- Registration form -->
  <div v-else class="overflow-hidden rounded-xs bg-white shadow-list">
    <!-- Form header -->
    <div class="border-b border-gray-100 px-4 pt-7 pb-5 sm:px-8">
      <h2 class="mb-1 font-heading text-h3 font-bold text-gray-800">
        {{ $t("localteam.register.contact_details.title") }}
      </h2>
      <p class="text-sm text-gray-500">
        <span
          v-html="sanitizeHtml($t('localteam.register.contact_details.description', { ':name': municipalityName }))"
        ></span>
      </p>
    </div>

    <form class="space-y-5 px-4 py-6 sm:px-8" novalidate @submit.prevent="submit">
      <!-- Name -->
      <div class="grid grid-cols-1 gap-3 xs:grid-cols-2">
        <div>
          <label for="reg-firstname" class="mb-1 block text-sm font-medium text-gray-700">
            {{ $t("auth.first_name") }} <span class="text-red-500">*</span>
          </label>
          <input
            id="reg-firstname"
            v-model="form.firstName"
            type="text"
            required
            autocomplete="given-name"
            :placeholder="$t('auth.first_name.placeholder')"
            class="w-full rounded-md border border-gray-300 px-3 py-2 shadow-xs transition-colors focus:border-green focus:ring-2 focus:ring-green focus:outline-hidden"
          />
        </div>
        <div>
          <label for="reg-lastname" class="mb-1 block text-sm font-medium text-gray-700">
            {{ $t("auth.last_name") }} <span class="text-red-500">*</span>
          </label>
          <input
            id="reg-lastname"
            v-model="form.lastName"
            type="text"
            required
            autocomplete="family-name"
            :placeholder="$t('auth.last_name.placeholder')"
            class="w-full rounded-md border border-gray-300 px-3 py-2 shadow-xs transition-colors focus:border-green focus:ring-2 focus:ring-green focus:outline-hidden"
          />
        </div>
      </div>

      <!-- Email -->
      <div>
        <label for="reg-email" class="mb-1 block text-sm font-medium text-gray-700">
          {{ $t("auth.email") }} <span class="text-red-500">*</span>
        </label>
        <input
          id="reg-email"
          v-model="form.email"
          type="email"
          required
          autocomplete="email"
          :placeholder="$t('auth.email.placeholder')"
          class="w-full rounded-md border border-gray-300 px-3 py-2 shadow-xs transition-colors focus:border-green focus:ring-2 focus:ring-green focus:outline-hidden"
        />
        <p class="mt-1 text-xs text-gray-400">{{ $t("localteam.register.email_hint") }}</p>
      </div>

      <!-- Organisation -->
      <div>
        <label for="reg-org" class="mb-1 block text-sm font-medium text-gray-700">
          {{ $t("auth.organisation_or_role") }}
          <span class="font-normal text-gray-400">({{ $t("generic.optional") }})</span>
        </label>
        <input
          id="reg-org"
          v-model="form.organisation"
          type="text"
          autocomplete="organization"
          :placeholder="$t('auth.organisation_or_role.placeholder')"
          class="w-full rounded-md border border-gray-300 px-3 py-2 shadow-xs transition-colors focus:border-green focus:ring-2 focus:ring-green focus:outline-hidden"
        />
      </div>

      <!-- Math challenge -->
      <div>
        <label class="mb-1 block text-sm font-medium text-gray-700">
          {{ $t("captcha.question", { ":first": mathChallenge.num1, ":second": mathChallenge.num2 }) }}
          <span class="text-red-500">*</span>
        </label>
        <input
          v-model="mathChallengeAnswer"
          type="text"
          inputmode="numeric"
          pattern="[0-9]+"
          class="w-full rounded-md border border-gray-300 px-3 py-2 shadow-xs transition-colors focus:border-green focus:ring-2 focus:ring-green focus:outline-hidden"
        />
        <p v-if="mathChallengeError" class="mt-1 text-xs text-red-500">{{ mathChallengeError }}</p>
      </div>

      <!-- Altcha CAPTCHA widget (open-source, self-hosted proof-of-work) -->
      <div>
        <label class="mb-2 block text-sm font-medium text-gray-700">
          {{ $t("captcha.title") }} <span class="text-red-500">*</span>
        </label>
        <ClientOnly>
          <div
            v-if="isDev"
            class="flex h-16 items-center justify-center rounded-md border border-yellow-200 bg-yellow-50"
          >
            <span class="text-xs text-yellow-600">Dev-Modus: Sicherheitsabfrage übersprungen</span>
          </div>
          <altcha-widget
            v-else
            ref="altchaRef"
            challenge="/api/altcha?purpose=register"
            hidefooter
            :language="$locale.startsWith('en') ? 'en' : 'de'"
            style="--altcha-border-radius: 6px; --altcha-color-border: #d1d5db; width: 100%"
          />
          <template #fallback>
            <div class="flex h-16 items-center justify-center rounded-md border border-gray-200 bg-gray-50">
              <span class="text-xs text-gray-400">{{ $t("captcha.loading") }}</span>
            </div>
          </template>
        </ClientOnly>
        <p v-if="captchaError" class="mt-1 text-xs text-red-500">{{ captchaError }}</p>
      </div>

      <!-- Actions -->
      <div class="flex flex-col items-center justify-between gap-3 pt-1 sm:flex-row">
        <button
          v-if="canChange"
          type="button"
          class="order-last text-sm text-light-blue hover:underline sm:order-first"
          @click="$emit('change-municipality')"
        >
          ← {{ $t("localteam.register.select_other_municipality") }}
        </button>
        <button
          type="submit"
          class="w-full rounded-md bg-green px-6 py-2.5 font-semibold text-white transition-colors hover:opacity-90 focus:ring-2 focus:ring-green focus:ring-offset-2 focus:outline-hidden sm:ml-auto sm:w-auto"
        >
          {{ $t("localteam.register.submit") }} →
        </button>
      </div>

      <p class="pt-1 text-xs text-gray-400">
        {{ $t("localteam.register.privacy_notice") }}
        <NuxtLink to="/datenschutz" class="underline hover:text-gray-600">{{ $t("privacy_policy.title") }}</NuxtLink
        >.
      </p>
    </form>
  </div>
</template>

<script setup lang="ts">
import { sanitizeHtml } from "~/utils/sanitizeHtml";
import { RegistrationRequestSchema } from "~/shared/contracts/submissions";
import type { NewsletterRequest } from "~/shared/contracts/submissions";
import { captchaEventData, requestErrorData, requestErrorMessage } from "~/shared/requestError";

import { z } from "zod";
const props = defineProps<{
  municipalityName: string;
  ars: string;
  population?: number | null | undefined;
  state?: string | null | undefined;
  geolocation?: import("geojson").Point | null | undefined;
  canChange?: boolean | undefined;
}>();

const emit = defineEmits<{
  (e: "change-municipality"): void;
  (e: "success"): void;
}>();

const { $translateDynamic, $t, $locale } = useNuxtApp();

const formState = ref<"idle" | "processing" | "success">("idle");
const captchaError = ref("");
const altchaRef = ref<HTMLElement | null>(null);
const altchaPayload = ref("");
const submittedEmail = ref("");

const { mathChallenge, mathChallengeAnswer, mathChallengeError, loadMathChallenge, validateMathChallenge } =
  useMathChallenge("register");

const isDev = useRuntimeConfig().public.captchaDevBypass;

const form = reactive({ firstName: "", lastName: "", email: "", organisation: "" });

// Newsletter state
const newsletterEmail = ref("");
const newsletterState = ref<"idle" | "subscribing" | "success">("idle");
const newsletterAlreadySubscribed = ref(false);
const newsletterError = ref("");

// Processing step state
type StepKey = "user" | "team" | "email";
type StepStatus = "pending" | "loading" | "success" | "error";
const RegistrationErrorSchema = z.object({
  steps: z
    .object({ user: z.boolean().optional(), team: z.boolean().optional(), email: z.boolean().optional() })
    .optional()
    .catch(undefined),
  failedStep: z.enum(["user", "team", "email"]).optional().catch(undefined),
  errorKey: z.string().optional().catch(undefined),
});
type RegistrationErrorData = z.infer<typeof RegistrationErrorSchema>;

const stepStatuses = reactive<Record<StepKey, StepStatus>>({ user: "pending", team: "pending", email: "pending" });
const stepErrorLabels = reactive<Record<StepKey, string>>({ user: "", team: "", email: "" });
const processingError = ref("");
const processingDone = ref(false);
const stepInfos: Array<{ key: StepKey; label: string; errorLabel: string }> = [
  {
    key: "user",
    label: $t("localteam.register.step.create_account"),
    errorLabel: $t("localteam.register.error.email_registered"),
  },
  {
    key: "team",
    label: $t("localteam.register.step.create_localteam"),
    errorLabel: $t("localteam.register.error.localteam_create_failed"),
  },
  {
    key: "email",
    label: $t("localteam.register.step.send_password_email"),
    errorLabel: $t("localteam.register.error.email_send_failed"),
  },
];
const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function resetToIdle() {
  formState.value = "idle";
  stepStatuses.user = "pending";
  stepStatuses.team = "pending";
  stepStatuses.email = "pending";
  resetStepErrorLabels();
  processingError.value = "";
  processingDone.value = false;
  altchaPayload.value = isDev ? btoa(JSON.stringify({ dev: true })) : "";
  captchaError.value = "";
  mathChallengeAnswer.value = "";
  mathChallengeError.value = "";
  if (isDev) return;
  await loadMathChallenge();
  // The altcha-widget was unmounted while formState was 'processing' (v-else hides the form).
  // After setting idle, wait two ticks for ClientOnly to re-render the new widget, then
  // re-attach the statechange listener so the auto-solved payload is captured again.
  await nextTick();
  await nextTick();
  const el = document.querySelector("altcha-widget");
  if (el) {
    el.removeEventListener("statechange", onAltchaStateChange); // guard against double-attach
    el.addEventListener("statechange", onAltchaStateChange);
  }
}

function resetStepErrorLabels() {
  stepErrorLabels.user = "";
  stepErrorLabels.team = "";
  stepErrorLabels.email = "";
}

function getFailedStepStatus(
  key: StepKey,
  errSteps: RegistrationErrorData["steps"],
  failedStep: RegistrationErrorData["failedStep"],
): StepStatus {
  if (errSteps?.[key] === true) return "success";
  if (failedStep === key) return "error";
  return "pending";
}

function onAltchaStateChange(e: Event) {
  const { state, payload } = captchaEventData(e);
  if (state === "verified" && payload) {
    altchaPayload.value = payload;
    captchaError.value = "";
  } else if (state === "unverified" || state === "error" || state === "expired") {
    // Only clear when the widget explicitly resets — not on 'verifying', which fires
    // when the widget re-solves (e.g. after a background-tab resume on mobile) and
    // would wipe an already-captured valid payload.
    altchaPayload.value = "";
  }
}

onMounted(async () => {
  await loadMathChallenge();
  // In dev, the altcha widget refuses to work over plain HTTP (no isSecureContext).
  // Pre-seed a static bypass payload; the server accepts it when appEnv=development.
  if (isDev) {
    altchaPayload.value = btoa(JSON.stringify({ dev: true }));
    return;
  }
  // Wait for <ClientOnly> to render its slot content (two ticks: one for ClientOnly to flip, one for Vue to render)
  await nextTick();
  await nextTick();
  const el = document.querySelector("altcha-widget");
  if (el) {
    el.addEventListener("statechange", onAltchaStateChange);
  }
});

onUnmounted(() => {
  const el = document.querySelector("altcha-widget");
  if (el) el.removeEventListener("statechange", onAltchaStateChange);
});

async function submit() {
  captchaError.value = "";
  mathChallengeError.value = "";

  if (!validateMathChallenge()) return;

  const widgetEl = document.querySelector<HTMLElement & { value?: string | undefined }>("altcha-widget");
  const payload = altchaPayload.value || widgetEl?.value;
  if (!payload) {
    captchaError.value = $t("captcha.required");
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
    mathChallenge: { token: mathChallenge.value.token, answer: mathChallengeAnswer.value },
  };
  submittedEmail.value = form.email;
  newsletterEmail.value = form.email;

  formState.value = "processing";
  processingDone.value = false;
  processingError.value = "";
  resetStepErrorLabels();
  stepStatuses.user = "loading";
  stepStatuses.team = "loading";
  stepStatuses.email = "loading";

  try {
    const result = await $fetch("/api/register-municipality", {
      method: "POST",
      body: RegistrationRequestSchema.parse(submitData),
    });
    stepStatuses.user = result?.steps?.user !== false ? "success" : "error";
    await delay(400);
    stepStatuses.team = result?.steps?.team !== false ? "success" : "error";
    await delay(400);
    stepStatuses.email = result?.steps?.email !== false ? "success" : "error";
    await delay(600);
    processingDone.value = true;
    formState.value = "success";
    emit("success");
  } catch (err) {
    const data = requestErrorData(err);
    const errData = RegistrationErrorSchema.parse(data.data ?? {});
    const errSteps = errData?.steps;
    const failedStep = errData?.failedStep;
    if (failedStep && errData?.errorKey) {
      stepErrorLabels[failedStep] = $translateDynamic(errData.errorKey);
    }

    stepStatuses.user = getFailedStepStatus("user", errSteps, failedStep);
    await delay(300);
    stepStatuses.team = getFailedStepStatus("team", errSteps, failedStep);
    await delay(300);
    stepStatuses.email = getFailedStepStatus("email", errSteps, failedStep);
    await delay(400);
    processingDone.value = true;
    processingError.value = errData?.errorKey
      ? $translateDynamic(errData.errorKey)
      : requestErrorMessage(err, $t("generic.error_try_again"));
  }
}

async function subscribeNewsletter() {
  newsletterError.value = "";
  if (!newsletterEmail.value.trim()) {
    newsletterError.value = $t("newsletter.email.required");
    return;
  }
  newsletterState.value = "subscribing";
  try {
    const result = await $fetch("/api/newsletter-subscribe", {
      method: "POST",
      body: {
        email: newsletterEmail.value.trim(),
        name: [form.firstName, form.lastName].filter(Boolean).join(" ") || undefined,
      } satisfies NewsletterRequest,
    });
    newsletterAlreadySubscribed.value = result.alreadySubscribed;
    newsletterState.value = "success";
  } catch (err) {
    newsletterState.value = "idle";
    newsletterError.value = requestErrorMessage(err, $t("newsletter.subscribe_failed"));
  }
}
</script>

<style scoped>
.fade-down-enter-active {
  transition:
    opacity 0.4s ease,
    transform 0.4s ease;
}
.fade-down-enter-from {
  opacity: 0;
  transform: translateY(-8px);
}
</style>

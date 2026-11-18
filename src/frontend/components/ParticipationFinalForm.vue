<template>
  <form class="participation-final" @submit.prevent="submit">
    <fieldset :disabled="busy || locked">
      <legend class="sr-only">{{ $t("participation.finish.title") }}</legend>
      <div class="grid gap-3 sm:grid-cols-2">
        <label class="participation-mode" :class="{ 'participation-selected': mode === 'personal' }">
          <input
            v-model="mode"
            class="radio radio-sm radio-primary"
            type="radio"
            value="personal"
            :disabled="!options.personalOnboardingAvailable"
          />
          <span
            ><strong>{{ $t("participation.mode.personal") }}</strong
            ><span class="mt-1 block text-xs text-(--slk-text-muted)">{{
              $t("participation.mode.personal_hint")
            }}</span></span
          >
        </label>
        <label class="participation-mode" :class="{ 'participation-selected': mode === 'account' }">
          <input v-model="mode" class="radio radio-sm radio-primary" type="radio" value="account" />
          <span
            ><strong>{{ $t("participation.mode.account") }}</strong
            ><span class="mt-1 block text-xs text-(--slk-text-muted)">{{
              $t("participation.mode.account_hint")
            }}</span></span
          >
        </label>
      </div>
      <p v-if="!options.personalOnboardingAvailable" class="mt-3 text-sm text-(--slk-text-muted)">
        {{ $t("participation.calendar.unconfigured") }}
      </p>
      <div class="mt-7 grid gap-8" :class="{ 'lg:grid-cols-2': mode === 'personal' }">
        <div>
          <div class="grid gap-4 sm:grid-cols-2">
            <label class="participation-label" for="participation-first-name"
              >{{ $t("participation.first_name")
              }}<input
                id="participation-first-name"
                v-model="firstName"
                class="input w-full"
                autocomplete="given-name"
                required
                maxlength="100"
            /></label>
            <label class="participation-label" for="participation-last-name"
              >{{ $t("participation.last_name")
              }}<input
                id="participation-last-name"
                v-model="lastName"
                class="input w-full"
                autocomplete="family-name"
                required
                maxlength="100"
            /></label>
          </div>
          <label class="participation-label mt-4" for="participation-email"
            >{{ $t("participation.email")
            }}<input
              id="participation-email"
              v-model="email"
              class="input w-full"
              type="email"
              autocomplete="email"
              required
              maxlength="254"
          /></label>
          <p class="mt-2 text-xs text-(--slk-text-muted)">
            {{ $t(mode === "personal" ? "participation.email.personal_hint" : "participation.email.account_hint") }}
          </p>
          <div class="mt-6 space-y-4">
            <div v-for="agreement in options.agreements" :key="agreement.id">
              <label class="flex cursor-pointer items-start gap-3 text-sm">
                <input
                  v-model="accepted[agreement.id]"
                  type="checkbox"
                  class="checkbox mt-0.5 shrink-0 checkbox-sm checkbox-primary"
                  required
                />
                <span
                  >{{
                    $t(
                      agreement.type === "terms_of_service"
                        ? "participation.agreement.terms"
                        : "participation.agreement.privacy",
                    )
                  }}
                  <span class="text-xs text-(--slk-text-muted)">{{
                    $t("participation.agreement.version", { ":version": agreement.version })
                  }}</span></span
                >
              </label>
              <details class="mt-2 pl-8 text-sm">
                <summary class="cursor-pointer text-(--slk-text-muted) underline underline-offset-4">
                  {{ $t("participation.agreement.read") }}
                </summary>
                <div
                  class="prose prose-sm mt-3 max-w-none wrap-break-word whitespace-pre-wrap text-(--slk-text)"
                  v-text="agreement.legalText"
                />
              </details>
            </div>
          </div>
        </div>
        <ParticipationCalendar v-if="mode === 'personal'" v-model="start" v-model:time-zone="timeZone" />
      </div>
    </fieldset>
    <div class="mt-6 max-w-md">
      <ClientOnly>
        <altcha-widget
          v-if="!isDev"
          :key="captchaKey"
          ref="captcha"
          challenge="/api/altcha?purpose=register"
          hidefooter
          :language="$locale.slice(0, 2)"
          @statechange="captchaChanged"
        />
      </ClientOnly>
    </div>
    <p v-if="errorCode" role="alert" class="mt-4 text-sm text-error">{{ $t(`participation.error.${errorCode}`) }}</p>
    <div v-if="errorCode === 'duplicate_email'" class="mt-2">
      <a :href="loginUrl" class="link text-sm">{{ $t("participation.login") }}</a>
    </div>
    <a
      v-if="errorCode === 'review_required' || errorCode === 'processing'"
      class="mt-3 inline-block link text-sm"
      href="mailto:info@stadt-land-klima.de"
      >{{ $t("participation.support") }}</a
    >
    <div class="mt-7 flex flex-wrap items-center justify-between gap-4">
      <p class="max-w-sm text-xs text-(--slk-text-muted)">{{ $t("participation.finish.activation") }}</p>
      <CanonicalButton
        type="submit"
        color="bright-green"
        icon-slug="icon_chevron_right"
        :disabled="busy || (mode === 'personal' && !start) || errorCode === 'review_required'"
        :label="
          busy
            ? $t('participation.submitting')
            : $t(mode === 'personal' ? 'participation.submit.personal' : 'participation.submit.account')
        "
      />
    </div>
  </form>
</template>

<script setup lang="ts">
import {
  PARTICIPATION_ERROR_KEYS,
  ParticipationInputSchema,
  ParticipationResultSchema,
  type ParticipationOptions,
  type ParticipationInput,
  type ParticipationResult,
  type ParticipationErrorCode,
  type ParticipationContactDraft,
} from "~/shared/participation";
import { captchaEventData, captchaWidgetValue, requestErrorData } from "~/shared/requestError";
import { z } from "zod";
const props = defineProps<{
  options: ParticipationOptions;
  intent: ParticipationInput["intent"];
  contact: ParticipationContactDraft;
}>();
const emit = defineEmits<{
  complete: [result: ParticipationResult, timeZone: string];
  lock: [value: boolean];
  refreshAgreements: [];
  "update:contact": [value: ParticipationContactDraft];
}>();
const { $t, $locale } = useNuxtApp();
const mode = ref<"personal" | "account">(props.options.personalOnboardingAvailable ? props.contact.mode : "account");
const firstName = ref(props.contact.firstName);
const lastName = ref(props.contact.lastName);
const email = ref(props.contact.email);
const start = ref("");
const timeZone = ref(props.contact.timeZone);
const accepted = reactive<Record<string, boolean>>({ ...props.contact.accepted });
const busy = ref(false);
const locked = ref(false);
const errorCode = ref<ParticipationErrorCode | "">("");
const captcha = ref<HTMLElement | null>(null);
const captchaKey = ref(0);
const proof = ref("");
const isDev = useRuntimeConfig().public.captchaDevBypass;
const loginUrl = `${String(useRuntimeConfig().public.clientDirectusUrl || "/backend").replace(/\/$/, "")}/admin/login`;
let requestId = "";
function captchaChanged(event: Event) {
  const value = captchaEventData(event);
  if (value.state === "verified" && value.payload) proof.value = value.payload;
  else if (["unverified", "error", "expired"].includes(value.state ?? "")) proof.value = "";
}
watch(
  () => props.options.agreements,
  () => {
    for (const key of Object.keys(accepted)) delete accepted[key];
  },
);
watch(mode, () => {
  start.value = "";
  errorCode.value = "";
});
watch(
  [firstName, lastName, email, mode, timeZone, accepted],
  () => {
    emit("update:contact", {
      firstName: firstName.value,
      lastName: lastName.value,
      email: email.value,
      mode: mode.value,
      timeZone: timeZone.value,
      accepted: { ...accepted },
    });
  },
  { deep: true },
);
async function submit() {
  if (busy.value) return;
  const wasLocked = locked.value;
  errorCode.value = "";
  const altcha = isDev ? btoa(JSON.stringify({ dev: true })) : proof.value || captchaWidgetValue(captcha.value);
  if (!altcha) {
    errorCode.value = "captcha";
    return;
  }
  if (!requestId) requestId = crypto.randomUUID();
  const input = ParticipationInputSchema.safeParse({
    requestId,
    email: email.value,
    firstName: firstName.value,
    lastName: lastName.value,
    language: $locale,
    timeZone: timeZone.value,
    intent: props.intent,
    agreements: props.options.agreements.map((agreement) => ({
      id: agreement.id,
      digest: agreement.digest,
      accepted: accepted[agreement.id],
    })),
    mode: mode.value,
    ...(mode.value === "personal" ? { start: start.value } : {}),
  });
  if (!input.success) {
    errorCode.value = "invalid_request";
    return;
  }
  busy.value = true;
  locked.value = true;
  emit("lock", true);
  try {
    const result = ParticipationResultSchema.parse(
      await $fetch("/api/participation/register", {
        method: "POST",
        headers: { "X-SLK-Participation": "1" },
        body: { registration: input.data, altcha },
        retry: 0,
        timeout: 70000,
      }),
    );
    emit("complete", result, timeZone.value);
  } catch (error) {
    const raw = requestErrorData(error);
    const parsed = z.object({ code: z.enum(PARTICIPATION_ERROR_KEYS) }).safeParse(raw.data ?? raw);
    errorCode.value = parsed.success ? parsed.data.code : "unavailable";
    if (
      [
        "duplicate_email",
        "agreements_changed",
        "interests_changed",
        "slot_unavailable",
        "calendar_unavailable",
        "invalid_request",
        "captcha",
      ].includes(errorCode.value) &&
      !(wasLocked && errorCode.value === "captcha")
    ) {
      locked.value = false;
      emit("lock", false);
      requestId = "";
    }
    if (errorCode.value === "agreements_changed" || errorCode.value === "interests_changed") {
      emit("refreshAgreements");
      for (const key of Object.keys(accepted)) delete accepted[key];
    }
    proof.value = "";
    captchaKey.value++;
  } finally {
    busy.value = false;
  }
}
</script>

<style scoped>
.participation-mode {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  border: 1px solid var(--slk-border);
  border-radius: 1rem;
  padding: 1rem;
  background: var(--slk-surface);
  cursor: pointer;
  font-size: 0.875rem;
}
.participation-selected {
  border-color: var(--color-light-green, #afca0b);
  background: color-mix(in srgb, var(--color-light-green, #afca0b) 10%, var(--slk-surface));
}
.participation-label {
  display: grid;
  gap: 0.5rem;
  font-size: 0.8125rem;
  font-weight: 500;
}
fieldset:disabled .participation-mode {
  cursor: default;
}
</style>

<template>
  <div class="elections-flow min-h-screen bg-mild-white px-4 py-12 sm:px-6 lg:px-8">
    <div class="mx-auto max-w-3xl">
      <!-- Header -->
      <div v-if="!submitted" class="mb-12 text-center">
        <ElectionsWahlCheckLogo
          v-if="candidate?.election?.custom_logo"
          :logo="candidate.election.custom_logo"
          fallback="none"
          :alt="$t('logo.alt')"
          logo-class="mx-auto mb-6 h-20 max-w-full object-contain"
        />
        <h1 class="mb-4 text-h1 font-bold text-black">
          {{ $t("elections.theses.title") }}
        </h1>
        <p v-if="localteam" class="mb-2 text-lg text-mid-gray">
          {{ $t("localteam.singular") }}: <span class="font-semibold text-stats-dark">{{ localteam.name }}</span>
        </p>
        <p v-if="candidate" class="flex items-center justify-center gap-2 text-lg text-mid-gray">
          {{ $t(isPartyElection ? "elections.party" : "elections.candidate") }}:
          <span v-if="!isPartyElection" class="font-semibold text-stats-dark">{{ candidate.name }}</span>
          <CandidatePartyLabel :party="candidate.party" :state="candidateState" />
        </p>
      </div>

      <!-- Loading State -->
      <div v-if="pending" class="flex items-center justify-center py-20">
        <span class="loading loading-lg loading-spinner text-primary"></span>
      </div>

      <!-- Error State -->
      <div
        v-else-if="error || !localteam || !candidate"
        class="rounded-lg border border-red bg-solid-red-10 p-6 text-center text-red"
      >
        <p class="mb-2 text-xl font-bold">{{ $t("generic.loading_error") }}</p>
        <p>{{ $t("elections.theses.loading_error.description") }}</p>
      </div>

      <!-- Success State -->
      <div
        v-else-if="submitted"
        class="my-12 rounded-2xl border border-rating-4 bg-rating-4-very-light p-10 text-center text-rating-4 shadow-lg"
      >
        <ElectionsWahlCheckLogo
          v-if="candidate?.election?.custom_logo"
          :logo="candidate.election.custom_logo"
          fallback="none"
          :alt="$t('logo.alt')"
          logo-class="mx-auto mb-8 h-20 max-w-full object-contain"
        />
        <div class="mb-6">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="mx-auto h-20 w-20 text-rating-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h2 class="mb-4 text-3xl font-bold text-black">{{ $t("generic.thank_you") }}</h2>
        <p class="text-xl text-mid-gray">{{ $t("elections.theses.submitted") }}</p>
      </div>

      <!-- Survey Form -->
      <div v-else-if="questions && questions.length > 0" class="space-y-8">
        <div
          v-if="isPastCutoff"
          class="mb-8 rounded-lg border border-orange bg-solid-orange-10 p-6 text-center font-bold text-orange-700"
        >
          {{
            $t("elections.theses.cutoff_reached", {
              ":date": formatBerlinDate(candidate.election.response_cutoff_date, $locale),
            })
          }}
        </div>

        <div
          v-for="(question, index) in questions"
          :key="question.id"
          class="rounded-xl border border-solid-gray-10 bg-white p-6 shadow-list"
        >
          <div class="mb-6 flex items-start">
            <span
              class="mr-4 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-stats-dark font-bold text-white"
            >
              {{ Number(index) + 1 }}
            </span>
            <h3 class="pt-1 text-h3 leading-tight font-semibold text-black">
              {{ question.title || question.thesis }}
            </h3>
          </div>

          <ElectionsQuestionBackgroundInfo
            :content="question.background_information"
            appearance="italic"
            class="mb-4 sm:ml-12"
          />

          <div
            v-if="question.title && question.thesis"
            class="mb-6 rounded-lg border border-solid-light-blue-30 bg-solid-very-light-blue-60 p-4 text-lg text-gray sm:ml-12"
          >
            {{ question.thesis }}
          </div>

          <!-- Rating Scale -->
          <div class="ml-0 sm:ml-12">
            <div
              class="mb-2 grid gap-2"
              :class="{ 'grid-cols-3': isSimpleAnswerMode, 'grid-cols-5': !isSimpleAnswerMode }"
            >
              <div v-for="option in ratingOptions" :key="option.value" class="flex flex-col items-center">
                <input
                  v-model="answers[question.id]"
                  type="radio"
                  :name="'question-' + question.id"
                  :value="option.value"
                  :disabled="isPastCutoff"
                  class="radio h-8 w-8 border-2 sm:h-10 sm:w-10"
                  :class="[option.radioClass, { 'cursor-not-allowed opacity-50': isPastCutoff }]"
                />
              </div>
            </div>
            <div
              class="grid gap-1 text-center text-[8px] font-medium tracking-wider text-mid-gray uppercase sm:text-xs"
              :class="{ 'grid-cols-3': isSimpleAnswerMode, 'grid-cols-5': !isSimpleAnswerMode }"
            >
              <div v-for="option in ratingOptions" :key="option.value">
                {{ option.label }}
              </div>
            </div>
          </div>

          <!-- Reasoning Field -->
          <div class="mt-8 ml-0 sm:ml-12">
            <label :for="'explanation-' + question.id" class="mb-2 block text-sm font-semibold text-stats-dark">
              {{ $t("elections.theses.reasoning_label") }}
            </label>
            <textarea
              :id="'explanation-' + question.id"
              v-model="explanations[question.id]"
              rows="3"
              maxlength="500"
              :disabled="isPastCutoff"
              class="textarea w-full resize-none bg-mild-white text-black transition-all focus:border-stats-dark focus:ring-1 focus:ring-stats-dark"
              :class="{ 'cursor-not-allowed opacity-50': isPastCutoff }"
              :placeholder="$t('elections.theses.reasoning_placeholder')"
            ></textarea>
            <div class="mt-1 flex justify-end text-xs text-mid-gray">
              <span :class="{ 'font-bold text-red': (explanations[question.id]?.length || 0) >= 500 }">
                {{ explanations[question.id]?.length || 0 }}
              </span>
              / 500
            </div>
          </div>
        </div>

        <!-- Submit Button -->
        <div v-if="!isPastCutoff" class="flex flex-col items-center pt-8">
          <button
            :disabled="!isFormComplete || submitting"
            class="btn rounded-full px-12 font-bold text-white shadow-lg transition-all btn-lg btn-primary hover:scale-105 disabled:opacity-50"
            @click="submitAnswers"
          >
            <span v-if="submitting" class="loading loading-spinner"></span>
            {{ $t("generic.confirm") }}
          </button>
          <p v-if="!isFormComplete" class="mt-4 animate-pulse font-medium text-orange">
            {{ $t("elections.theses.answer_all", { ":count": questions.length }) }}
          </p>
        </div>
      </div>

      <!-- No Questions State -->
      <div v-else class="rounded-2xl bg-white p-12 text-center shadow-list">
        <p class="text-xl text-mid-gray">{{ $t("elections.theses.no_published") }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { clientFailure } from "~/shared/securityLog";

import { getWahlcheckAnswerOptions, usesSimpleWahlcheckAnswerMode } from "~/shared/wahlcheckAnswerOptions";
import { formatBerlinDate, getBerlinEndOfDay } from "~/shared/eventDateTime";

import { CandidateReadSchema } from "~/shared/contracts/elections";
import { singleRouteValue } from "~/shared/routeValues";
import type { AnswerValue } from "~/shared/domain";
import { CandidateAnswersRequestSchema } from "~/shared/contracts/candidateAnswers";

const route = useRoute();
const { $t, $locale } = useNuxtApp();
let accessToken = singleRouteValue(route.params.access_token);
if (accessToken && !/^[A-Za-z0-9_-]{1,100}$/.test(accessToken))
  throw createError({ statusCode: 404, statusMessage: "Not found" });
useResponseHeader("Cache-Control").value = "private, no-store";
useResponseHeader("Referrer-Policy").value = "no-referrer";
definePageMeta({ key: (route) => route.path });

const candidateCsrf = ref("");
const answers = ref<Record<string, AnswerValue | null | undefined>>({});
const explanations = ref<Record<string, string>>({}); // Store reasoning for each question
const submitting = ref(false);
const submitted = ref(false);

// Candidate drafts are private browser state, never part of the SSR payload or Nuxt data cache.
const data = shallowRef<import("zod").z.output<typeof CandidateReadSchema> | null>(null);
const pending = ref(true);
const error = shallowRef<unknown>(null);
const candidateRequest = new AbortController();
onBeforeUnmount(() => {
  candidateRequest.abort();
  data.value = null;
});
onMounted(async () => {
  try {
    accessToken ||= new URLSearchParams(window.location.hash.slice(1)).get("token") || undefined;
    // Remove both legacy path tokens and new fragment tokens before any API call.
    window.history.replaceState(window.history.state, "", "/elections/thesen");
    if (accessToken) {
      await $fetch("/api/candidate/session", {
        method: "POST",
        body: { token: accessToken },
        headers: { "x-slk-candidate": "1" },
        signal: candidateRequest.signal,
      });
      accessToken = undefined;
      if (route.params.access_token) {
        await navigateTo("/elections/thesen", { replace: true });
        return;
      }
    }
    const session = await $fetch("/api/candidate/session", { signal: candidateRequest.signal });
    candidateCsrf.value = session.csrf || "";
    const result = CandidateReadSchema.parse(session.data);
    if (candidateRequest.signal.aborted) return;
    for (const answer of result.existingAnswers) {
      answers.value[answer.question] = answer.response;
      explanations.value[answer.question] = answer.explanation || "";
    }
    data.value = result;
  } catch (cause) {
    if (!candidateRequest.signal.aborted) error.value = cause;
  } finally {
    if (!candidateRequest.signal.aborted) pending.value = false;
  }
});

const candidate = computed(() => data.value?.candidate);
const candidateState = computed(() => candidate.value?.election?.localteam?.municipality_id?.state || "");
const localteam = computed(() => candidate.value?.election?.localteam);
const questions = computed(() => data.value?.questions || []);
const isPartyElection = computed(() => candidate.value?.election?.is_party_election === true);
const isSimpleAnswerMode = computed(() => usesSimpleWahlcheckAnswerMode(candidate.value?.election));
const ratingOptions = computed(() => {
  return getWahlcheckAnswerOptions(candidate.value?.election, $t).reverse();
});

const currentTime = ref(Date.now());
let cutoffTimer: number | undefined;

function refreshCutoffStatus() {
  currentTime.value = Date.now();

  const cutoff = getBerlinEndOfDay(candidate.value?.election?.response_cutoff_date);
  if (!cutoff || cutoff.getTime() <= currentTime.value) {
    cutoffTimer = undefined;
    return;
  }

  const maxTimeout = 60 * 60 * 1000;
  const delay = Math.min(cutoff.getTime() - currentTime.value + 1, maxTimeout);
  cutoffTimer = window.setTimeout(refreshCutoffStatus, delay);
}

watch(
  () => candidate.value?.election?.response_cutoff_date,
  () => {
    if (!import.meta.client) return;
    if (cutoffTimer !== undefined) window.clearTimeout(cutoffTimer);
    refreshCutoffStatus();
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  if (cutoffTimer !== undefined) window.clearTimeout(cutoffTimer);
});

const isPastCutoff = computed(() => {
  const cutoff = getBerlinEndOfDay(candidate.value?.election?.response_cutoff_date);
  return cutoff ? currentTime.value > cutoff.getTime() : false;
});

const isFormComplete = computed(() => {
  if (!questions.value || !questions.value.length) return false;
  return questions.value.every((q) => answers.value[q.id] !== undefined && answers.value[q.id] !== null);
});

async function submitAnswers() {
  if (!isFormComplete.value || submitting.value || isPastCutoff.value) return;

  submitting.value = true;
  try {
    const answerPayload = questions.value.map((q) => ({
      question: q.id,
      response: answers.value[q.id],
      explanation: explanations.value[q.id] || undefined,
    }));

    await $fetch("/api/candidate/session/answers", {
      headers: { "x-slk-candidate": "1", "x-csrf-token": candidateCsrf.value },
      method: "POST",
      body: CandidateAnswersRequestSchema.parse({ answers: answerPayload }),
    });

    submitted.value = true;
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (e) {
    clientFailure("app.pages.elections.thesen.__access_token__.submitAnswers.failed", e);
    alert($t("elections.theses.submission_error"));
  } finally {
    submitting.value = false;
  }
}

usePageSeo({
  title: "Thesen-Check - Stadt.Land.Klima",
});
</script>

<style scoped>
.radio:checked {
  background-image: none;
  background-color: currentColor !important;
  border-color: currentColor !important;
}
</style>

<template>
  <div class="elections-flow bg-mild-white" :class="{ 'min-h-screen': !embedded }">
    <!-- Header -->
    <div class="border-b border-solid-gray-10 bg-white shadow-xs">
      <div class="mx-auto max-w-6xl px-4 py-4 text-center">
        <h1 class="text-xl font-bold text-stats-dark">{{ $t("elections.wahlcheck.header_title") }}</h1>
        <p v-if="electionData?.election" class="text-sm text-mid-gray">
          {{ electionData.election.descriptor }}
        </p>
      </div>
    </div>

    <!-- Progress Bar -->
    <div id="wahlcheck-progress-bar" class="scroll-mt-0 bg-solid-ff-green-10 py-3">
      <div class="mx-auto max-w-6xl px-4">
        <div class="flex items-center justify-between">
          <div v-for="(step, index) in steps" :key="step.id" class="flex items-center">
            <div class="flex flex-col items-center">
              <div
                class="flex h-10 w-10 items-center justify-center rounded-full font-bold transition-all duration-300"
                :class="{
                  'bg-ff-green text-white': currentStep >= index + 1,
                  'bg-solid-gray-20 text-solid-gray-50': currentStep < index + 1,
                }"
              >
                {{ currentStep > index + 1 ? "✓" : index + 1 }}
              </div>
              <span class="mt-1 text-xs font-medium whitespace-nowrap text-stats-dark">
                {{ step.label }}
              </span>
            </div>
            <div
              v-if="index < steps.length - 1"
              class="mx-2 h-1 flex-1 rounded-full transition-all duration-300"
              :class="{
                'bg-ff-green': currentStep > index + 1,
                'bg-solid-gray-30': currentStep <= index + 1,
              }"
            ></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="mx-auto max-w-6xl px-4 py-8">
      <!-- Loading State -->
      <div v-if="pending && !error" class="flex items-center justify-center py-20">
        <div class="flex flex-col items-center gap-4">
          <SlkFlowerSpinner class="h-20 w-20 text-ff-green" />
          <p class="text-mid-gray">{{ $t("elections.loading_data") }}</p>
        </div>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="my-12 rounded-xl border border-red bg-solid-red-10 p-8 text-center text-red">
        <h2 class="mb-4 text-2xl font-bold">{{ $t("generic.loading_error") }}</h2>
        <p class="mb-4">{{ errorMessage }}</p>
        <NuxtLink to="/" class="btn btn-primary">{{ $t("generic.back_to_home") }}</NuxtLink>
      </div>

      <!-- Not Found / Not Public -->
      <div
        v-else-if="!electionData?.election"
        class="my-12 rounded-xl border border-orange bg-solid-orange-10 p-8 text-center text-orange-800"
      >
        <h2 class="mb-4 text-2xl font-bold">{{ $t("elections.no_public_election.title") }}</h2>
        <p class="mb-4">
          {{ $t("elections.no_public_election.description") }}
        </p>
        <NuxtLink to="/elections/wahlcheck" class="btn btn-secondary">{{
          $t("elections.back_to_wahlcheck_overview")
        }}</NuxtLink>
      </div>

      <!-- Steps with transition (Requirement 3) -->
      <Transition name="step-fade" mode="out-in">
        <!-- Step 1: Answer Questions -->
        <ElectionsWahlCheckQuestions
          v-if="currentStep === 1 && electionData"
          :key="1"
          :questions="electionData.questions"
          :election="electionData.election"
          :localteam="electionData.localteam"
          :user-answers="userAnswers"
          :initial-question-index="initialQuestionIndex"
          @next="handleQuestionsNext"
          @prev="handlePrev"
        />

        <!-- Step 2: Review Answers & Select Double Weight -->
        <ElectionsWahlCheckSummary
          v-else-if="currentStep === 2 && electionData"
          :key="2"
          :questions="electionData.questions"
          :user-answers="userAnswers"
          :double-weighted-questions="doubleWeightedQuestions"
          :election="electionData.election"
          @next="handleSummaryNext"
          @prev="handlePrev"
          @toggle-double-weight="toggleDoubleWeight"
        />

        <!-- Step 3: View Results -->
        <ElectionsWahlCheckResults
          v-else-if="currentStep === 3 && electionData"
          :key="3"
          :election="electionData.election"
          :candidates="electionData.candidates"
          :questions="electionData.questions"
          :user-answers="userAnswers"
          :double-weighted-questions="doubleWeightedQuestions"
          :candidate-answers="electionData.answers"
          @restart="handleRestart"
          @prev="handlePrev"
        />
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { clientDiagnostic, clientFailure } from "~/shared/securityLog";

import type { WahlcheckCompletionRequest } from "~/shared/contracts/submissions";
import { computed, ref, onMounted, watch } from "vue";
import { useRoute } from "vue-router";

import { routeSlug } from "~/shared/routeValues";
import { checkedWahlcheckState } from "~/shared/contracts/elections";
import type { z } from "zod";
import type { WahlcheckSchema } from "~/shared/contracts/elections";
import type { UserAnswers } from "~/types/components/elections";
const fetchContent = useContentFetch();
withDefaults(defineProps<{ embedded?: boolean }>(), { embedded: false });
const embedScroll = useWahlcheckEmbedScroll();

const route = useRoute();
const { $t } = useNuxtApp();
const municipalitySlug = routeSlug(route.params.municipalitySlug);
if (!municipalitySlug) throw createError({ statusCode: 404, statusMessage: "Not found" });

// Step management
const currentStep = ref(1);
const initialQuestionIndex = ref(0);
const steps = [
  { id: 1, label: $t("elections.wahlcheck.steps.questions") },
  { id: 2, label: $t("elections.wahlcheck.steps.summary") },
  { id: 3, label: $t("elections.wahlcheck.steps.results") },
];

// User data
const userAnswers = ref<UserAnswers>({}); // { questionId: responseValue (0-4) }
const doubleWeightedQuestions = ref(new Set<string>()); // Set of questionIds

// Session storage key
const sessionStorageKey = `wahlcheck_${municipalitySlug}`;
const trackedCompletionIds = new Set<string>();
let completionTrackingPending = false;

function completionStorageKey(electionId: string) {
  return `wahlcheck_completion_tracked_${electionId}`;
}

function wasCompletionTracked(electionId: string) {
  if (trackedCompletionIds.has(electionId)) {
    return true;
  }

  try {
    return sessionStorage.getItem(completionStorageKey(electionId)) === "true";
  } catch {
    return false;
  }
}

function markCompletionTracked(electionId: string) {
  trackedCompletionIds.add(electionId);

  try {
    sessionStorage.setItem(completionStorageKey(electionId), "true");
  } catch {
    // The in-memory guard still prevents duplicates while this page is open.
  }
}

async function trackWahlcheckCompletion() {
  const electionId = electionData.value?.election?.id;
  if (!electionId || completionTrackingPending || wasCompletionTracked(electionId)) {
    return;
  }

  try {
    completionTrackingPending = true;
    await $fetch("/api/wahlcheck-complete", {
      method: "POST",
      body: { electionId } satisfies WahlcheckCompletionRequest,
    });

    markCompletionTracked(electionId);
  } catch {
    clientDiagnostic("app.pages.elections.wahlcheck._municipalitySlug_.trackWahlcheckCompletion.degraded", "warn");
  } finally {
    completionTrackingPending = false;
  }
}

// Load from session storage
function loadFromSessionStorage() {
  try {
    const savedData = sessionStorage.getItem(sessionStorageKey);
    if (savedData) {
      const parsed = checkedWahlcheckState(
        JSON.parse(savedData),
        electionData.value?.election.id ?? "",
        electionData.value?.questions.map((q) => q.id) ?? [],
      );
      if (parsed) {
        userAnswers.value = parsed.answers;
        doubleWeightedQuestions.value = new Set(parsed.doubleWeighted);
      }
    }
  } catch (err) {
    clientFailure("app.pages.elections.wahlcheck._municipalitySlug_.loadFromSessionStorage.failed", err);
  }
}

// Update URL with shareable parameters when answers change
function updateShareableUrl() {
  if (currentStep.value !== 3) {
    return;
  }
  if (typeof window === "undefined") {
    return;
  }

  try {
    // Check if we have election data
    if (!electionData.value?.election?.id) {
      return;
    }

    // Check if we have user answers
    if (Object.keys(userAnswers.value).length === 0) {
      return;
    }

    // Encode user answers and double-weighted questions
    const doubleWeightedArray = Array.from(doubleWeightedQuestions.value);

    const shareData = {
      answers: userAnswers.value,
      doubleWeighted: doubleWeightedArray,
      electionId: electionData.value?.election?.id,
    };

    // Convert to JSON and encode
    const jsonString = JSON.stringify(shareData);
    const encoded = btoa(encodeURIComponent(jsonString));

    // Update URL without reloading
    const newUrl = `${window.location.pathname}?share=${encoded}`;
    window.history.replaceState({}, "", newUrl);
  } catch (error) {
    clientFailure("app.pages.elections.wahlcheck._municipalitySlug_.updateShareableUrl.failed", error);
  }
}

// Check for shared results in URL and load them
function checkForSharedResults() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const urlParams = new URLSearchParams(window.location.search);
    const shareParam = urlParams.get("share");

    if (shareParam && shareParam.length <= 20000 && urlParams.getAll("share").length === 1) {
      try {
        const decoded = decodeURIComponent(atob(shareParam));
        const shareData = checkedWahlcheckState(
          JSON.parse(decoded),
          electionData.value?.election.id ?? "",
          electionData.value?.questions.map((q) => q.id) ?? [],
        );
        if (!shareData) return;

        if (shareData.answers) {
          userAnswers.value = shareData.answers;
        }
        if (shareData.doubleWeighted) {
          doubleWeightedQuestions.value = new Set(shareData.doubleWeighted);
        }

        // Save to session storage as well
        saveToSessionStorage();

        // If we have answers, automatically go to results page
        if (Object.keys(shareData.answers).length > 0) {
          currentStep.value = 3;
        }
      } catch (error) {
        clientFailure("app.pages.elections.wahlcheck._municipalitySlug_.checkForSharedResults.failed", error);
      }
    }
  } catch (error) {
    clientFailure("app.pages.elections.wahlcheck._municipalitySlug_.checkForSharedResults.failed", error);
  }
}

// Save to session storage
function saveToSessionStorage() {
  try {
    const dataToSave = {
      electionId: electionData.value?.election.id,
      answers: userAnswers.value,
      doubleWeighted: Array.from(doubleWeightedQuestions.value),
    };
    sessionStorage.setItem(sessionStorageKey, JSON.stringify(dataToSave));
  } catch (err) {
    clientFailure("app.pages.elections.wahlcheck._municipalitySlug_.saveToSessionStorage.failed", err);
  }
}

// Clear session storage
function clearSessionStorage() {
  try {
    sessionStorage.removeItem(sessionStorageKey);
  } catch (err) {
    clientFailure("app.pages.elections.wahlcheck._municipalitySlug_.clearSessionStorage.failed", err);
  }
}

// Election data
type PublicWahlcheck = z.output<typeof WahlcheckSchema>;
const electionData = ref<
  | (PublicWahlcheck & {
      localteam: PublicWahlcheck["municipality"];
      answers: {
        candidate: string;
        question: string;
        response: 0 | 1 | 2 | 3 | 4 | null;
        explanation: string | null;
      }[];
    })
  | null
>(null);
const pending = ref(true);
const error = ref(false);
const errorMessage = ref("");

// Load election data from server API
async function loadElectionData() {
  pending.value = true;
  error.value = false;
  errorMessage.value = "";

  try {
    const data = await fetchContent(`/api/public/wahlcheck/${municipalitySlug}`);

    electionData.value = {
      ...data,
      election: data.election,
      localteam: data.municipality,
      questions: data.questions || [],
      candidates: data.candidates || [],
      answers:
        data.candidates?.flatMap(
          (c) =>
            c.answers?.map((a) => ({
              candidate: c.id,
              question: a.question,
              response: a.response,
              explanation: a.explanation,
            })) || [],
        ) || [],
    };
  } catch (err) {
    clientFailure("app.pages.elections.wahlcheck._municipalitySlug_.loadElectionData.failed", err);
    error.value = true;
    errorMessage.value = $t("elections.loading_error.description");
  } finally {
    pending.value = false;
  }
}

function scrollToProgress() {
  if (typeof window === "undefined") return;
  const el = document.getElementById("wahlcheck-progress-bar");
  if (el) {
    const targetTop = el.offsetTop || 0;
    if (embedScroll?.(targetTop)) return;
    if (Math.abs(window.scrollY - targetTop) > 10) {
      window.scrollTo({ top: targetTop });
    }
  } else {
    window.scrollTo({ top: 0 });
  }
}

// Handle step navigation
function handleQuestionsNext(answers: UserAnswers) {
  userAnswers.value = { ...answers };
  currentStep.value = 2;
  scrollToProgress();
}

function handleSummaryNext() {
  currentStep.value = 3;
  scrollToProgress();
  void trackWahlcheckCompletion();
  // Update shareable URL when reaching results page
  // Use setTimeout to ensure this runs after the step change is processed
  setTimeout(() => {
    updateShareableUrl();
  }, 50);
}

function handlePrev() {
  if (currentStep.value > 1) {
    if (currentStep.value === 2) {
      // Returning to questions: jump to the last question
      const totalQuestions = electionData.value?.questions?.length || 1;
      initialQuestionIndex.value = Math.max(0, totalQuestions - 1);
    }
    currentStep.value--;
    scrollToProgress();
  }
}

function handleRestart() {
  userAnswers.value = {};
  doubleWeightedQuestions.value = new Set();
  initialQuestionIndex.value = 0;
  currentStep.value = 1;
  clearSessionStorage();
  scrollToProgress();
}

function toggleDoubleWeight(questionId: string) {
  const newSet = new Set(doubleWeightedQuestions.value);
  if (newSet.has(questionId)) {
    newSet.delete(questionId);
  } else {
    newSet.add(questionId);
  }
  doubleWeightedQuestions.value = newSet;
}

// Load data on mount
onMounted(async () => {
  await loadElectionData();
  loadFromSessionStorage();
  checkForSharedResults();
  // Update shareable URL if we're already at step 3 (e.g., page refresh)
  updateShareableUrl();
});

// Update data when route changes
watch(
  () => route.params.municipalitySlug,
  () => {
    void loadElectionData();
  },
);

// Save to session storage and update URL when user data changes
watch(
  [userAnswers, doubleWeightedQuestions],
  () => {
    saveToSessionStorage();
    updateShareableUrl();
  },
  { deep: true },
);

useHead({
  title: computed(() =>
    electionData.value?.election?.descriptor
      ? $t("elections.wahlcheck.head_title_for", { ":descriptor": electionData.value.election.descriptor })
      : $t("elections.wahlcheck.title"),
  ),
});
</script>

<style scoped>
/* Phase Transitions */
.step-fade-enter-active,
.step-fade-leave-active {
  transition:
    opacity 0.3s ease,
    transform 0.3s ease;
}

.step-fade-enter-from {
  opacity: 0;
  transform: translateX(30px);
}

.step-fade-leave-to {
  opacity: 0;
  transform: translateX(-30px);
}

/* Custom scrollbar for the progress bar area */
::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: #f1f1f1;
}

::-webkit-scrollbar-thumb {
  background: #afca0b;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #8a9b0a;
}
</style>

<template>
  <div class="elections-flow min-h-screen bg-mild-white">
    <!-- Header with SLK Branding -->
    <div class="border-b border-solid-gray-10 bg-white shadow-sm">
      <div class="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <NuxtLink to="/" class="flex items-center gap-3">
          <ElectionsWahlCheckLogo
            :logo="electionData?.election?.custom_logo"
            fallback="full"
            :alt="$t('logo.alt')"
            logo-class="h-10 w-auto object-contain"
            fallback-class="h-10 w-auto"
          />
        </NuxtLink>
        <div class="flex-1 text-center">
          <h1 class="text-xl font-bold text-stats-dark">{{ $t("elections.wahlcheck.header_title") }}</h1>
          <p v-if="electionData?.election" class="text-sm text-mid-gray">
            {{ electionData.election.descriptor }}
          </p>
        </div>
        <div class="w-10"></div>
      </div>
    </div>

    <!-- Progress Bar -->
    <div id="wahlcheck-progress-bar" class="bg-solid-ff-green-10 py-3 scroll-mt-0">
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
              <span class="mt-1 whitespace-nowrap text-xs font-medium text-stats-dark">
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
        class="text-orange-800 my-12 rounded-xl border border-orange bg-solid-orange-10 p-8 text-center"
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
          :userAnswers="userAnswers"
          :initial-question-index="initialQuestionIndex"
          @next="handleQuestionsNext"
          @prev="handlePrev"
        />

        <!-- Step 2: Review Answers & Select Double Weight -->
        <ElectionsWahlCheckSummary
          v-else-if="currentStep === 2 && electionData"
          :key="2"
          :questions="electionData.questions"
          :userAnswers="userAnswers"
          :doubleWeightedQuestions="doubleWeightedQuestions"
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
          :userAnswers="userAnswers"
          :doubleWeightedQuestions="doubleWeightedQuestions"
          :candidateAnswers="electionData.answers"
          @restart="handleRestart"
          @prev="handlePrev"
        />
      </Transition>
    </div>

    <!-- Footer -->
    <div class="mt-20">
      <TheFooterDesktop />
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

const route = useRoute();
const router = useRouter();
const { $directus, $readItems, $readItem, $t } = useNuxtApp();
const runtimeConfig = useRuntimeConfig();

const municipalitySlug = route.params.municipalitySlug;

// Step management
const currentStep = ref(1);
const initialQuestionIndex = ref(0);
const steps = [
  { id: 1, label: $t("elections.wahlcheck.steps.questions") },
  { id: 2, label: $t("elections.wahlcheck.steps.summary") },
  { id: 3, label: $t("elections.wahlcheck.steps.results") },
];

// User data
const userAnswers = ref({}); // { questionId: responseValue (0-4) }
const doubleWeightedQuestions = ref(new Set()); // Set of questionIds

// Session storage key
const sessionStorageKey = `wahlcheck_${municipalitySlug}`;
const trackedCompletionIds = new Set();
let completionTrackingPending = false;

function completionStorageKey(electionId) {
  return `wahlcheck_completion_tracked_${electionId}`;
}

function wasCompletionTracked(electionId) {
  if (trackedCompletionIds.has(electionId)) {
    return true;
  }

  try {
    return sessionStorage.getItem(completionStorageKey(electionId)) === "true";
  } catch {
    return false;
  }
}

function markCompletionTracked(electionId) {
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
    const directusUrl = runtimeConfig.public.clientDirectusUrl || "http://127.0.0.1:8081";
    const token = runtimeConfig.public.directusToken;

    await $fetch(`${directusUrl}/election-actions/complete`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: { election_id: electionId },
    });

    markCompletionTracked(electionId);
  } catch (err) {
    console.warn("Could not record Wahlcheck completion:", err);
  } finally {
    completionTrackingPending = false;
  }
}

// Load from session storage
function loadFromSessionStorage() {
  try {
    const savedData = sessionStorage.getItem(sessionStorageKey);
    if (savedData) {
      const parsed = JSON.parse(savedData);
      userAnswers.value = parsed.userAnswers || {};
      doubleWeightedQuestions.value = new Set(parsed.doubleWeightedQuestions || []);
    }
  } catch (err) {
    console.error("Error loading from session storage:", err);
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
    console.error("Error updating shareable URL:", error);
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

    if (shareParam) {
      try {
        const decoded = decodeURIComponent(atob(shareParam));
        const shareData = JSON.parse(decoded);

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
        console.error("Error decoding shared results:", error);
      }
    }
  } catch (error) {
    console.error("Error checking for shared results:", error);
  }
}

// Save to session storage
function saveToSessionStorage() {
  try {
    const dataToSave = {
      userAnswers: userAnswers.value,
      doubleWeightedQuestions: Array.from(doubleWeightedQuestions.value),
    };
    sessionStorage.setItem(sessionStorageKey, JSON.stringify(dataToSave));
  } catch (err) {
    console.error("Error saving to session storage:", err);
  }
}

// Clear session storage
function clearSessionStorage() {
  try {
    sessionStorage.removeItem(sessionStorageKey);
  } catch (err) {
    console.error("Error clearing session storage:", err);
  }
}

// Election data
const electionData = ref(null);
const pending = ref(true);
const error = ref(false);
const errorMessage = ref("");

// Load election data
async function loadElectionData() {
  pending.value = true;
  error.value = false;
  errorMessage.value = "";

  try {
    // Try to find the municipality by slug first
    let municipalities = await $directus.request(
      $readItems("municipalities", {
        filter: {
          slug: { _eq: municipalitySlug },
        },
        fields: ["localteam_id"],
      }),
    );

    let localteams = [];

    // If municipality found by slug, get the localteam_id and find the localteam
    if (municipalities && municipalities.length > 0 && municipalities[0].localteam_id) {
      localteams = await $directus.request(
        $readItems("localteams", {
          filter: {
            id: { _eq: municipalities[0].localteam_id },
          },
          fields: ["*", "municipality_id.*"],
        }),
      );
    }

    // If no localteam found by municipality slug, try to find by localteam slug
    if (!localteams || localteams.length === 0) {
      localteams = await $directus.request(
        $readItems("localteams", {
          filter: {
            slug: { _eq: municipalitySlug },
          },
          fields: ["*", "municipality_id.*"],
        }),
      );
    }

    // If still no localteam found, try to find by ID (in case the parameter is an ID)
    if (!localteams || localteams.length === 0) {
      localteams = await $directus.request(
        $readItems("localteams", {
          filter: {
            id: { _eq: municipalitySlug },
          },
          fields: ["*", "municipality_id.*"],
        }),
      );
    }

    if (!localteams || localteams.length === 0) {
      electionData.value = null;
      pending.value = false;
      return;
    }

    const localteam = localteams[0];

    // Find the most recent public election for this localteam
    const elections = await $directus.request(
      $readItems("elections", {
        filter: {
          localteam: { _eq: localteam.id },
          is_public: { _eq: true },
        },
        sort: ["-date_created"],
        limit: 1,
        fields: ["*"],
      }),
    );

    if (!elections || elections.length === 0) {
      electionData.value = null;
      pending.value = false;
      return;
    }

    const election = elections[0];

    // Load questions for this election
    const questions = await $directus.request(
      $readItems("questions", {
        filter: {
          election: { _eq: election.id },
          status: { _eq: "published" },
        },
        sort: ["date_created"],
        fields: ["*"],
      }),
    );

    // Load all candidates so the results can also identify non-responders.
    const candidates = await $directus.request(
      $readItems("candidate", {
        filter: {
          election: { _eq: election.id },
        },
        fields: ["*"],
      }),
    );

    // Only responding candidates can contribute answers to the comparison.
    const respondingCandidates = (candidates || []).filter((candidate) => candidate.has_answered === true);

    // Load all answers for these candidates
    let allAnswers = [];
    if (respondingCandidates.length > 0 && questions && questions.length > 0) {
      allAnswers = await $directus.request(
        $readItems("answers", {
          filter: {
            candidate: { _in: respondingCandidates.map((candidate) => candidate.id) },
            question: { _in: questions.map((q) => q.id) },
          },
          fields: ["*"],
        }),
      );
    }

    electionData.value = {
      election,
      localteam,
      questions: questions || [],
      candidates: candidates || [],
      answers: allAnswers || [],
    };
  } catch (err) {
    console.error("Error loading election data:", err);
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
    if (Math.abs(window.scrollY - targetTop) > 10) {
      window.scrollTo({ top: targetTop });
    }
  } else {
    window.scrollTo({ top: 0 });
  }
}

// Handle step navigation
function handleQuestionsNext(answers) {
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

function toggleDoubleWeight(questionId) {
  const newSet = new Set(doubleWeightedQuestions.value);
  if (newSet.has(questionId)) {
    newSet.delete(questionId);
  } else {
    newSet.add(questionId);
  }
  doubleWeightedQuestions.value = newSet;
}

// Load data on mount
onMounted(() => {
  loadElectionData();
  loadFromSessionStorage();
  checkForSharedResults();
  // Update shareable URL if we're already at step 3 (e.g., page refresh)
  updateShareableUrl();
});

// Update data when route changes
watch(
  () => route.params.municipalitySlug,
  () => {
    loadElectionData();
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
  transition: opacity 0.3s ease, transform 0.3s ease;
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

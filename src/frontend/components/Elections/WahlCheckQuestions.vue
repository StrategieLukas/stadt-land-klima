<template>
  <div class="space-y-8">
    <!-- Introduction -->
    <div class="rounded-xl border border-solid-gray-10 bg-white p-4 text-center shadow-list sm:p-8">
      <div class="mb-6">
        <ElectionsWahlCheckLogo
          :logo="election?.custom_logo"
          fallback="wahlcheck"
          :alt="$t('elections.wahlcheck.header_title')"
          logo-class="mx-auto h-auto max-h-48 w-auto max-w-full object-contain"
          fallback-class="mx-auto h-auto w-full max-w-lg object-contain"
        />
      </div>
      <h2 class="mb-4 text-xl font-bold text-stats-dark sm:text-2xl">
        {{ $t("elections.wahlcheck.questions.title") }}
      </h2>
      <p class="mx-auto max-w-2xl text-sm text-mid-gray sm:text-base">
        {{
          $t(
            isPartyElection
              ? "elections.wahlcheck.questions.description_parties"
              : "elections.wahlcheck.questions.description",
          )
        }}
      </p>
      <p v-if="localteam" class="mt-4 text-sm text-mid-gray">
        <strong>{{ $t("localteam.singular") }}:</strong> {{ localteam.municipality_name || localteam.name }}
      </p>
      <p class="mt-2 text-xs text-solid-gray-50">
        {{ $t("elections.wahlcheck.questions.skip_hint") }}
      </p>
    </div>

    <!-- Single Question Display with Carousel-like Swipe Animation -->
    <div v-if="currentQuestion" class="space-y-6">
      <div class="relative grid min-h-[320px] grid-cols-1 grid-rows-1 overflow-hidden *:col-start-1 *:row-start-1">
        <Transition :name="transitionDirection">
          <div
            :key="currentQuestion.id"
            class="h-fit w-full self-start rounded-xl border-2 border-ff-green bg-white p-4 shadow-list transition-all sm:p-6"
          >
            <div class="mb-4 flex items-start gap-3 sm:gap-4">
              <span
                class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-stats-dark text-base font-bold text-white sm:h-10 sm:w-10 sm:text-lg"
              >
                {{ currentQuestionIndex + 1 }}
              </span>
              <div class="min-w-0 flex-1">
                <h3 class="text-lg leading-tight font-semibold wrap-break-word hyphens-auto text-black sm:text-xl">
                  {{ currentQuestion.title }}
                </h3>
                <ElectionsQuestionBackgroundInfo
                  :content="currentQuestion.background_information"
                  appearance="italic"
                  class="mt-2 wrap-break-word hyphens-auto"
                />
                <p
                  v-if="currentQuestion.thesis"
                  class="mt-4 rounded-lg border border-solid-light-blue-30 bg-solid-very-light-blue-60 p-3 text-base wrap-break-word hyphens-auto text-gray sm:p-4 sm:text-lg"
                >
                  {{ currentQuestion.thesis }}
                </p>
              </div>
            </div>

            <!-- Rating Scale -->
            <div class="ml-0 sm:ml-12 md:ml-14">
              <div
                class="mb-3 grid gap-2"
                :class="{ 'grid-cols-3': isSimpleAnswerMode, 'grid-cols-5': !isSimpleAnswerMode }"
              >
                <div v-for="option in ratingOptions" :key="option.value" class="flex flex-col items-center">
                  <label
                    class="option-btn relative flex cursor-pointer items-center justify-center rounded-full p-1 transition-transform focus-within:outline-hidden"
                    :class="{ 'sparkle-active': sparklingOption === option.value }"
                    :style="{ '--sparkle-rgb': option.sparkleRgb }"
                  >
                    <input
                      type="radio"
                      :name="'question-' + currentQuestion.id"
                      :value="option.value"
                      :checked="userAnswers[currentQuestion.id] === option.value"
                      class="absolute inset-0 z-10 h-8 w-8 cursor-pointer opacity-0 sm:h-10 sm:w-10"
                      @click="selectOption(currentQuestion.id, option.value)"
                    />
                    <div
                      class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-2 transition-all select-none sm:h-10 sm:w-10"
                      :class="getOptionCircleClass(currentQuestion.id, option.value)"
                    >
                      <span
                        v-if="userAnswers[currentQuestion.id] === option.value"
                        class="text-xs font-bold text-white sm:text-sm"
                        >✓</span
                      >
                    </div>
                  </label>
                </div>
              </div>
              <div
                class="grid gap-1 text-center text-[9px] font-medium tracking-wider text-mid-gray uppercase xs:text-[10px] sm:text-xs"
                :class="{ 'grid-cols-3': isSimpleAnswerMode, 'grid-cols-5': !isSimpleAnswerMode }"
              >
                <div v-for="option in ratingOptions" :key="option.value" class="leading-tight">
                  {{ option.label }}
                </div>
              </div>
            </div>

            <!-- Skip Option -->
            <div class="mt-4 ml-0 sm:ml-12 md:ml-14">
              <label class="flex w-fit cursor-pointer items-center gap-2 text-sm text-mid-gray">
                <input
                  type="checkbox"
                  :checked="!!skippedQuestions[currentQuestion.id]"
                  class="checkbox border-solid-gray-30 checkbox-sm"
                  @change="handleSkipChange(currentQuestion.id, $event)"
                />
                <span>{{ $t("elections.wahlcheck.questions.skip") }}</span>
              </label>
            </div>
          </div>
        </Transition>
      </div>

      <!-- Navigation Buttons (Requirement 1) -->
      <div
        class="mt-6 flex flex-col gap-4 border-t border-solid-gray-10 pt-6 sm:flex-row sm:items-center sm:justify-between"
      >
        <div class="text-center text-xs text-mid-gray sm:text-left sm:text-sm">
          {{
            $t("elections.wahlcheck.questions.answered_count", {
              ":count": completedCount,
              ":total": props.questions.length,
            })
          }}
        </div>
        <div class="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end">
          <button
            type="button"
            :disabled="currentQuestionIndex === 0"
            class="btn flex-1 rounded-full btn-outline px-4 py-2 font-semibold btn-secondary sm:flex-initial sm:px-6"
            :class="{ 'cursor-not-allowed opacity-50': currentQuestionIndex === 0 }"
            @click="handlePrevQuestion"
          >
            {{ $t("generic.back") }}
          </button>
          <button
            type="button"
            :disabled="!canProceedToNext"
            class="btn flex-1 rounded-full px-4 py-2 font-semibold whitespace-nowrap text-white btn-primary sm:flex-initial sm:px-8"
            :class="{ 'cursor-not-allowed opacity-50': !canProceedToNext }"
            @click="handleNextQuestion"
          >
            <span v-if="currentQuestionIndex === props.questions.length - 1">{{
              $t("elections.wahlcheck.questions.to_weighting")
            }}</span>
            <span v-else>{{ $t("elections.wahlcheck.questions.next") }}</span>
          </button>
        </div>
      </div>

      <!-- Question Progress -->
      <div class="mt-6 flex flex-wrap justify-center gap-1.5 sm:gap-2">
        <button
          v-for="(q, idx) in props.questions"
          :key="q.id"
          class="flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-medium transition-all sm:h-8 sm:w-8 sm:text-sm"
          :class="{
            'border-ff-green bg-ff-green text-white': currentQuestionIndex === idx,
            'border-solid-gray-30 bg-white text-gray hover:border-ff-green': currentQuestionIndex !== idx,
            'border-solid-ff-green-30 bg-solid-ff-green-10': completedQuestions.has(q.id),
          }"
          :title="$t('elections.wahlcheck.questions.go_to', { ':number': idx + 1 })"
          @click="selectQuestion(idx)"
        >
          {{ completedQuestions.has(q.id) ? "✓" : idx + 1 }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AnswerValue } from "~/shared/domain";

import type { PropType } from "vue";
import type { ElectionQuestion, Election, UserAnswers } from "~/types/components/elections";

import { ref, computed, watch, onBeforeUnmount } from "vue";
import { getWahlcheckAnswerOptions, usesSimpleWahlcheckAnswerMode } from "~/shared/wahlcheckAnswerOptions";

const props = defineProps({
  questions: {
    type: Array as PropType<ElectionQuestion[]>,
    required: true,
  },
  election: {
    type: Object as PropType<Election | null | undefined>,
    default: null,
  },
  localteam: {
    type: Object as PropType<{ name?: string | undefined; municipality_name?: string | undefined } | null | undefined>,
    default: null,
  },
  userAnswers: {
    type: Object as PropType<UserAnswers | undefined>,
    default: () => ({}),
  },
  initialQuestionIndex: {
    type: Number as PropType<number | undefined>,
    default: 0,
  },
});

const emit = defineEmits<{ next: [answers: UserAnswers]; prev: [] }>();

const { $t } = useNuxtApp();

const isSimpleAnswerMode = computed(() => usesSimpleWahlcheckAnswerMode(props.election));
const isPartyElection = computed(() => props.election?.is_party_election === true);
const ratingOptions = computed(() => {
  return getWahlcheckAnswerOptions(props.election, $t).reverse();
});

const userAnswers = ref({ ...props.userAnswers });
const skippedQuestions = ref<Record<string, boolean>>({});
const currentQuestionIndex = ref(
  Math.min(Math.max(0, props.initialQuestionIndex || 0), Math.max(0, props.questions.length - 1)),
);
const completedQuestions = ref(new Set<string>());
const transitionDirection = ref("slide-left");
const sparklingOption = ref<AnswerValue | null>(null);
let advanceTimeout: ReturnType<typeof setTimeout> | null = null;

// Initialize completed questions based on user answers
props.questions.forEach((question) => {
  if (props.userAnswers[question.id] !== undefined) {
    completedQuestions.value.add(question.id);
  }
});

// Watch initialQuestionIndex prop
watch(
  () => props.initialQuestionIndex,
  (newIdx) => {
    if (typeof newIdx === "number" && props.questions.length > 0) {
      currentQuestionIndex.value = Math.min(Math.max(0, newIdx), props.questions.length - 1);
    }
  },
);

function getOptionCircleClass(questionId: string, value: AnswerValue) {
  const isSelected = userAnswers.value[questionId] === value;
  const option = ratingOptions.value.find((item) => item.value === Number(value));

  if (isSelected) {
    return `${option?.colorClass || "bg-ff-green"} border-transparent text-white shadow-md scale-105`;
  }

  const borderClass = option?.radioClass?.split(" ")[0] || "border-solid-gray-30";
  return `bg-white ${borderClass} hover:bg-solid-gray-05`;
}

function selectOption(questionId: string, value: AnswerValue) {
  userAnswers.value[questionId] = value;
  delete skippedQuestions.value[questionId];
  completedQuestions.value.add(questionId);
  sparklingOption.value = value;

  if (advanceTimeout) {
    clearTimeout(advanceTimeout);
    advanceTimeout = null;
  }

  // 300ms sparkle animation, then begin smooth carousel swipe
  advanceTimeout = setTimeout(() => {
    sparklingOption.value = null;
    if (currentQuestionIndex.value < props.questions.length - 1) {
      transitionDirection.value = "slide-left";
      currentQuestionIndex.value++;
      advanceTimeout = null;
    } else {
      // Last question completed -> proceed directly to weights (Requirement 3)
      advanceTimeout = null;
      handleNext();
    }
  }, 300);
}

// Mark question as completed when answered
function _markQuestionCompleted(questionId: string) {
  completedQuestions.value.add(questionId);
  delete skippedQuestions.value[questionId];

  if (advanceTimeout) {
    clearTimeout(advanceTimeout);
    advanceTimeout = null;
  }

  if (currentQuestionIndex.value < props.questions.length - 1) {
    advanceTimeout = setTimeout(() => {
      transitionDirection.value = "slide-left";
      currentQuestionIndex.value++;
      advanceTimeout = null;
    }, 300);
  } else {
    advanceTimeout = setTimeout(() => {
      advanceTimeout = null;
      handleNext();
    }, 300);
  }
}

// Handle skip checkbox change
function handleSkipChange(questionId: string, event: Event) {
  if (advanceTimeout) {
    clearTimeout(advanceTimeout);
    advanceTimeout = null;
  }
  sparklingOption.value = null;

  const isChecked =
    event?.target instanceof HTMLInputElement ? event.target.checked : skippedQuestions.value[questionId];

  if (isChecked) {
    // Skipping the question
    skippedQuestions.value[questionId] = true;
    userAnswers.value[questionId] = undefined;
    completedQuestions.value.delete(questionId);

    advanceTimeout = setTimeout(() => {
      if (currentQuestionIndex.value < props.questions.length - 1) {
        transitionDirection.value = "slide-left";
        currentQuestionIndex.value++;
        advanceTimeout = null;
      } else {
        advanceTimeout = null;
        handleNext();
      }
    }, 300);
  } else {
    delete skippedQuestions.value[questionId];
    userAnswers.value[questionId] = undefined;
  }
}

// Check if we can proceed (at least one answer given)
const canProceed = computed(() => {
  return Object.keys(userAnswers.value).some((key) => userAnswers.value[key] !== undefined);
});

// Check if we can proceed to next question
const canProceedToNext = computed(() => {
  if (currentQuestionIndex.value === props.questions.length - 1) {
    // On last question, need at least one answer to proceed to summary
    return canProceed.value;
  }
  // For other questions, can always proceed (can skip)
  return true;
});

const completedCount = computed(() => {
  return completedQuestions.value.size;
});

// Get current question
const currentQuestion = computed(() => {
  return props.questions[currentQuestionIndex.value] || props.questions[0];
});

function selectQuestion(idx: number) {
  if (advanceTimeout) {
    clearTimeout(advanceTimeout);
    advanceTimeout = null;
  }
  transitionDirection.value = idx > currentQuestionIndex.value ? "slide-left" : "slide-right";
  currentQuestionIndex.value = idx;
}

// Handle next button for single question navigation
function handleNextQuestion() {
  if (advanceTimeout) {
    clearTimeout(advanceTimeout);
    advanceTimeout = null;
  }

  if (!canProceedToNext.value) return;

  if (currentQuestionIndex.value === props.questions.length - 1) {
    // On last question, proceed to summary
    handleNext();
  } else {
    // Move to next question
    transitionDirection.value = "slide-left";
    currentQuestionIndex.value++;
  }
}

// Handle previous question
function handlePrevQuestion() {
  if (advanceTimeout) {
    clearTimeout(advanceTimeout);
    advanceTimeout = null;
  }

  if (currentQuestionIndex.value > 0) {
    transitionDirection.value = "slide-right";
    currentQuestionIndex.value--;
  }
}

// Handle next button (final submission)
function handleNext() {
  if (advanceTimeout) {
    clearTimeout(advanceTimeout);
    advanceTimeout = null;
  }

  if (!canProceed.value) return;

  // Build clean answers object (only include answered questions, not skipped ones)
  const answers: UserAnswers = {};
  Object.keys(userAnswers.value).forEach((questionId) => {
    if (userAnswers.value[questionId] !== undefined) {
      answers[questionId] = userAnswers.value[questionId];
    }
  });

  emit("next", answers);
}

// Handle form submission
function _handleSubmit() {
  handleNext();
}

// Watch for changes to userAnswers prop and update internal state
watch(
  () => props.userAnswers,
  (newUserAnswers) => {
    // Only update if we're not in the middle of answering questions
    if (Object.keys(newUserAnswers).length > 0 && completedQuestions.value.size === 0) {
      userAnswers.value = { ...newUserAnswers };

      // Update completed questions
      completedQuestions.value.clear();
      props.questions.forEach((question) => {
        if (newUserAnswers[question.id] !== undefined) {
          completedQuestions.value.add(question.id);
        }
      });
    }
  },
  { deep: true },
);

onBeforeUnmount(() => {
  if (advanceTimeout) {
    clearTimeout(advanceTimeout);
  }
});

// Expose userAnswers for parent
defineExpose({
  userAnswers,
});
</script>

<style scoped>
.option-btn {
  border-radius: 9999px;
}

.sparkle-active {
  animation: sparkleRing 0.3s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
}

@keyframes sparkleRing {
  0% {
    box-shadow: 0 0 0 0 rgba(var(--sparkle-rgb), 0.85);
    transform: scale(0.95);
  }
  50% {
    box-shadow: 0 0 0 7px rgba(var(--sparkle-rgb), 0.4);
    transform: scale(1.1);
  }
  100% {
    box-shadow: 0 0 0 12px rgba(var(--sparkle-rgb), 0);
    transform: scale(1);
  }
}

/* Simultaneous Carousel Swipe Transitions */
.slide-left-enter-active,
.slide-left-leave-active,
.slide-right-enter-active,
.slide-right-leave-active {
  transition: transform 0.35s cubic-bezier(0.25, 1, 0.5, 1);
  will-change: transform;
}

.slide-left-enter-from {
  transform: translateX(100%);
}

.slide-left-leave-to {
  transform: translateX(-100%);
}

.slide-right-enter-from {
  transform: translateX(-100%);
}

.slide-right-leave-to {
  transform: translateX(100%);
}
</style>

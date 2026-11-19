<template>
  <div class="space-y-8">
    <!-- Introduction -->
    <div class="mb-8 text-center">
      <div class="mb-6">
        <ElectionsWahlCheckLogo
          :logo="election?.custom_logo"
          fallback="wahlcheck"
          :alt="$t('elections.wahlcheck.header_title')"
          logo-class="mx-auto h-auto max-h-48 w-auto max-w-full object-contain"
          fallback-class="mx-auto h-auto w-full max-w-lg object-contain"
        />
      </div>
      <h2 class="mb-4 font-heading text-2xl font-bold text-stats-dark">
        {{ $t("elections.wahlcheck.questions.title") }}
      </h2>
      <p class="mx-auto max-w-3xl text-base leading-relaxed text-(--slk-text-muted)">
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
      <p class="mt-2 text-xs text-(--slk-text-muted)">
        {{ $t("elections.wahlcheck.questions.skip_hint") }}
      </p>
    </div>

    <!-- Single Question Display with Carousel-like Swipe Animation -->
    <div v-if="currentQuestion" class="space-y-6">
      <div class="question-carousel relative grid grid-cols-1 grid-rows-1 *:col-start-1 *:row-start-1">
        <Transition
          :name="transitionDirection"
          @before-enter="activateQuestion"
          @before-leave="retireQuestion"
          @leave-cancelled="activateQuestion"
        >
          <div
            :key="currentQuestion.id"
            class="question-card w-full self-start border border-(--slk-border) bg-(--slk-surface) p-4 sm:p-6"
          >
            <div
              class="question-content mb-3 flex h-80 items-start gap-3 overflow-y-auto overscroll-contain sm:h-56 sm:gap-4"
              role="region"
              :aria-label="currentQuestion.title || $t('elections.wahlcheck.questions.title')"
              tabindex="0"
            >
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
                  class="mt-4 border-t border-(--slk-border) pt-4 text-base wrap-break-word hyphens-auto text-gray sm:text-lg"
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
                    class="option-btn relative flex cursor-pointer items-center justify-center rounded-full p-1 transition-transform"
                    :class="{ 'sparkle-active': sparklingOption === option.value }"
                    :style="{ '--sparkle-rgb': option.sparkleRgb }"
                  >
                    <input
                      type="radio"
                      :name="'question-' + currentQuestion.id"
                      :value="option.value"
                      :aria-label="option.label"
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
                class="grid gap-1 text-center text-[10px] font-medium text-mid-gray sm:text-xs"
                :class="{ 'grid-cols-3': isSimpleAnswerMode, 'grid-cols-5': !isSimpleAnswerMode }"
              >
                <div
                  v-for="option in ratingOptions"
                  :key="option.value"
                  class="min-w-0 leading-tight wrap-anywhere hyphens-auto"
                >
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
          <CanonicalButton
            data-testid="wahlcheck-questions-prev"
            :disabled="currentQuestionIndex === 0"
            class="flex-1 sm:flex-initial"
            :label="$t('generic.back')"
            icon-slug="mdi:arrow-left"
            :color="isLocalzero ? 'yellow' : 'dark'"
            variant="outline"
            @click="handlePrevQuestion"
          />
          <CanonicalButton
            data-testid="wahlcheck-questions-next"
            :disabled="!canProceedToNext"
            class="flex-1 sm:flex-initial"
            :label="
              $t(
                currentQuestionIndex === props.questions.length - 1
                  ? 'elections.wahlcheck.questions.to_weighting'
                  : 'elections.wahlcheck.questions.next',
              )
            "
            icon-slug="mdi:arrow-right"
            :color="isLocalzero ? 'yellow' : 'bright-green'"
            text-color="white"
            @click="handleNextQuestion"
          />
        </div>
      </div>

      <!-- Question Progress -->
      <div class="mt-6 flex flex-wrap justify-center gap-1.5 sm:gap-2">
        <button
          v-for="(q, idx) in props.questions"
          :key="q.id"
          class="flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-medium transition-all sm:h-8 sm:w-8 sm:text-sm"
          :class="
            currentQuestionIndex === idx
              ? 'border-ff-green bg-ff-green text-white'
              : completedQuestions.has(q.id)
                ? 'border-solid-ff-green-30 bg-solid-ff-green-10 text-gray hover:border-ff-green'
                : 'border-solid-gray-30 bg-white text-gray hover:border-ff-green'
          "
          :aria-current="currentQuestionIndex === idx ? 'step' : undefined"
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
const { isLocalzero } = useWahlcheckTheme();

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
const transitionDirection = ref("question-forward");
const sparklingOption = ref<AnswerValue | null>(null);
let advanceTimeout: ReturnType<typeof setTimeout> | null = null;

function retireQuestion(element: Element) {
  element.setAttribute("inert", "");
  element.setAttribute("aria-hidden", "true");
}

function activateQuestion(element: Element) {
  element.removeAttribute("inert");
  element.removeAttribute("aria-hidden");
}

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
      transitionDirection.value = "question-forward";
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
      transitionDirection.value = "question-forward";
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
        transitionDirection.value = "question-forward";
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
  transitionDirection.value = idx > currentQuestionIndex.value ? "question-forward" : "question-back";
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
    transitionDirection.value = "question-forward";
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
    transitionDirection.value = "question-back";
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

.option-btn:has(input:focus-visible) {
  outline: 2px solid var(--slk-text-strong);
  outline-offset: 2px;
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

.question-carousel {
  overflow: visible;
}

.question-content {
  scrollbar-gutter: stable;
}

.question-content:focus-visible {
  outline: 2px solid var(--slk-text-strong);
  outline-offset: 2px;
}

/* Travel past the viewport edges rather than clipping at the page gutters. */
.question-forward-enter-active,
.question-forward-leave-active,
.question-back-enter-active,
.question-back-leave-active {
  transition: transform 0.35s cubic-bezier(0.25, 1, 0.5, 1);
  will-change: transform;
  pointer-events: none;
}

.question-forward-enter-from,
.question-back-leave-to {
  transform: translateX(100vw);
}

.question-forward-leave-to,
.question-back-enter-from {
  transform: translateX(-100vw);
}

@media (prefers-reduced-motion: reduce) {
  .question-forward-enter-active,
  .question-forward-leave-active,
  .question-back-enter-active,
  .question-back-leave-active {
    transition: none;
  }

  .question-forward-enter-from,
  .question-forward-leave-to,
  .question-back-enter-from,
  .question-back-leave-to {
    transform: none;
  }

  .sparkle-active {
    animation: none;
  }
}
</style>

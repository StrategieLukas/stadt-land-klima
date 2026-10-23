<template>
  <div class="space-y-8">
    <!-- Header -->
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
        {{ $t("elections.wahlcheck.summary.title") }}
      </h2>
      <p class="mx-auto max-w-2xl text-sm text-mid-gray sm:text-base">
        {{ $t("elections.wahlcheck.summary.description") }}
      </p>
      <p v-if="election" class="mt-4 text-sm text-mid-gray">
        <strong>{{ $t("elections.election") }}:</strong> {{ election.descriptor }}
      </p>
    </div>

    <!-- Answers Summary - Clickable List View for Double Weighting -->
    <div class="mx-auto max-w-4xl space-y-2">
      <template v-for="(question, index) in questions" :key="question.id">
        <!-- Answered Question: Full tile clickable for double weighting -->
        <div
          v-if="userAnswers[question.id] !== undefined"
          class="flex cursor-pointer select-none items-center justify-between gap-3 rounded-lg border border-solid-gray-10 bg-white p-3 shadow-sm transition-all hover:border-solid-gray-40 hover:shadow-md sm:gap-4 sm:p-4"
          :class="{
            'border-orange/40 bg-solid-orange-10/20 ring-2 ring-orange': doubleWeightedQuestions.has(question.id),
          }"
          role="button"
          tabindex="0"
          :aria-pressed="doubleWeightedQuestions.has(question.id)"
          @click="handleCardClick(question.id, $event)"
          @keydown.enter.space.prevent="handleCardClick(question.id, $event)"
        >
          <!-- Question Number and Title -->
          <div class="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3">
            <span
              class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-stats-dark text-xs font-bold text-white sm:h-8 sm:w-8 sm:text-sm"
            >
              {{ index + 1 }}
            </span>
            <div class="min-w-0 flex-1">
              <h3 class="hyphens-auto break-words text-sm font-semibold leading-snug text-black sm:text-base">
                {{ question.title }}
              </h3>
            </div>
          </div>

          <!-- Indicators column: Answer score circle + 2x badge -->
          <div class="flex flex-shrink-0 items-center gap-2 sm:gap-3">
            <!-- User's Answer - Color circle indicator -->
            <div class="flex-shrink-0">
              <div
                class="h-7 w-7 rounded-full shadow-md sm:h-8 sm:w-8"
                :class="getRatingColor(userAnswers[question.id])"
                :title="getRatingLabel(userAnswers[question.id])"
              ></div>
            </div>

            <!-- Double Weight Toggle Checkbox (empty when unchecked, orange 2x circle when checked) -->
            <div class="flex h-6 w-6 flex-shrink-0 items-center justify-center">
              <input
                type="checkbox"
                class="weight-toggle-checkbox checkbox-primary checkbox"
                :checked="doubleWeightedQuestions.has(question.id)"
                :aria-label="$t('elections.wahlcheck.results.double_weighted')"
                :title="$t('elections.wahlcheck.results.double_weighted')"
                @change="onCheckboxChange(question.id, $event)"
              />
            </div>
          </div>
        </div>

        <!-- Skipped Question: Non-clickable tile -->
        <div
          v-else
          class="flex items-center justify-between gap-3 rounded-lg border border-solid-gray-10 bg-white p-3 opacity-60 shadow-sm sm:gap-4 sm:p-4"
        >
          <div class="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3">
            <span
              class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-stats-dark text-xs font-bold text-white sm:h-8 sm:w-8 sm:text-sm"
            >
              {{ index + 1 }}
            </span>
            <div class="min-w-0 flex-1">
              <h3 class="hyphens-auto break-words text-sm font-semibold leading-snug text-black sm:text-base">
                {{ question.title }}
              </h3>
            </div>
          </div>

          <div class="flex flex-shrink-0 items-center gap-2 sm:gap-3">
            <div
              class="h-7 w-7 flex-shrink-0 rounded-full bg-solid-gray-20 shadow-md sm:h-8 sm:w-8"
              :title="$t('elections.wahlcheck.questions.skip')"
            ></div>
            <div class="h-6 w-6 flex-shrink-0"></div>
          </div>
        </div>
      </template>
    </div>

    <!-- Warning if all questions are skipped -->
    <div v-if="answeredCount === 0" class="text-orange-700 rounded-xl border border-orange bg-solid-orange-10 p-4">
      <p class="flex items-center gap-2 font-bold">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
          <path
            fill-rule="evenodd"
            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
            clip-rule="evenodd"
          />
        </svg>
        <span>{{ $t("elections.wahlcheck.summary.no_answers_warning_title") }}</span>
      </p>
      <p class="mt-2 text-sm">
        {{
          $t(
            isPartyElection
              ? "elections.wahlcheck.summary.no_answers_warning_description_parties"
              : "elections.wahlcheck.summary.no_answers_warning_description",
          )
        }}
      </p>
    </div>

    <!-- Navigation Buttons (Requirement 1) -->
    <div
      class="mt-8 flex flex-col gap-4 border-t border-solid-gray-10 pt-6 sm:flex-row sm:items-center sm:justify-between"
    >
      <div class="text-center text-xs text-mid-gray sm:text-left sm:text-sm">
        {{
          $t("elections.wahlcheck.summary.answer_count", {
            ":answered": answeredCount,
            ":total": questions.length,
            ":weighted": doubleWeightedCount,
          })
        }}
      </div>
      <div class="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end">
        <button
          type="button"
          class="btn btn-outline btn-secondary flex-1 rounded-full px-4 py-2 font-semibold sm:flex-initial sm:px-6"
          @click="$emit('prev')"
        >
          {{ $t("generic.back") }}
        </button>
        <button
          type="button"
          class="btn btn-primary flex-1 whitespace-nowrap rounded-full px-4 py-2 font-semibold text-white sm:flex-initial sm:px-8"
          @click="$emit('next')"
        >
          {{ $t("elections.wahlcheck.summary.show_results") }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PropType } from "vue";
import type { ElectionQuestion, UserAnswers, Election } from "~/types/components/elections";

import { computed } from "vue";
import { getWahlcheckAnswerLabel, getWahlcheckRatingColor } from "~/shared/wahlcheckAnswerOptions";

const { $t } = useNuxtApp();

const props = defineProps({
  questions: {
    type: Array as PropType<ElectionQuestion[]>,
    required: true,
  },
  userAnswers: {
    type: Object as PropType<UserAnswers>,
    required: true,
  },
  doubleWeightedQuestions: {
    type: Set as PropType<Set<string>>,
    required: true,
  },
  election: {
    type: Object as PropType<Election | null | undefined>,
    default: null,
  },
});

const emit = defineEmits<{ next: []; prev: []; "toggle-double-weight": [questionId: string] }>();
const isPartyElection = computed(() => props.election?.is_party_election === true);

function handleCardClick(questionId: string, event: MouseEvent | KeyboardEvent) {
  if (event && event.target instanceof Element && (event.target.tagName === "INPUT" || event.target.closest("input"))) {
    return;
  }
  if (props.userAnswers[questionId] !== undefined) {
    emit("toggle-double-weight", questionId);
  }
}

function onCheckboxChange(questionId: string, _event: Event) {
  emit("toggle-double-weight", questionId);
}

function getRatingColor(value: unknown) {
  return getWahlcheckRatingColor(value);
}

function getRatingLabel(value: unknown) {
  return getWahlcheckAnswerLabel(value, props.election, $t);
}

// Computed stats
const answeredCount = computed(() => {
  return Object.keys(props.userAnswers).filter((key) => props.userAnswers[key] !== undefined).length;
});

const doubleWeightedCount = computed(() => {
  return props.doubleWeightedQuestions.size;
});

const _skippedCount = computed(() => {
  return props.questions.length - answeredCount.value;
});
</script>

<style scoped>
.weight-toggle-checkbox {
  appearance: none;
  -webkit-appearance: none;
  width: 1.5rem;
  height: 1.5rem;
  min-height: 1.5rem;
  min-width: 1.5rem;
  border-radius: 9999px;
  border: none !important;
  background-color: transparent !important;
  background-image: none !important;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  margin: 0;
  outline: none;
  box-shadow: none;
}

.weight-toggle-checkbox:checked {
  background-color: #f39200 !important;
  background-image: none !important;
  border-color: #f39200 !important;
  box-shadow:
    0 1px 3px 0 rgba(0, 0, 0, 0.1),
    0 1px 2px 0 rgba(0, 0, 0, 0.06);
}

.weight-toggle-checkbox:checked::after {
  content: "2×";
  color: #ffffff;
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>

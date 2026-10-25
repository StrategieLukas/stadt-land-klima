import type { Translator } from "./i18n";
import type { AnswerValue } from "./domain";
import type { TranslationKey } from "./translationKeys";
type ElectionAnswerMode = { simple_answer_mode?: boolean | null | undefined } | null | undefined;
type AnswerOption = {
  value: AnswerValue;
  labelKey: TranslationKey;
  radioClass: string;
  colorClass: string;
  sparkleRgb: string;
};
const DIFFERENTIATED_OPTIONS: AnswerOption[] = [
  {
    value: 0,
    labelKey: "elections.wahlcheck.answer.strongly_against",
    radioClass: "border-rating-0 text-rating-0",
    colorClass: "bg-rating-0",
    sparkleRgb: "227, 6, 19",
  },
  {
    value: 1,
    labelKey: "elections.wahlcheck.answer.somewhat_against",
    radioClass: "border-rating-1 text-rating-1",
    colorClass: "bg-rating-1",
    sparkleRgb: "243, 146, 0",
  },
  {
    value: 2,
    labelKey: "elections.wahlcheck.answer.neutral",
    radioClass: "border-rating-na text-rating-na",
    colorClass: "bg-rating-na",
    sparkleRgb: "157, 157, 156",
  },
  {
    value: 3,
    labelKey: "elections.wahlcheck.answer.somewhat_for",
    radioClass: "border-rating-3 text-rating-3",
    colorClass: "bg-rating-3",
    sparkleRgb: "175, 202, 11",
  },
  {
    value: 4,
    labelKey: "elections.wahlcheck.answer.strongly_for",
    radioClass: "border-rating-4 text-rating-4",
    colorClass: "bg-rating-4",
    sparkleRgb: "70, 150, 43",
  },
];

const SIMPLE_OPTIONS: AnswerOption[] = [
  {
    value: 0,
    labelKey: "elections.wahlcheck.answer.against",
    radioClass: "border-rating-0 text-rating-0",
    colorClass: "bg-rating-0",
    sparkleRgb: "227, 6, 19",
  },
  {
    value: 2,
    labelKey: "elections.wahlcheck.answer.neutral",
    radioClass: "border-rating-na text-rating-na",
    colorClass: "bg-rating-na",
    sparkleRgb: "157, 157, 156",
  },
  {
    value: 4,
    labelKey: "elections.wahlcheck.answer.for",
    radioClass: "border-rating-4 text-rating-4",
    colorClass: "bg-rating-4",
    sparkleRgb: "70, 150, 43",
  },
];

const MAX_ANSWER_DISTANCE = 4;

function translate(t: Translator | undefined, key: TranslationKey) {
  return typeof t === "function" ? t(key) : key;
}

export function usesSimpleWahlcheckAnswerMode(election: ElectionAnswerMode) {
  return election?.simple_answer_mode === true;
}

export function getWahlcheckAnswerOptions(election: ElectionAnswerMode, t?: Translator) {
  const options = usesSimpleWahlcheckAnswerMode(election) ? SIMPLE_OPTIONS : DIFFERENTIATED_OPTIONS;

  return options.map((option) => ({
    ...option,
    label: translate(t, option.labelKey),
  }));
}

export function getWahlcheckRatingColor(value: unknown) {
  const option = [...DIFFERENTIATED_OPTIONS, ...SIMPLE_OPTIONS].find((item) => item.value === Number(value));

  return option?.colorClass || "bg-gray";
}

export function getWahlcheckAnswerLabel(value: unknown, election: ElectionAnswerMode, t?: Translator) {
  const option = getWahlcheckAnswerOptions(election, t).find((item) => item.value === Number(value));

  return option?.label || translate(t, "generic.no_answer");
}

export function normalizeWahlcheckAnswerValue(value: unknown) {
  if (value === null || value === undefined || value === "") return null;

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

export function calculateWahlcheckQuestionScore(userResponse: unknown, candidateResponse: unknown, weight = 1) {
  const userValue = normalizeWahlcheckAnswerValue(userResponse);
  const candidateValue = normalizeWahlcheckAnswerValue(candidateResponse);

  if (userValue === null || candidateValue === null) return null;

  const distance = Math.abs(userValue - candidateValue);
  const points = Math.max(0, MAX_ANSWER_DISTANCE - distance);

  return {
    distance,
    points: points * weight,
    maxPoints: MAX_ANSWER_DISTANCE * weight,
  };
}

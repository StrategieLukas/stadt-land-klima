export const ARTICLE_SUBMISSION_LIMITS = {
  title: 180,
  subtitle: 255,
  municipalityName: 120,
  state: 80,
  abstract: 1_500,
  articleText: 10_000,
  link: 255,
  instagram: 255,
  linkedin: 255,
  imageCredits: 255,
  author: 120,
  submitterEmail: 255,
} as const;

export const ARTICLE_SUBMISSION_MAX_SECTORS = 5;
export const ARTICLE_SUBMISSION_MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const ARTICLE_SUBMISSION_MAX_MULTIPART_BYTES = 7 * 1024 * 1024;

export type ArticleSubmissionTextField = keyof typeof ARTICLE_SUBMISSION_LIMITS;

export type ArticleSubmissionErrorCode =
  | "captcha_failed"
  | "email_invalid"
  | "field_too_long"
  | "image_format"
  | "image_invalid"
  | "image_required"
  | "image_rights_required"
  | "image_too_large"
  | "invalid_submission"
  | "required_fields"
  | "save_failed"
  | "sectors_invalid"
  | "sectors_required"
  | "sectors_too_many"
  | "service_unavailable"
  | "state_invalid"
  | "submission_too_large"
  | "url_invalid"
  | "url_too_long";

export type ArticleSubmissionErrorData = {
  errorCode: ArticleSubmissionErrorCode;
  field?: ArticleSubmissionTextField;
  maxLength?: number;
  maxSectors?: number;
  maxSizeMb?: number;
};

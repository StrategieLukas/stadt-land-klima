/** Expected editorial preconditions are rejections, not broken server functionality. */
export class ActionValidationError extends Error {
  readonly status = 422;
}

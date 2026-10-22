/** Browser-safe narrowing of Nuxt/ofetch failures; never reflect request headers or tokens. */
export function requestErrorData(error: unknown): Record<string, unknown> {
  if (
    error &&
    typeof error === "object" &&
    "data" in error &&
    error.data &&
    typeof error.data === "object" &&
    !Array.isArray(error.data)
  )
    return error.data as Record<string, unknown>;
  return {};
}
export function requestErrorMessage(error: unknown, fallback: string): string {
  const data = requestErrorData(error);
  return typeof data.message === "string" && data.message ? data.message : fallback;
}

export function captchaEventData(event: Event): { state?: string; payload?: string } {
  const detail: unknown = (event as CustomEvent<unknown>).detail;
  if (!detail || typeof detail !== "object") return {};
  return {
    state: "state" in detail && typeof detail.state === "string" ? detail.state : undefined,
    payload: "payload" in detail && typeof detail.payload === "string" ? detail.payload : undefined,
  };
}

/** Legacy ALTCHA widgets expose a value; newer widgets deliver it in statechange. */
export function captchaWidgetValue(widget: unknown): string {
  return widget && typeof widget === "object" && "value" in widget && typeof widget.value === "string"
    ? widget.value : "";
}

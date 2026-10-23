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
    ...("state" in detail && typeof detail.state === "string" ? { state: detail.state } : {}),
    ...("payload" in detail && typeof detail.payload === "string" ? { payload: detail.payload } : {}),
  };
}

/** Legacy ALTCHA widgets expose a value; newer widgets deliver it in statechange. */
export function captchaWidgetValue(widget: unknown): string {
  return widget && typeof widget === "object" && "value" in widget && typeof widget.value === "string"
    ? widget.value
    : "";
}

export function requestErrorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  if ("status" in error && typeof error.status === "number") return error.status;
  if ("statusCode" in error && typeof error.statusCode === "number") return error.statusCode;
  if (
    "response" in error &&
    error.response &&
    typeof error.response === "object" &&
    "status" in error.response &&
    typeof error.response.status === "number"
  )
    return error.response.status;
  return undefined;
}

export function errorRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
export function directusErrorDetails(error: unknown) {
  const record = errorRecord(error);
  const response = errorRecord(record.response);
  const payloads = [errorRecord(record.data), errorRecord(response._data), errorRecord(response.data)];
  const errors = payloads.flatMap(payload => Array.isArray(payload.errors) ? payload.errors as unknown[] : []);
  return errors.map(value => {
    const item = errorRecord(value);
    const extensions = errorRecord(item.extensions);
    return {code: typeof extensions.code === "string" ? extensions.code : "",
      message: typeof item.message === "string" ? item.message : ""};
  });
}

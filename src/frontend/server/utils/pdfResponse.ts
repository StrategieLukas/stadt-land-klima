import { createError } from "h3";

/** Native forms open a real PDF document URL so the browser retains inline headers and filenames. */
export function pdfRequestBody(input: unknown): unknown {
  if (input && typeof input === "object" && !Array.isArray(input) && "request" in input) {
    if (Object.keys(input).length !== 1 || typeof input.request !== "string" || input.request.length > 1_000_000)
      throw createError({ statusCode: 400, statusMessage: "Invalid PDF request" });
    try {
      return JSON.parse(input.request) as unknown;
    } catch {
      throw createError({ statusCode: 400, statusMessage: "Invalid PDF request" });
    }
  }
  return input;
}

/** Forward only the checked inline filename contract, never arbitrary upstream response headers. */
export function pdfResponseDisposition(value: string | null): string {
  return value &&
    /^inline; filename="[a-zA-Z0-9_.-]+\.pdf"; filename\*=UTF-8''(?:[a-zA-Z0-9_.~-]|%[a-fA-F0-9]{2})+$/.test(value)
    ? value
    : 'inline; filename="StadtLandKlima.pdf"';
}

export function formatProjectDate(value: string | Date | null | undefined, locale: string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return date instanceof Date && Number.isFinite(date.getTime()) ? date.toLocaleDateString(locale) : "";
}

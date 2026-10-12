export function formatProjectDate(date: Date | null | undefined, locale: string): string {
  return date instanceof Date && Number.isFinite(date.getTime()) ? date.toLocaleDateString(locale) : '';
}

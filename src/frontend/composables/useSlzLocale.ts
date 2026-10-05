export function useSlzLocale() {
  function t(dict: Record<string, string> | undefined | null): string {
    if (!dict) return ''
    return dict['de-DE'] || dict['en-US'] || Object.values(dict)[0] || ''
  }

  return { t }
}

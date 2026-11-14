/** The optional palette is local to the Wahlcheck, never a stored site preference. */
export function useWahlcheckTheme() {
  const route = useRoute();
  const isLocalzero = computed(() => route.query.theme === "localzero");
  useHead(() => ({
    link: isLocalzero.value ? [{ rel: "stylesheet", href: "/wahlcheck/localzero.css" }] : [],
  }));
  const wahlcheckTheme = computed(() => (isLocalzero.value ? "localzero" : undefined));
  const wahlcheckQuery = computed(() => (isLocalzero.value ? { theme: "localzero" } : {}));
  return { isLocalzero, wahlcheckTheme, wahlcheckQuery };
}

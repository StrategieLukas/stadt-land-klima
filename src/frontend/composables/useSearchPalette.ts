export function useSearchPalette() {
  const isOpen = useState<boolean>("search-open", () => false);
  const query = useState<string>("search-query", () => "");
  const embeddedInput = useState<boolean>("search-embedded", () => false);
  const navigationDropdownOpen = useState<boolean>("header-navigation-dropdown-open", () => false);
  const isVisible = computed(() => isOpen.value && !navigationDropdownOpen.value);
  function activate(embedded: boolean) {
    navigationDropdownOpen.value = false;
    embeddedInput.value = embedded;
    isOpen.value = true;
  }
  function close() {
    isOpen.value = false;
    navigationDropdownOpen.value = false;
  }
  function clearQuery() {
    query.value = "";
  }
  return {
    isOpen,
    query,
    embeddedInput,
    navigationDropdownOpen,
    isVisible,
    open(this: void) {
      activate(false);
    },
    openEmbedded(this: void) {
      activate(true);
    },
    close,
    clearQuery,
    toggle(this: void) {
      if (isOpen.value) close();
      else activate(false);
    },
  };
}

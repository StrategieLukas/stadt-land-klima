export function useSearchPalette() {
  const isOpen = useState<boolean>("search-open", () => false);
  const query = useState<string>("search-query", () => "");
  const embeddedInput = useState<boolean>("search-embedded", () => false);
  return {
    isOpen,
    query,
    embeddedInput,
    open() {
      query.value = "";
      embeddedInput.value = false;
      isOpen.value = true;
    },
    openEmbedded() {
      query.value = "";
      embeddedInput.value = true;
      isOpen.value = true;
    },
    close() {
      isOpen.value = false;
      embeddedInput.value = false;
      query.value = "";
    },
    toggle() {
      isOpen.value = !isOpen.value;
    },
  };
}

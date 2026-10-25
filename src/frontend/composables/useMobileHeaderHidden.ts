export function useMobileHeaderHidden() {
  return useState<boolean>("mobile-header-hidden", () => false);
}

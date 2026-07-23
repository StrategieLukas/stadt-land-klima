const CARTO_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank">CARTO</a>';

export function useCartoBasemap() {
  const { isDark } = useTheme();

  const tileUrl = computed(() =>
    isDark.value
      ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
  );

  return {
    attribution: CARTO_ATTRIBUTION,
    subdomains: "abcd",
    tileUrl,
  };
}

const CARTO_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank">CARTO</a>';

export function cartoBasemapProxyUrl(url: string) {
  const match = /^https:\/\/(?:[a-d]\.|tiles\.)?basemaps\.cartocdn\.com(\/[^?#]+)(?:\?[^#]*)?$/.exec(url);
  return match ? `/api/carto-basemap?asset=${encodeURIComponent(match[1])}` : url;
}

export function useCartoBasemap() {
  const { isDark } = useTheme();

  const tileUrl = computed(() =>
    isDark.value
      ? "/api/carto-basemap?asset=/dark_all/{z}/{x}/{y}{r}.png"
      : "/api/carto-basemap?asset=/light_all/{z}/{x}/{y}{r}.png",
  );

  return {
    attribution: CARTO_ATTRIBUTION,
    subdomains: "abcd",
    tileUrl,
  };
}

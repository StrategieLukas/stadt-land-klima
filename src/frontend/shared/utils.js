export function buildLocationString(municipality_name, state) {
    if (municipality_name && state) {
        return `${municipality_name}, ${state}`;
    }
    if (municipality_name) {
        return municipality_name;
    }
    if (state) {
        return state;
    }
    return '';
}

export function toAssetUrl(asset_id) {
    const config = useRuntimeConfig();
    return `${config.public.clientDirectusUrl}/assets/${asset_id}`;
};

/**
 * @param {string} dateString
 * @returns {string} Properly formatted date and time
 */
export function formatLastUpdated(dateString, locale) {
  const lastUpdatedAt = new Date(dateString);
  return `${lastUpdatedAt.toLocaleDateString(locale, {
    year: "numeric",
    month: "2-digit",
    day: "numeric",
  })}, ${lastUpdatedAt.toLocaleTimeString(locale)}`;
};

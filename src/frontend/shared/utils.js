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

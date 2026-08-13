type DirectusApi = {
  defaults?: {
    baseURL?: string;
  };
};

/**
 * Build a URL relative to the Directus API base configured by the Data Studio.
 * The injected API client's baseURL includes the path from PUBLIC_URL, such as
 * `/backend` on staging.
 */
export function directusUrl(api: DirectusApi | null | undefined, path: string): string {
  const baseUrl = api?.defaults?.baseURL?.replace(/\/+$/, '') ?? '';
  return `${baseUrl}/${path.replace(/^\/+/, '')}`;
}

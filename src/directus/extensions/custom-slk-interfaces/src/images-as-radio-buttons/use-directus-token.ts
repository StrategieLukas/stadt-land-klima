interface DirectusApi {
  defaults?: {
    headers?: {
      Authorization?: string;
      common?: {
        Authorization?: string;
      };
    };
  };
}

export interface DirectusTokenUtils {
  addQueryToPath: (path: string, query: Record<string, string>) => string;
  getToken: () => string | null;
  addTokenToURL: (url: string) => string;
}

export default function useDirectusToken(directusApi: DirectusApi): DirectusTokenUtils {
  function addQueryToPath(path: string, query: Record<string, string>): string {
    const queryParams: string[] = [];

    for (const [key, value] of Object.entries(query)) {
      queryParams.push(`${key}=${value}`);
    }

    return path.includes('?')
      ? `${path}&${queryParams.join('&')}`
      : `${path}?${queryParams.join('&')}`;
  }

  function getToken(): string | null {
    return (
      directusApi.defaults?.headers?.['Authorization']?.split(' ')[1] ||
      directusApi.defaults?.headers?.common?.['Authorization']?.split(' ')[1] ||
      null
    );
  }

  function addTokenToURL(url: string): string {
    const accessToken = getToken();
    if (!accessToken) return url;
    return addQueryToPath(url, {
      access_token: accessToken,
    });
  }

  return {
    addQueryToPath,
    getToken,
    addTokenToURL,
  };
}

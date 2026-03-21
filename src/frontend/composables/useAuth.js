/**
 * Authentication Composable
 *
 * Provides login, logout, refresh, and session management
 * using the Directus authentication API.
 */

import { createDirectus, rest, authentication, readMe } from '@directus/sdk';
import { useAuthStore } from '~/stores/auth';

export function useAuth() {
  const config = useRuntimeConfig();
  const authStore = useAuthStore();

  function createAuthClient() {
    const baseUrl = process.client
      ? config.public.clientDirectusUrl
      : config.public.serverDirectusUrl;

    return createDirectus(baseUrl || 'http://localhost:8055')
      .with(rest())
      .with(authentication('json'));
  }

  async function login(email, password) {
    authStore.setLoading(true);
    authStore.setError(null);

    try {
      const client = createAuthClient();
      const authResult = await client.login(email, password);

      if (!authResult?.access_token) {
        throw new Error('No access token received');
      }

      // Fetch user details with role
      const userClient = createDirectus(
        process.client ? config.public.clientDirectusUrl : config.public.serverDirectusUrl
      )
        .with(rest())
        .with(authentication('json'));

      userClient.setToken(authResult.access_token);

      const user = await userClient.request(
        readMe({
          fields: [
            'id',
            'first_name',
            'last_name',
            'email',
            'avatar',
            { role: ['id', 'name', 'admin_access', 'app_access'] },
          ],
        })
      );

      authStore.setAuth(
        authResult.access_token,
        authResult.refresh_token,
        user
      );

      return { success: true, user };
    } catch (err) {
      const message = parseDirectusError(err);
      authStore.setError(message);
      throw new Error(message);
    } finally {
      authStore.setLoading(false);
    }
  }

  async function logout() {
    authStore.setLoading(true);

    try {
      if (authStore._refreshToken.value) {
        try {
          const client = createAuthClient();
          await client.logout();
        } catch (e) {
          console.warn('Logout request failed:', e);
        }
      }
    } finally {
      authStore.clearAuth();
      authStore.setLoading(false);
    }
  }

  async function refresh() {
    const refreshToken = authStore._refreshToken.value;

    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const client = createAuthClient();
      const result = await client.refresh('json', refreshToken);

      if (!result?.access_token) {
        throw new Error('Token refresh failed');
      }

      authStore.setAuth(
        result.access_token,
        result.refresh_token,
        authStore.user.value
      );

      return result.access_token;
    } catch (err) {
      authStore.clearAuth();
      throw err;
    }
  }

  async function initialize() {
    if (authStore.isInitialized.value) return;

    const hydrated = authStore.hydrateFromStorage();

    if (hydrated && authStore._accessToken.value) {
      try {
        const client = createDirectus(
          process.client ? config.public.clientDirectusUrl : config.public.serverDirectusUrl
        )
          .with(rest())
          .with(authentication('json'));

        client.setToken(authStore._accessToken.value);

        const user = await client.request(
          readMe({
            fields: [
              'id',
              'first_name',
              'last_name',
              'email',
              { role: ['id', 'name'] },
            ],
          })
        );

        authStore.setAuth(
          authStore._accessToken.value,
          authStore._refreshToken.value,
          user
        );
      } catch (err) {
        try {
          await refresh();
        } catch (refreshErr) {
          authStore.clearAuth();
        }
      }
    }

    authStore.setInitialized(true);
  }

  function getAuthenticatedClient() {
    const baseUrl = process.client
      ? config.public.clientDirectusUrl
      : config.public.serverDirectusUrl;

    const client = createDirectus(baseUrl)
      .with(rest())
      .with(authentication('json'));

    if (authStore._accessToken.value) {
      client.setToken(authStore._accessToken.value);
    }

    return client;
  }

  function parseDirectusError(error) {
    if (error?.errors?.[0]?.message) {
      const msg = error.errors[0].message;

      if (msg.includes('Invalid user credentials')) {
        return 'Invalid email or password';
      }
      if (msg.includes('Token expired')) {
        return 'Session expired. Please login again.';
      }

      return msg;
    }

    return error?.message || 'An unexpected error occurred';
  }

  return {
    login,
    logout,
    refresh,
    initialize,
    getAuthenticatedClient,

    isAuthenticated: authStore.isAuthenticated,
    isLoading: authStore.isLoading,
    error: authStore.error,
    user: authStore.user,
  };
}

export default useAuth;

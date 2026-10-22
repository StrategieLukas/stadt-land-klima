/**
 * Authentication Composable
 *
 * Provides login, logout, refresh, and session management
 * using the Directus authentication API.
 */

import type { CoreSchema } from "@directus/sdk";
import type { EditorCmsSchema } from "~/types/editorCms";
import {
  createDirectus,
  rest,
  authentication,
  readMe,
  refresh as refreshRequest,
  logout as logoutRequest,
} from "@directus/sdk";
import { serviceBaseUrl } from "~/shared/serviceUrl";
import { useAuthStore } from "~/stores/auth";
import { AuthUserSchema, authErrorMessage } from "~/shared/contracts/auth";

let initialization: Promise<void> | undefined;

export function useAuth() {
  const config = useRuntimeConfig();
  const authStore = useAuthStore();

  function createAuthClient() {
    const baseUrl = import.meta.client ? config.public.clientDirectusUrl : config.directusServerUrl;

    return createDirectus<CoreSchema<object>>(serviceBaseUrl(baseUrl, "http://localhost:8055"))
      .with(rest())
      .with(authentication("json"));
  }

  async function login({ email, password }: { email: string; password: string }) {
    if (import.meta.server) throw new Error("Authentication sessions are browser-only");
    authStore.setLoading(true);
    authStore.setError(null);

    try {
      const client = createAuthClient();
      const authResult = await client.login({ email, password });

      if (!authResult.access_token) {
        throw new Error("No access token received");
      }

      // Fetch user details with role
      const userClient = createDirectus<CoreSchema<object>>(
        serviceBaseUrl(
          import.meta.client ? config.public.clientDirectusUrl : config.directusServerUrl,
          "http://localhost:8055",
        ),
      )
        .with(rest())
        .with(authentication("json"));

      await userClient.setToken(authResult.access_token);

      const user = await userClient.request(
        readMe({
          fields: ["id", "first_name", "last_name", "email", "avatar", { role: ["id", "name"] }],
        }),
      );

      authStore.setAuth(authResult.access_token, authResult.refresh_token, AuthUserSchema.parse(user));

      return { success: true, user: AuthUserSchema.parse(user) };
    } catch (err) {
      const message = authErrorMessage(err);
      authStore.setError(message);
      throw new Error(message, { cause: err });
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
          await client.request(logoutRequest({ mode: "json", refresh_token: authStore._refreshToken.value }));
        } catch {
          console.warn("Logout request failed");
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
      throw new Error("No refresh token available");
    }

    try {
      const client = createAuthClient();
      const result = await client.request(refreshRequest({ mode: "json", refresh_token: refreshToken }));

      if (!result.access_token) {
        throw new Error("Token refresh failed");
      }

      if (authStore._refreshToken.value !== refreshToken) throw new Error("Session changed during refresh");
      authStore.setAuth(result.access_token, result.refresh_token, authStore.user.value);

      return result.access_token;
    } catch (err) {
      if (authStore._refreshToken.value === refreshToken) authStore.clearAuth();
      throw err;
    }
  }

  async function initializeSession() {
    if (import.meta.server || authStore.isInitialized.value) return;

    const hydrated = authStore.hydrateFromStorage();

    const storedAccessToken = authStore._accessToken.value;
    if (hydrated && storedAccessToken) {
      try {
        const client = createDirectus<CoreSchema<object>>(
          serviceBaseUrl(
            import.meta.client ? config.public.clientDirectusUrl : config.directusServerUrl,
            "http://localhost:8055",
          ),
        )
          .with(rest())
          .with(authentication("json"));

        await client.setToken(storedAccessToken);

        const user = await client.request(
          readMe({
            fields: ["id", "first_name", "last_name", "email", { role: ["id", "name"] }],
          }),
        );

        // In v11, admin_access and app_access are on the user object directly from policies
        // No longer need to request them from role

        if (authStore._accessToken.value === storedAccessToken) {
          authStore.setAuth(storedAccessToken, authStore._refreshToken.value, AuthUserSchema.parse(user));
        }
      } catch {
        if (authStore._accessToken.value === storedAccessToken) {
          try {
            await refresh();
          } catch {
            /* Refresh clears only the failed session. */
          }
        }
      }
    }

    authStore.setInitialized(true);
  }

  async function initialize() {
    if (import.meta.server || authStore.isInitialized.value) return;
    initialization ??= initializeSession().finally(() => {
      initialization = undefined;
    });
    await initialization;
  }

  function getAuthenticatedClient<Schema extends object = EditorCmsSchema>() {
    const baseUrl = import.meta.client ? config.public.clientDirectusUrl : config.directusServerUrl;

    const client = createDirectus<Schema>(serviceBaseUrl(baseUrl, "http://localhost:8055"))
      .with(rest())
      .with(authentication("json"));

    if (authStore._accessToken.value) {
      void client.setToken(authStore._accessToken.value);
    }

    return client;
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
    accessToken: authStore._accessToken,
  };
}

export default useAuth;

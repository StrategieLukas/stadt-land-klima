import { ref, computed, readonly } from "vue";
import { AuthSessionSchema, type AuthUser } from "~/shared/contracts/auth";

/** Credentials are browser-only. Server calls always get a fresh anonymous store. */
function createStore() {
  const user = ref<AuthUser | null>(null);
  const accessToken = ref<string | null>(null);
  const refreshToken = ref<string | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const isInitialized = ref(false);
  const isAuthenticated = computed(() => !!user.value && !!accessToken.value);
  function clearAuth() {
    accessToken.value = null;
    refreshToken.value = null;
    user.value = null;
    error.value = null;
    if (import.meta.client) {
      try {
        localStorage.removeItem("slk_auth");
      } catch {
        /* Storage may be disabled. */
      }
    }
  }
  function setAuth(token: string, refresh: string | null | undefined, nextUser: AuthUser | null) {
    if (!import.meta.client) throw new Error("Authentication sessions are browser-only");
    const session = AuthSessionSchema.parse({ accessToken: token, refreshToken: refresh, user: nextUser });
    accessToken.value = session.accessToken;
    refreshToken.value = session.refreshToken ?? null;
    user.value = session.user;
    error.value = null;
    try {
      localStorage.setItem("slk_auth", JSON.stringify(session));
    } catch {
      /* In-memory login still works. */
    }
  }
  function hydrateFromStorage(): boolean {
    if (!import.meta.client) return false;
    try {
      const stored = localStorage.getItem("slk_auth");
      if (!stored) return false;
      if (stored.length > 65536) {
        clearAuth();
        return false;
      }
      const parsed = AuthSessionSchema.safeParse(JSON.parse(stored) as unknown);
      if (!parsed.success) {
        clearAuth();
        return false;
      }
      accessToken.value = parsed.data.accessToken;
      refreshToken.value = parsed.data.refreshToken ?? null;
      user.value = parsed.data.user;
      return true;
    } catch {
      clearAuth();
      return false;
    }
  }
  return {
    user: readonly(user),
    isLoading: readonly(isLoading),
    error: readonly(error),
    isInitialized: readonly(isInitialized),
    isAuthenticated,
    setAuth,
    clearAuth,
    hydrateFromStorage,
    setError: (value: string | null) => {
      error.value = value;
    },
    setLoading: (value: boolean) => {
      isLoading.value = value;
    },
    setInitialized: (value: boolean) => {
      isInitialized.value = value;
    },
    _accessToken: accessToken,
    _refreshToken: refreshToken,
  };
}
let browserStore: ReturnType<typeof createStore> | undefined;
export function useAuthStore() {
  if (import.meta.server) return createStore();
  return (browserStore ??= createStore());
}
export default useAuthStore;

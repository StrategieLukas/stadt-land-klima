import { ref, computed, readonly } from "vue";
import { AuthUserSchema, type AuthUser } from "~/shared/contracts/auth";

/** Browser state contains identity and CSRF metadata only. Credentials stay server-side. */
function createStore() {
  const user = ref<AuthUser | null>(null),
    csrf = ref("");
  const isLoading = ref(false),
    error = ref<string | null>(null),
    isInitialized = ref(false);
  const generation = ref(0);
  const isAuthenticated = computed(() => Boolean(user.value && csrf.value));
  function retireLegacyStorage() {
    if (import.meta.client)
      try {
        localStorage.removeItem("slk_auth");
      } catch {
        /* Storage may be disabled. */
      }
  }
  function clearAuth() {
    generation.value++;
    user.value = null;
    csrf.value = "";
    error.value = null;
    retireLegacyStorage();
  }
  function setSession(nextUser: AuthUser, token: string) {
    if (!import.meta.client) throw new Error("Authentication sessions are browser-only");
    user.value = AuthUserSchema.parse(nextUser);
    csrf.value = token;
    generation.value++;
    error.value = null;
    retireLegacyStorage();
  }
  return {
    user: readonly(user),
    csrf: readonly(csrf),
    generation: readonly(generation),
    isLoading: readonly(isLoading),
    error: readonly(error),
    isInitialized: readonly(isInitialized),
    isAuthenticated,
    clearAuth,
    setSession,
    retireLegacyStorage,
    setError: (value: string | null) => {
      error.value = value;
    },
    setLoading: (value: boolean) => {
      isLoading.value = value;
    },
    setInitialized: (value: boolean) => {
      isInitialized.value = value;
    },
  };
}
let browserStore: ReturnType<typeof createStore> | undefined;
export function useAuthStore() {
  if (import.meta.server) return createStore();
  return (browserStore ??= createStore());
}
export default useAuthStore;

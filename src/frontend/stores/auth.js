/**
 * Authentication Store (Vue Composition API singleton)
 *
 * Manages user session state, tokens, and localStorage persistence
 * for the blökkli editor login.
 */

import { ref, computed, readonly } from 'vue';

// Singleton state (module-level)
const user = ref(null);
const accessToken = ref(null);
const refreshToken = ref(null);
const isLoading = ref(false);
const error = ref(null);
const isInitialized = ref(false);

const isAuthenticated = computed(() => !!user.value && !!accessToken.value);

function setAuth(newAccessToken, newRefreshToken, newUser) {
  accessToken.value = newAccessToken;
  refreshToken.value = newRefreshToken;
  user.value = newUser;
  error.value = null;

  if (process.client) {
    try {
      localStorage.setItem('slk_auth', JSON.stringify({
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        user: newUser,
      }));
    } catch (e) {
      console.warn('Failed to persist auth state:', e);
    }
  }
}

function clearAuth() {
  accessToken.value = null;
  refreshToken.value = null;
  user.value = null;
  error.value = null;

  if (process.client) {
    try {
      localStorage.removeItem('slk_auth');
    } catch (e) {
      console.warn('Failed to clear auth state:', e);
    }
  }
}

function setError(err) {
  error.value = err;
}

function setLoading(loading) {
  isLoading.value = loading;
}

function setInitialized(initialized) {
  isInitialized.value = initialized;
}

function hydrateFromStorage() {
  if (!process.client) return false;

  try {
    const stored = localStorage.getItem('slk_auth');
    if (stored) {
      const { accessToken: at, refreshToken: rt, user: u } = JSON.parse(stored);
      if (at && u) {
        accessToken.value = at;
        refreshToken.value = rt;
        user.value = u;
        return true;
      }
    }
  } catch (e) {
    console.warn('Failed to hydrate auth state:', e);
  }
  return false;
}

export function useAuthStore() {
  return {
    user: readonly(user),
    isLoading: readonly(isLoading),
    error: readonly(error),
    isInitialized: readonly(isInitialized),
    isAuthenticated,
    setAuth,
    clearAuth,
    setError,
    setLoading,
    setInitialized,
    hydrateFromStorage,
    _accessToken: accessToken,
    _refreshToken: refreshToken,
  };
}

export default useAuthStore;

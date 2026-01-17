/**
 * Authentication Store (Pinia-like pattern using Vue Composition API)
 * 
 * This store manages:
 * - User session state
 * - Access/refresh tokens
 * - User roles and permissions
 * - Local team memberships
 */

import { ref, computed, readonly } from 'vue';

// Singleton state (module-level)
const user = ref(null);
const accessToken = ref(null);
const refreshToken = ref(null);
const isLoading = ref(false);
const error = ref(null);
const isInitialized = ref(false);

// Role constants
export const ROLES = {
  LOCAL_TEAM_MEMBER: 'LocalTeamMember',
  LOCAL_TEAM_ADMIN: 'LocalTeamAdmin',
  MEASURE_EDITOR: 'MeasureEditor',
  ADMINISTRATOR: 'Administrator',
  // Legacy role names from current system
  EDITOR_LOCALTEAM: 'EditorLocalteam',
  ADMIN_LOKALTEAM: 'AdminLokalteam',
  MASSNAHMENTEAM: 'Maßnahmenteam',
};

// Role hierarchy (higher index = more permissions)
const ROLE_HIERARCHY = [
  ROLES.LOCAL_TEAM_MEMBER,
  ROLES.EDITOR_LOCALTEAM, // Legacy
  ROLES.LOCAL_TEAM_ADMIN,
  ROLES.ADMIN_LOKALTEAM, // Legacy
  ROLES.MASSNAHMENTEAM, // Legacy
  ROLES.MEASURE_EDITOR,
  ROLES.ADMINISTRATOR,
];

/**
 * Computed properties
 */
const isAuthenticated = computed(() => !!user.value && !!accessToken.value);

const userRole = computed(() => {
  if (!user.value?.role) return null;
  return typeof user.value.role === 'object' ? user.value.role.name : user.value.role;
});

const userRoleId = computed(() => {
  if (!user.value?.role) return null;
  return typeof user.value.role === 'object' ? user.value.role.id : user.value.role;
});

const localTeams = computed(() => {
  if (!user.value?.localteams) return [];
  return user.value.localteams.map(jt => jt.localteam_id).filter(Boolean);
});

const localTeamIds = computed(() => {
  return localTeams.value.map(lt => typeof lt === 'object' ? lt.id : lt);
});

/**
 * Permission checks
 */
const hasRole = (roleName) => {
  const currentRole = userRole.value;
  if (!currentRole) return false;
  
  // Direct match
  if (currentRole === roleName) return true;
  
  // Check hierarchy - user has permission if their role is >= required role
  const currentIndex = ROLE_HIERARCHY.indexOf(currentRole);
  const requiredIndex = ROLE_HIERARCHY.indexOf(roleName);
  
  if (currentIndex === -1 || requiredIndex === -1) return false;
  return currentIndex >= requiredIndex;
};

const canRateMunicipality = (municipalityId) => {
  if (!isAuthenticated.value) return false;
  
  // Administrators can rate any municipality
  if (hasRole(ROLES.ADMINISTRATOR)) return true;
  
  // Check if user is member of a local team for this municipality
  return localTeams.value.some(lt => {
    const team = typeof lt === 'object' ? lt : null;
    return team?.municipality_id === municipalityId;
  });
};

const canEditMeasures = computed(() => {
  return hasRole(ROLES.MEASURE_EDITOR) || hasRole(ROLES.ADMINISTRATOR);
});

const canManageCatalogVersions = computed(() => {
  return hasRole(ROLES.ADMINISTRATOR);
});

const canAccessDirectus = computed(() => {
  // Check if user has Directus app_access (any admin-like role)
  return hasRole(ROLES.MEASURE_EDITOR) || 
         hasRole(ROLES.ADMINISTRATOR) ||
         hasRole(ROLES.MASSNAHMENTEAM);
});

const canApproveRatings = computed(() => {
  return hasRole(ROLES.LOCAL_TEAM_ADMIN) || 
         hasRole(ROLES.ADMIN_LOKALTEAM) ||
         hasRole(ROLES.ADMINISTRATOR);
});

/**
 * Actions
 */
function setAuth(newAccessToken, newRefreshToken, newUser) {
  accessToken.value = newAccessToken;
  refreshToken.value = newRefreshToken;
  user.value = newUser;
  error.value = null;
  
  // Persist to localStorage for client-side hydration
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

/**
 * Initialize from localStorage (client-side only)
 */
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

/**
 * Export the store as a composable
 */
export function useAuthStore() {
  return {
    // State (readonly to prevent direct mutation)
    user: readonly(user),
    accessToken: readonly(accessToken),
    refreshToken: readonly(refreshToken),
    isLoading: readonly(isLoading),
    error: readonly(error),
    isInitialized: readonly(isInitialized),
    
    // Computed
    isAuthenticated,
    userRole,
    userRoleId,
    localTeams,
    localTeamIds,
    canEditMeasures,
    canManageCatalogVersions,
    canAccessDirectus,
    canApproveRatings,
    
    // Methods
    hasRole,
    canRateMunicipality,
    setAuth,
    clearAuth,
    setError,
    setLoading,
    setInitialized,
    hydrateFromStorage,
    
    // Raw refs for internal use
    _accessToken: accessToken,
    _refreshToken: refreshToken,
  };
}

export default useAuthStore;

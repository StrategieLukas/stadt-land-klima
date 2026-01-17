/**
 * Permissions Composable
 * 
 * Provides role-based permission checks for UI components.
 * Works with both legacy roles and new role structure.
 */

import { computed } from 'vue';
import { useAuthStore, ROLES } from '~/stores/auth';

export function usePermissions() {
  const authStore = useAuthStore();
  
  /**
   * Check if user is authenticated
   */
  const isAuthenticated = computed(() => authStore.isAuthenticated.value);
  
  /**
   * Check if user has a specific role or higher
   */
  function hasRole(roleName) {
    return authStore.hasRole(roleName);
  }
  
  /**
   * Check if user can rate a specific municipality
   */
  function canRateMunicipality(municipalityId) {
    return authStore.canRateMunicipality(municipalityId);
  }
  
  /**
   * Check if user can rate based on localteam
   */
  function canRateLocalTeam(localteamId) {
    if (!authStore.isAuthenticated.value) return false;
    if (authStore.hasRole(ROLES.ADMINISTRATOR)) return true;
    
    return authStore.localTeamIds.value.includes(localteamId);
  }
  
  /**
   * Check if user can edit measures (MeasureEditor or Admin)
   */
  const canEditMeasures = computed(() => authStore.canEditMeasures.value);
  
  /**
   * Check if user can manage catalog versions (Admin only)
   */
  const canManageCatalogVersions = computed(() => authStore.canManageCatalogVersions.value);
  
  /**
   * Check if user should see the Directus backend link
   */
  const canAccessDirectus = computed(() => authStore.canAccessDirectus.value);
  
  /**
   * Check if user can approve ratings (LocalTeamAdmin or Admin)
   */
  const canApproveRatings = computed(() => authStore.canApproveRatings.value);
  
  /**
   * Check if user can edit a specific rating
   */
  function canEditRating(rating) {
    if (!authStore.isAuthenticated.value) return false;
    if (authStore.hasRole(ROLES.ADMINISTRATOR)) return true;
    
    // Cannot edit already approved ratings unless admin
    if (rating.approved && !authStore.hasRole(ROLES.ADMINISTRATOR)) {
      return false;
    }
    
    // Check if user is in the rating's local team
    const localteamId = rating.localteam_id;
    return authStore.localTeamIds.value.includes(localteamId);
  }
  
  /**
   * Check if user can override a rating (Admin only)
   */
  const canOverrideRating = computed(() => authStore.hasRole(ROLES.ADMINISTRATOR));
  
  /**
   * Get the user's local teams
   */
  const userLocalTeams = computed(() => authStore.localTeams.value);
  
  /**
   * Get the user's display name
   */
  const userDisplayName = computed(() => {
    const user = authStore.user.value;
    if (!user) return '';
    
    if (user.first_name || user.last_name) {
      return `${user.first_name || ''} ${user.last_name || ''}`.trim();
    }
    return user.email || '';
  });
  
  /**
   * Get the user's role display name
   */
  const userRoleDisplayName = computed(() => {
    const role = authStore.userRole.value;
    if (!role) return '';
    
    // Map role names to display names
    const displayNames = {
      [ROLES.LOCAL_TEAM_MEMBER]: 'Team Member',
      [ROLES.LOCAL_TEAM_ADMIN]: 'Team Admin',
      [ROLES.MEASURE_EDITOR]: 'Measure Editor',
      [ROLES.ADMINISTRATOR]: 'Administrator',
      // Legacy roles
      [ROLES.EDITOR_LOCALTEAM]: 'Team Editor',
      [ROLES.ADMIN_LOKALTEAM]: 'Team Admin',
      [ROLES.MASSNAHMENTEAM]: 'Measures Team',
    };
    
    return displayNames[role] || role;
  });
  
  return {
    // State
    isAuthenticated,
    userLocalTeams,
    userDisplayName,
    userRoleDisplayName,
    
    // Permission checks
    hasRole,
    canRateMunicipality,
    canRateLocalTeam,
    canEditMeasures,
    canManageCatalogVersions,
    canAccessDirectus,
    canApproveRatings,
    canEditRating,
    canOverrideRating,
    
    // Role constants for convenience
    ROLES,
  };
}

export default usePermissions;

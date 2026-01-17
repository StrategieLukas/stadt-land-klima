/**
 * Role-based Authorization Middleware
 * 
 * Apply to routes that require specific roles using:
 * definePageMeta({ 
 *   middleware: 'role-guard',
 *   requiredRole: 'MeasureEditor' // or array of roles
 * })
 */

import { useAuth } from '~/composables/useAuth';
import { authStore } from '~/stores/auth';

export default defineNuxtRouteMiddleware(async (to, from) => {
  // Skip middleware on server side
  if (import.meta.server) {
    return;
  }
  
  const { isAuthenticated, initialize } = useAuth();
  
  // Ensure auth state is initialized
  await initialize();
  
  // First check authentication
  if (!isAuthenticated.value) {
    const returnUrl = to.fullPath;
    return navigateTo(`/?login=true&returnUrl=${encodeURIComponent(returnUrl)}`);
  }
  
  // Get required role from route meta
  const requiredRole = to.meta.requiredRole;
  
  if (!requiredRole) {
    // No role requirement specified, just needs authentication
    return;
  }
  
  // Check if user has the required role
  const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
  const hasRequiredRole = roles.some(role => authStore.hasRole(role));
  
  if (!hasRequiredRole) {
    // User doesn't have required role, redirect to dashboard with error
    console.warn(`Access denied: User lacks required role(s): ${roles.join(', ')}`);
    return navigateTo('/admin/dashboard?error=unauthorized');
  }
});

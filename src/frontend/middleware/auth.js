/**
 * Authentication Middleware
 * 
 * Apply to routes that require authentication using:
 * definePageMeta({ middleware: 'auth' })
 */

import { useAuth } from '~/composables/useAuth';

export default defineNuxtRouteMiddleware(async (to, from) => {
  // Skip middleware on server side
  if (import.meta.server) {
    return;
  }
  
  const { isAuthenticated, initialize } = useAuth();
  
  // Ensure auth state is initialized
  await initialize();
  
  // Check if user is authenticated
  if (!isAuthenticated.value) {
    // Store the intended destination for redirect after login
    const returnUrl = to.fullPath;
    
    // Redirect to home with login prompt
    // You could also redirect to a dedicated login page
    return navigateTo(`/?login=true&returnUrl=${encodeURIComponent(returnUrl)}`);
  }
});

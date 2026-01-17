/**
 * Authentication Composable
 * 
 * Provides login, logout, refresh, and session management functionality
 * using the Directus authentication API.
 */

import { createDirectus, rest, authentication, readMe } from '@directus/sdk';
import { useAuthStore } from '~/stores/auth';

export function useAuth() {
  const config = useRuntimeConfig();
  const authStore = useAuthStore();
  
  /**
   * Create a Directus client for authentication operations
   */
  function createAuthClient() {
    const baseUrl = process.client 
      ? config.public.clientDirectusUrl 
      : config.public.serverDirectusUrl;
    
    return createDirectus(baseUrl || 'http://localhost:8055')
      .with(rest())
      .with(authentication('json'));
  }
  
  /**
   * Login with email and password
   */
  async function login(email, password) {
    authStore.setLoading(true);
    authStore.setError(null);
    
    try {
      const client = createAuthClient();
      
      // Authenticate with Directus
      const authResult = await client.login(email, password);
      
      if (!authResult?.access_token) {
        throw new Error('No access token received');
      }
      
      // Fetch user details with role and localteams
      const userClient = createDirectus(
        process.client ? config.public.clientDirectusUrl : config.public.serverDirectusUrl
      )
        .with(rest())
        .with(authentication('json'));
      
      // Set the token for the user fetch
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
            { localteams: [
              'id',
              { localteam_id: [
                'id',
                'name',
                'municipality_name',
                { municipality_id: ['id', 'name', 'municipality_name', 'slug'] }
              ]}
            ]}
          ],
        })
      );
      
      // Store auth state
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
  
  /**
   * Logout and clear session
   */
  async function logout() {
    authStore.setLoading(true);
    
    try {
      // Attempt to invalidate refresh token on server
      if (authStore._refreshToken.value) {
        try {
          const client = createAuthClient();
          await client.logout();
        } catch (e) {
          // Ignore logout errors - token might already be invalid
          console.warn('Logout request failed:', e);
        }
      }
    } finally {
      authStore.clearAuth();
      authStore.setLoading(false);
    }
  }
  
  /**
   * Refresh the access token using the refresh token
   */
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
      
      // Update tokens in store (keep existing user)
      authStore.setAuth(
        result.access_token,
        result.refresh_token,
        authStore.user.value
      );
      
      return result.access_token;
      
    } catch (err) {
      // Refresh failed - clear auth state
      authStore.clearAuth();
      throw err;
    }
  }
  
  /**
   * Initialize auth state from storage and validate token
   */
  async function initialize() {
    if (authStore.isInitialized.value) return;
    
    // Try to hydrate from localStorage
    const hydrated = authStore.hydrateFromStorage();
    
    if (hydrated && authStore._accessToken.value) {
      // Validate the stored token by fetching current user
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
              { localteams: [
                'id',
                { localteam_id: [
                  'id',
                  'name',
                  'municipality_name',
                  { municipality_id: ['id', 'name', 'municipality_name', 'slug'] }
                ]}
              ]}
            ],
          })
        );
        
        // Update user info (token is still valid)
        authStore.setAuth(
          authStore._accessToken.value,
          authStore._refreshToken.value,
          user
        );
        
      } catch (err) {
        // Token invalid - try to refresh
        try {
          await refresh();
        } catch (refreshErr) {
          // Refresh failed - clear everything
          authStore.clearAuth();
        }
      }
    }
    
    authStore.setInitialized(true);
  }
  
  /**
   * Get a Directus client with the current user's token
   */
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
  
  /**
   * Parse Directus error responses into user-friendly messages
   */
  function parseDirectusError(error) {
    if (error?.errors?.[0]?.message) {
      const msg = error.errors[0].message;
      
      // Map common Directus errors to user-friendly messages
      if (msg.includes('Invalid user credentials')) {
        return 'Invalid email or password';
      }
      if (msg.includes('Invalid payload')) {
        return 'Please check your input';
      }
      if (msg.includes('Token expired')) {
        return 'Session expired. Please login again.';
      }
      
      return msg;
    }
    
    if (error?.message) {
      return error.message;
    }
    
    return 'An unexpected error occurred';
  }
  
  return {
    login,
    logout,
    refresh,
    initialize,
    getAuthenticatedClient,
    
    // Re-export store state for convenience
    isAuthenticated: authStore.isAuthenticated,
    isLoading: authStore.isLoading,
    error: authStore.error,
    user: authStore.user,
  };
}

export default useAuth;

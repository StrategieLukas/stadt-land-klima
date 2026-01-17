/**
 * Listmonk Newsletter Subscription Composable
 * 
 * Handles newsletter subscription via Listmonk API.
 * 
 * Required environment variables:
 * - NUXT_PUBLIC_LISTMONK_ENDPOINT: The Listmonk API endpoint (e.g., newsletter.stadt-land-klima.de)
 * - NUXT_PUBLIC_LISTMONK_API_TOKEN: The Listmonk API token for authentication
 * - NUXT_PUBLIC_LISTMONK_LIST_ID: The ID of the mailing list to subscribe to (optional, defaults to 1)
 */

import { ref } from 'vue';

export interface ListmonkSubscriptionResult {
  success: boolean;
  message: string;
  error?: string;
}

export interface ListmonkState {
  isLoading: boolean;
  isSuccess: boolean;
  error: string | null;
}

export function useListmonk() {
  const config = useRuntimeConfig();
  
  const state = ref<ListmonkState>({
    isLoading: false,
    isSuccess: false,
    error: null,
  });

  /**
   * Validates an email address format
   */
  function isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Subscribe an email address to the newsletter
   */
  async function subscribe(email: string, name?: string): Promise<ListmonkSubscriptionResult> {
    // Reset state
    state.value = {
      isLoading: true,
      isSuccess: false,
      error: null,
    };

    // Validate email
    if (!email || !isValidEmail(email)) {
      state.value = {
        isLoading: false,
        isSuccess: false,
        error: 'invalid_email',
      };
      return {
        success: false,
        message: 'Invalid email address',
        error: 'invalid_email',
      };
    }

    const endpoint = config.public.listmonkEndpoint;
    const apiToken = config.public.listmonkApiToken;
    const listId = config.public.listmonkListId || 1;

    if (!endpoint) {
      state.value = {
        isLoading: false,
        isSuccess: false,
        error: 'configuration_error',
      };
      return {
        success: false,
        message: 'Newsletter service not configured',
        error: 'configuration_error',
      };
    }

    try {
      // Construct the API URL
      const apiUrl = endpoint.startsWith('http') 
        ? `${endpoint}/api/public/subscription`
        : `https://${endpoint}/api/public/subscription`;

      // Prepare the subscription payload
      const payload = {
        email: email.trim().toLowerCase(),
        name: name?.trim() || email.split('@')[0],
        list_uuids: [], // Will be populated by the public subscription endpoint
        lists: [Number(listId)],
      };

      // Make the API request
      const response = await $fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiToken && { 'Authorization': `token ${apiToken}` }),
        },
        body: payload,
      });

      state.value = {
        isLoading: false,
        isSuccess: true,
        error: null,
      };

      return {
        success: true,
        message: 'Successfully subscribed to newsletter',
      };

    } catch (err: any) {
      console.error('Newsletter subscription error:', err);

      let errorMessage = 'subscription_failed';
      
      // Handle specific error cases
      if (err?.data?.message?.includes('already exists')) {
        errorMessage = 'already_subscribed';
      } else if (err?.statusCode === 400) {
        errorMessage = 'invalid_request';
      } else if (err?.statusCode === 429) {
        errorMessage = 'rate_limited';
      }

      state.value = {
        isLoading: false,
        isSuccess: false,
        error: errorMessage,
      };

      return {
        success: false,
        message: 'Subscription failed',
        error: errorMessage,
      };
    }
  }

  /**
   * Reset the subscription state
   */
  function reset() {
    state.value = {
      isLoading: false,
      isSuccess: false,
      error: null,
    };
  }

  return {
    state,
    subscribe,
    reset,
    isValidEmail,
  };
}

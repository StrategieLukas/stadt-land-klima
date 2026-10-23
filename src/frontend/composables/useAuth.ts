import {createDirectus, rest} from '@directus/sdk';
import type {EditorCmsSchema} from '~/types/editorCms';
import {useAuthStore} from '~/stores/auth';
import {EditorSessionResponseSchema, authErrorMessage} from '~/shared/contracts/auth';

let initialization: Promise<void> | undefined;
export function useAuth() {
  const store = useAuthStore();
  async function login(credentials: {email: string; password: string}) {
    if (import.meta.server) throw new Error('Authentication sessions are browser-only');
    store.setLoading(true); store.setError(null);
    try {
      const response = EditorSessionResponseSchema.parse(await $fetch('/api/editor/session/login', {
        method: 'POST', body: credentials, headers: {'x-slk-editor': '1'},
      }));
      store.setSession(response.user, response.csrf); store.setInitialized(true);
      return {success: true, user: response.user};
    } catch (cause) {
      const message = authErrorMessage(cause); store.setError(message);
      throw new Error(message, {cause});
    } finally {store.setLoading(false);}
  }
  async function logout() {
    const csrf = store.csrf.value;
    store.clearAuth(); store.setLoading(true);
    try {
      await $fetch('/api/editor/session/logout', {method: 'POST', headers: {'x-slk-editor': '1', 'x-csrf-token': csrf}});
    } finally {store.setLoading(false);}
  }
  async function refresh() {
    const generation = store.generation.value;
    const response = EditorSessionResponseSchema.parse(await $fetch('/api/editor/session'));
    if (store.generation.value !== generation) throw new Error('Session changed during refresh');
    store.setSession(response.user, response.csrf);
    return response.user;
  }
  async function initialize() {
    if (import.meta.server || store.isInitialized.value) return;
    initialization ??= (async () => {
      store.retireLegacyStorage();
      const generation = store.generation.value;
      try {await refresh();}
      catch {if (store.generation.value === generation) store.clearAuth();}
      finally {store.setInitialized(true);}
    })().finally(() => {initialization = undefined;});
    await initialization;
  }
  function getAuthenticatedClient<Schema extends object = EditorCmsSchema>() {
    if (import.meta.server || !store.isAuthenticated.value) throw new Error('An authenticated editor session is required');
    return createDirectus<Schema>(new URL('/api/editor/cms', window.location.origin).href).with(rest({
      credentials: 'same-origin',
      onRequest: request => {const headers = new Headers(request.headers); headers.set('x-slk-editor', '1'); headers.set('x-slk-editor-user', store.user.value?.id || ''); headers.set('x-csrf-token', store.csrf.value); return {...request, headers};},
    }));
  }
  return {login, logout, refresh, initialize, getAuthenticatedClient,
    isAuthenticated: store.isAuthenticated, isLoading: store.isLoading, error: store.error, user: store.user};
}
export default useAuth;

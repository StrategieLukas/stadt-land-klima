import {createError, type H3Event} from 'h3';
import {z} from 'zod';
import {AuthUserSchema} from '~/shared/contracts/auth';
import {readEditorSession, saveEditorSession, type EditorSession} from './editorSession';
import {withProtectionRedis} from './protectionRedis';
import {randomUUID} from 'node:crypto';
const Tokens = z.object({data: z.object({access_token: z.string(), refresh_token: z.string(), expires: z.number().positive()})});
const base = () => useRuntimeConfig().directusServerUrl.replace(/\/$/, '');
export async function editorIdentity(accessToken: string) {
  const result = await $fetch<{data: unknown}>(base() + '/users/me', {headers: {Authorization: `Bearer ${accessToken}`}, query: {fields: 'id,first_name,last_name,email,avatar,role.id,role.name'}, timeout: 10_000, retry: 0});
  return AuthUserSchema.parse(result.data);
}
export async function loginEditor(email: string, password: string) {
  const tokens = Tokens.parse(await $fetch(base() + '/auth/login', {method: 'POST', body: {email, password, mode: 'json'}, timeout: 10_000, retry: 0})).data;
  return {accessToken: tokens.access_token, refreshToken: tokens.refresh_token, expiresAt: Date.now() + tokens.expires, user: await editorIdentity(tokens.access_token)};
}
export async function editorAccess(event: H3Event, mutation: boolean) {
  let state = await readEditorSession(event, mutation);
  if (state.session.expiresAt > Date.now() + 30_000) return state;
  // Refresh-token rotation must be serialized across processes. Other requests
  // receive a retryable response rather than consuming the same token twice.
  const lockKey = `${process.env.RATE_LIMIT_NAMESPACE || 'slk'}:editor-refresh:${state.sid}`;
  const owner = randomUUID();
  const locked = await withProtectionRedis(redis => redis.set(lockKey, owner, {NX: true, EX: 15}));
  if (locked !== 'OK') {
    for (let attempt = 0; attempt < 40; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 100));
      state = await readEditorSession(event, mutation);
      if (state.session.expiresAt > Date.now() + 30_000) return state;
    }
    throw createError({statusCode: 503, statusMessage: 'Session refresh in progress'});
  }
  try {
    state = await readEditorSession(event, mutation);
    if (state.session.expiresAt > Date.now() + 30_000) return state;
    const tokens = Tokens.parse(await $fetch(base() + '/auth/refresh', {method: 'POST', body: {refresh_token: state.session.refreshToken, mode: 'json'}, timeout: 10_000, retry: 0})).data;
    const session: EditorSession = {...state.session, accessToken: tokens.access_token, refreshToken: tokens.refresh_token, expiresAt: Date.now() + tokens.expires};
    try {await saveEditorSession(state.sid, session, true);}
    catch (error) {await logoutEditor(session.refreshToken).catch(() => undefined); throw error;}
    return {...state, session};
  } finally {
    await withProtectionRedis(redis => redis.eval("if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end return 0", {keys: [lockKey], arguments: [owner]}));
  }
}
export async function logoutEditor(refreshToken: string) {
  await $fetch(base() + '/auth/logout', {method: 'POST', body: {refresh_token: refreshToken, mode: 'json'}, timeout: 10_000, retry: 0});
}

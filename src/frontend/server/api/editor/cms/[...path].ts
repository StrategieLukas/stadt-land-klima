import {createError, defineEventHandler, getRouterParam, getHeader, setResponseHeader} from 'h3';
import {validateEditorAssetQuery} from '../../../utils/editorAssets';
import {publicEditorJson, validateEditorQuery} from '../../../utils/editorTransport';
import {editorAccess} from '../../../utils/editorUpstream';
import {rateLimit} from '../../../utils/rateLimit';

export function allowedEditorPath(path: string, method: string) {
  if (path.includes('%') || path.includes('..') || path.includes('\\')) return false;
  if (/^items\/(?!directus_)[a-z][a-z0-9_]*(?:\/[A-Za-z0-9_-]+)?$/.test(path)) return ['GET','POST','PATCH','DELETE'].includes(method);
  if (/^(?:files|folders)(?:\/[a-f0-9-]{36})?$/.test(path)) return ['GET','POST','PATCH','DELETE'].includes(method);
  if (/^assets\/[a-f0-9-]{36}$/.test(path)) return ['GET','HEAD'].includes(method);
  return (path === 'permissions/me' && method === 'GET') || (path === 'blokkli-persistence/state' && method === 'GET') || (path === 'blokkli-persistence/publish' && method === 'POST');
}
export default defineEventHandler(async event => {
  const path = getRouterParam(event, 'path') || '';
  const method = event.method.toUpperCase();
  if (!allowedEditorPath(path, method)) throw createError({statusCode: 403});
  if (!await rateLimit(event, 'editor-cms')) throw createError({statusCode: 429});
  if (path === 'files' && method === 'POST' && !await rateLimit(event, 'editor-upload')) throw createError({statusCode: 429});
  const {session} = await editorAccess(event, !['GET','HEAD'].includes(method));
  const expectedUser = getHeader(event, 'x-slk-editor-user');
  if (expectedUser && expectedUser !== session.user.id) throw createError({statusCode: 409, statusMessage: 'Editor identity changed'});
  const base = useRuntimeConfig().directusServerUrl.replace(/\/$/, '');
  const input = new URL(event.path, 'http://editor.local');
  // Credentials, arbitrary proxy targets and cookie authentication never pass through.
  validateEditorQuery(input.searchParams);
  if (path.startsWith('assets/')) validateEditorAssetQuery(input.searchParams);
  const headers = new Headers({Authorization: `Bearer ${session.accessToken}`});
  for (const name of ['content-type', 'range', 'if-none-match']) {
    const value = event.node.req.headers[name];
    if (typeof value === 'string') headers.set(name, value);
  }
  let body: Buffer | undefined;
  if (!['GET','HEAD'].includes(method)) {
    const chunks: Buffer[] = []; let length = 0;
    const max = path === 'files' ? 50 * 1024 * 1024 : 5 * 1024 * 1024;
    for await (const chunk of event.node.req as AsyncIterable<Buffer>) {
      length += chunk.length;
      if (length > max) throw createError({statusCode: 413});
      chunks.push(chunk);
    }
    body = Buffer.concat(chunks);
  }
  let upstream: Response;
  try {
    upstream = await fetch(`${base}/${path}${input.search}`, {method, headers, ...(body ? {body: Uint8Array.from(body)} : {}), redirect: 'error', signal: AbortSignal.timeout(30_000)});
  } catch {
    throw createError({statusCode: 502, statusMessage: 'CMS unavailable'});
  }
  setResponseHeader(event, 'Cache-Control', 'private, no-store');
  const outputHeaders = new Headers({'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff'});
  for (const name of ['content-type','content-length','content-range','accept-ranges','etag']) {
    const value = upstream.headers.get(name); if (value) outputHeaders.set(name, value);
  }
  if (upstream.headers.has('content-encoding')) outputHeaders.delete('content-length');
  if (path.startsWith('assets/')) {
    outputHeaders.set('Content-Security-Policy', "sandbox; default-src 'none'; style-src 'unsafe-inline'");
  }
  if (method === 'HEAD' || [204, 304].includes(upstream.status)) return new Response(null, {status: upstream.status, headers: outputHeaders});
  if (upstream.headers.get('content-type')?.includes('application/json')) {
    const chunks: Uint8Array[] = []; let bytes = 0;
    if (upstream.body) for await (const chunk of upstream.body) {
      bytes += chunk.byteLength;
      if (bytes > 10 * 1024 * 1024) throw createError({statusCode: 502, statusMessage: 'CMS response too large'});
      chunks.push(chunk);
    }
    const checked = publicEditorJson(JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown);
    outputHeaders.delete('content-length');
    return new Response(JSON.stringify(checked), {status: upstream.status, headers: outputHeaders});
  }
  // Successful CMS JSON still has its native {data: ...} envelope for the SDK.
  return new Response(upstream.body, {status: upstream.status, headers: outputHeaders});
});

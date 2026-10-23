import {createError} from 'h3';

const credentialFields = new Set(['access_token', 'refresh_token', 'token', 'password', 'secret', 'client_secret', 'api_key']);
/** Never return credential columns through expanded personal CMS relations. */
export function publicEditorJson(value: unknown, depth = 0): unknown {
  if (depth > 40) throw createError({statusCode: 502, statusMessage: 'CMS response nesting limit exceeded'});
  if (Array.isArray(value)) return value.map(item => publicEditorJson(item, depth + 1));
  if (value !== null && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !credentialFields.has(key.toLowerCase()))
    .map(([key, child]) => [key, publicEditorJson(child, depth + 1)]));
  return value;
}
/** Validate opaque deep input before it reaches the pinned CMS parser. */
export function validateEditorQuery(query: URLSearchParams) {
  if (query.has('access_token')) throw createError({statusCode: 400});
  let nodes = 0;
  function check(value: unknown, depth: number): void {
    if (++nodes > 1000 || depth > 12) throw createError({statusCode: 400});
    if (Array.isArray(value)) {for (const item of value) check(item, depth + 1); return;}
    if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) {
      if (key.split(/[.[\]]/).some(segment => segment in Object.prototype || segment in Array.prototype || segment in Function.prototype || segment === 'prototype')) throw createError({statusCode: 400});
      check(child, depth + 1);
    }
  }
  for (const encoded of query.getAll('deep')) {
    if (encoded.length > 32768) throw createError({statusCode: 400});
    let value: unknown;
    try {value = JSON.parse(encoded) as unknown;} catch {throw createError({statusCode: 400});}
    check(value, 0);
  }
}

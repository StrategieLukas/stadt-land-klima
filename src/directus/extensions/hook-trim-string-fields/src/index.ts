import { defineHook } from '@directus/extensions-sdk';

type ItemPayload = Record<string, unknown> | Array<Record<string, unknown>>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function trimStringValues<T>(value: T): T {
  if (typeof value === 'string') {
    return value.trim() as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => trimStringValues(item)) as T;
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, trimStringValues(item)]),
    ) as T;
  }

  return value;
}

export default defineHook(({ filter }) => {
  filter('items.create', (payload: ItemPayload) => trimStringValues(payload));
  filter('items.update', (payload: ItemPayload) => trimStringValues(payload));
});

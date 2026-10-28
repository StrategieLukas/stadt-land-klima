import { z } from "zod";
import {
  TranslationMemorySchema,
  TranslationOperationSchema,
  type TranslationOperation,
} from "../../shared/contentTranslationProtocol";
import type { ContentTranslationReader } from "./contentTranslation";

export type PreparedTranslationRow = z.infer<typeof TranslationMemorySchema>;
const rowsSchema = z.object({ rows: z.array(TranslationMemorySchema).max(100) });
const fieldRowsSchema = z.object({
  data: z
    .array(
      z.object({
        id: z.string(),
        namespace: z.string(),
        kind: z.literal("field"),
        state: z.literal("ready"),
        translated_text: z.string().min(1).max(100_000),
      }),
    )
    .max(100),
});
const errorSchema = z.object({
  error: z.enum([
    "lease_expired",
    "namespace_changed",
    "namespace_requires_explicit_enqueue",
    "source_changed",
    "units_unavailable",
    "local_character_budget",
    "control_rate_limit",
    "forbidden",
    "operator_only",
    "invalid_operation",
    "reservation_mismatch",
  ]),
});
export class TranslationPersistenceError extends Error {
  constructor(
    readonly code: string,
    readonly status = 503,
  ) {
    super(code);
  }
}

export async function translationDeadline<T>(work: () => Promise<T>, ms: number, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let cancel: (() => void) | undefined;
  try {
    return await Promise.race([
      work(),
      new Promise<never>((_resolve, reject) => {
        cancel = () => {
          reject(new Error("Translation source stopped"));
        };
        signal.addEventListener("abort", cancel, { once: true });
        if (signal.aborted) cancel();
        timer = setTimeout(() => {
          reject(new Error("Translation source deadline"));
        }, ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
    if (cancel) signal.removeEventListener("abort", cancel);
  }
}
export function translationDelay(ms: number, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const cancel = () => {
      clearTimeout(timer);
      reject(new Error("Translation stopped"));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", cancel);
      resolve();
    }, ms);
    signal.addEventListener("abort", cancel, { once: true });
  });
}
export function translationTransport(
  baseUrl: string,
  token: string,
  fetcher: typeof globalThis.fetch = globalThis.fetch,
) {
  const base = new URL(baseUrl);
  if (
    !["http:", "https:"].includes(base.protocol) ||
    base.username ||
    base.password ||
    base.search ||
    base.hash ||
    !token
  )
    throw new TranslationPersistenceError("invalid_private_configuration");
  return async (path: string, signal: AbortSignal, body?: unknown): Promise<unknown> => {
    try {
      const response = await fetcher(`${base.toString().replace(/\/$/, "")}${path}`, {
        method: body ? "POST" : "GET",
        redirect: "error",
        signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
        headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const reader = response.body?.getReader();
      if (!reader) throw new TranslationPersistenceError("empty_persistence_response");
      let bytes = 0;
      let text = "";
      const decoder = new TextDecoder("utf-8", { fatal: true });
      try {
        for (;;) {
          const chunk = await reader.read();
          if (chunk.done) break;
          bytes += chunk.value.byteLength;
          if (bytes > 8_000_000) throw new TranslationPersistenceError("persistence_response_limit");
          text += decoder.decode(chunk.value, { stream: true });
        }
        text += decoder.decode();
      } finally {
        await reader.cancel().catch(() => {});
      }
      const value: unknown = JSON.parse(text);
      if (!response.ok) {
        const parsed = errorSchema.safeParse(value);
        throw new TranslationPersistenceError(
          parsed.success ? parsed.data.error : "persistence_unavailable",
          response.status,
        );
      }
      return value;
    } catch (error) {
      if (error instanceof TranslationPersistenceError) throw error;
      throw new TranslationPersistenceError("persistence_unavailable");
    }
  };
}
export function createTranslationPersistence(
  baseUrl: string,
  workerToken: string,
  namespace: string,
  fetcher: typeof globalThis.fetch = globalThis.fetch,
  paceMs = 13_000,
) {
  const request = translationTransport(baseUrl, workerToken, fetcher);
  let lastWrite = 0;
  return {
    namespace,
    async load(keys: readonly string[], signal: AbortSignal) {
      const rows = new Map<string, PreparedTranslationRow>();
      for (let offset = 0; offset < keys.length; offset += 100) {
        const query = new URLSearchParams({ namespace, keys: keys.slice(offset, offset + 100).join(",") });
        const result = rowsSchema.parse(await request(`/content-translations/memory?${query}`, signal));
        for (const row of result.rows) if (row.namespace === namespace) rows.set(row.id, row);
      }
      return rows;
    },
    async operation(operation: TranslationOperation, signal: AbortSignal): Promise<unknown> {
      const body = TranslationOperationSchema.parse(operation);
      // Five writes/minute, shared by claim/reserve/commit/finish. Server enforces this across processes.
      for (let attempt = 0; ; attempt++) {
        const delay = Math.max(0, lastWrite + paceMs - Date.now());
        if (delay) await translationDelay(delay, signal);
        lastWrite = Date.now();
        try {
          return await request("/content-translations", signal, body);
        } catch (error) {
          const retry =
            error instanceof TranslationPersistenceError &&
            (error.status === 503 || error.code === "control_rate_limit");
          if (!retry || attempt >= 2 || signal.aborted) throw error;
          // Retrying an idempotent database write cannot spend DeepL credits. Preserve a
          // received translation instead of discarding it on a transient store failure.
          await translationDelay(error.code === "control_rate_limit" ? 60_500 : Math.max(paceMs, 1000), signal);
        }
      }
    },
  };
}
export type TranslationPersistence = ReturnType<typeof createTranslationPersistence>;

/** Reader has only the existing private Frontend-Server identity and immutable field results. */
export function createPersistedTranslationReader(
  baseUrl: string,
  serverToken: string,
  namespace: string,
  enabled: boolean,
  fetcher: typeof globalThis.fetch = globalThis.fetch,
): ContentTranslationReader {
  const request = translationTransport(baseUrl, serverToken, fetcher);
  const cache = new Map<string, { text: string; expires: number; bytes: number }>();
  let cacheBytes = 0;
  return {
    namespace,
    enabled,
    async getMany(keys, signal) {
      const result = new Map<string, string>();
      const missing: string[] = [];
      for (const key of keys) {
        const cached = cache.get(key);
        if (cached && cached.expires > Date.now()) result.set(key, cached.text);
        else missing.push(key);
      }
      for (let offset = 0; offset < missing.length; offset += 100) {
        const chunk = missing.slice(offset, offset + 100);
        const query = new URLSearchParams({
          fields: "id,namespace,kind,state,translated_text",
          limit: "100",
          filter: JSON.stringify({
            id: { _in: chunk },
            namespace: { _eq: namespace },
            kind: { _eq: "field" },
            state: { _eq: "ready" },
          }),
        });
        const rows = fieldRowsSchema.parse(await request(`/items/content_translation_memory?${query}`, signal));
        signal.throwIfAborted();
        for (const row of rows.data) {
          if (row.namespace !== namespace || !chunk.includes(row.id)) continue;
          result.set(row.id, row.translated_text);
          const prior = cache.get(row.id);
          if (prior) cacheBytes -= prior.bytes;
          const value = {
            text: row.translated_text,
            expires: Date.now() + 60_000,
            bytes: Buffer.byteLength(row.translated_text),
          };
          cache.set(row.id, value);
          cacheBytes += value.bytes;
        }
        while (cache.size > 2000 || cacheBytes > 5_000_000) {
          const key = cache.keys().next().value;
          if (key === undefined) break;
          cacheBytes -= cache.get(key)!.bytes;
          cache.delete(key);
        }
      }
      return result;
    },
  };
}

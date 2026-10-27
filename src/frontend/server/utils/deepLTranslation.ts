import { createHash } from "node:crypto";
import { z } from "zod";
import type { Locale } from "../../shared/i18n";

export type DeepLOptions = {
  apiKey: string;
  endpoint?: "auto" | "free" | "standard";
  model?: "latency_optimized" | "quality_optimized" | "prefer_quality_optimized";
  glossaryEn?: string;
  glossaryIt?: string;
  policyRevision?: string;
};
export const DeepLSettingsSchema = z.object({
  endpoint: z.enum(["auto", "free", "standard"]),
  model: z.enum(["prefer_quality_optimized", "quality_optimized", "latency_optimized"]),
  glossaryEn: z.union([z.literal(""), z.uuid()]),
  glossaryIt: z.union([z.literal(""), z.uuid()]),
  policyRevision: z
    .string()
    .min(1)
    .max(40)
    .regex(/^[a-zA-Z0-9._-]+$/),
});

const domainContext =
  "Stadt.Land.Klima! is a public German website about municipal climate action, local volunteer teams, climate measures, public projects and local elections.";
export class DeepLTranslationError extends Error {
  constructor(readonly code: "rate" | "quota" | "invalid" | "auth" | "uncertain") {
    super(`deepl_${code}`);
  }
}
const UsageSchema = z.object({
  character_count: z.number().int().nonnegative(),
  character_limit: z.number().int().nonnegative(),
  api_key_character_count: z.number().int().nonnegative().optional(),
  api_key_character_limit: z.number().int().nonnegative().optional(),
});
const ResponseSchema = z.object({
  translations: z
    .array(
      z.object({
        text: z.string().min(1).max(10_000),
        billed_characters: z.number().int().nonnegative().max(10_000).optional(),
      }),
    )
    .min(1)
    .max(50),
});
export function deepLNamespace(options: Omit<DeepLOptions, "apiKey" | "endpoint">) {
  return `deepl-segments-v1:${createHash("sha256")
    .update(
      JSON.stringify({
        model: options.model ?? "prefer_quality_optimized",
        en: options.glossaryEn ?? "",
        it: options.glossaryIt ?? "",
        policy: options.policyRevision ?? "v1",
      }),
    )
    .digest("hex")}`;
}
function bodyFor(options: DeepLOptions, locale: Locale, texts: readonly string[]) {
  if (locale !== "en-GB" && locale !== "it-IT") throw new DeepLTranslationError("invalid");
  const glossary = locale === "en-GB" ? options.glossaryEn : options.glossaryIt;
  return {
    text: [...texts],
    source_lang: "DE",
    target_lang: locale === "en-GB" ? "EN-GB" : "IT",
    context: domainContext,
    model_type: options.model ?? "prefer_quality_optimized",
    show_billed_characters: true,
    ...(glossary ? { glossary_id: glossary } : {}),
  };
}
export function deepLBatch(options: DeepLOptions, locale: Locale, texts: readonly string[]) {
  const selected: string[] = [];
  let characters = 0;
  for (const text of texts) {
    const count = Array.from(text).length;
    if (!text.trim() || count > 2000) throw new DeepLTranslationError("invalid");
    if (
      selected.length >= 50 ||
      characters + count > 10_000 ||
      Buffer.byteLength(JSON.stringify(bodyFor(options, locale, [...selected, text]))) > 120 * 1024
    )
      break;
    selected.push(text);
    characters += count;
  }
  return { texts: selected, characters, body: bodyFor(options, locale, selected) };
}
async function boundedJson(response: Response): Promise<unknown> {
  if (!response.body) throw new DeepLTranslationError("uncertain");
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0;
  let value = "";
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 2_000_000) throw new DeepLTranslationError("uncertain");
      value += decoder.decode(chunk.value, { stream: true });
    }
    value += decoder.decode();
    return JSON.parse(value) as unknown;
  } finally {
    await reader.cancel().catch(() => {});
  }
}
/** Native fetch has no application retries. POST timeouts/5xx/malformed replies may have
 * consumed quota: callers must persist an uncertain reservation, never silently rebill.
 */
export function createDeepLTranslator(options: DeepLOptions, fetcher: typeof globalThis.fetch = globalThis.fetch) {
  if (!/^[A-Za-z0-9:_-]{10,256}$/.test(options.apiKey)) throw new DeepLTranslationError("auth");
  const endpoint = options.endpoint ?? "auto";
  const free = endpoint === "free" || (endpoint === "auto" && options.apiKey.endsWith(":fx"));
  const base = free ? "https://api-free.deepl.com" : "https://api.deepl.com";
  async function request(path: "/v2/translate" | "/v2/usage", signal: AbortSignal, body?: unknown) {
    try {
      const response = await fetcher(base + path, {
        method: body ? "POST" : "GET",
        redirect: "error",
        signal: AbortSignal.any([signal, AbortSignal.timeout(20_000)]),
        headers: {
          Authorization: `DeepL-Auth-Key ${options.apiKey}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (!response.ok) {
        await response.body?.cancel().catch(() => {});
        throw new DeepLTranslationError(
          response.status === 429
            ? "rate"
            : response.status === 456
              ? "quota"
              : response.status === 403 || response.status === 401
                ? "auth"
                : response.status >= 400 && response.status < 500
                  ? "invalid"
                  : "uncertain",
        );
      }
      return await boundedJson(response);
    } catch (error) {
      if (error instanceof DeepLTranslationError) throw error;
      throw new DeepLTranslationError("uncertain");
    }
  }
  return {
    namespace: deepLNamespace(options),
    async remaining(signal: AbortSignal) {
      const usage = UsageSchema.safeParse(await request("/v2/usage", signal));
      if (!usage.success) throw new DeepLTranslationError("uncertain");
      const accountRemaining = usage.data.character_limit - usage.data.character_count;
      const keyRemaining =
        usage.data.api_key_character_limit === undefined
          ? accountRemaining
          : usage.data.api_key_character_limit - (usage.data.api_key_character_count ?? usage.data.character_count);
      return Math.max(0, Math.min(accountRemaining, keyRemaining));
    },
    async translate(locale: Locale, texts: readonly string[], signal: AbortSignal) {
      const batch = deepLBatch(options, locale, texts);
      if (!texts.length || batch.texts.length !== texts.length) throw new DeepLTranslationError("invalid");
      const parsed = ResponseSchema.safeParse(await request("/v2/translate", signal, batch.body));
      if (!parsed.success || parsed.data.translations.length !== texts.length)
        throw new DeepLTranslationError("uncertain");
      return parsed.data.translations.map((value, index) => ({
        text: value.text,
        billed: value.billed_characters ?? Array.from(texts[index]!).length,
      }));
    },
  };
}

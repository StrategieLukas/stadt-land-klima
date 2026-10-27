import { readFileSync, existsSync } from "node:fs";
import { parseEnv } from "node:util";
import { resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { SiteLayoutSchema } from "../../../src/frontend/shared/contracts/navigation.js";
import { contentTranslationPolicy } from "../../../src/frontend/shared/contentTranslation.js";
import {
  collectContentTranslationSegments,
  createContentTranslator,
} from "../../../src/frontend/server/utils/contentTranslation.js";
import { createDeepLTranslator, DeepLSettingsSchema } from "../../../src/frontend/server/utils/deepLTranslation.js";
import {
  createPersistedTranslationReader,
  createTranslationPersistence,
  translationDelay,
  translationTransport,
} from "../../../src/frontend/server/utils/contentTranslationPersistence.js";
import { runContentTranslationWorker } from "../../../src/frontend/server/utils/contentTranslationWorker.js";
import { z } from "../../../src/frontend/node_modules/zod/index.js";

import { prepareTranslationDocument } from "../../../src/frontend/server/utils/contentTranslationFormat.js";

class TranslationSampleError extends Error {}
const route = "/api/public/site-layout";
export const sampleUsage =
  "sample:content-translation -- --frontend-url URL --directus-url URL [--count 3] [--max-characters 200] [--apply]";
export function parseSampleOptions(args: string[]) {
  const values: Record<string, string> = {};
  let apply = false;
  for (let i = 0; i < args.length; i++) {
    const name = args[i]!;
    if (name === "--apply" && !apply) {
      apply = true;
      continue;
    }
    if (
      !["--frontend-url", "--directus-url", "--count", "--max-characters"].includes(name) ||
      values[name] !== undefined ||
      !args[i + 1]
    )
      throw new TranslationSampleError("Invalid sample arguments");
    values[name] = args[++i]!;
  }
  const url = (name: string) => {
    const parsed = new URL(values[name] ?? "");
    if (
      !["http:", "https:"].includes(parsed.protocol) ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash
    )
      throw new TranslationSampleError("Invalid sample URL");
    return parsed.toString().replace(/\/$/, "");
  };
  const count = Number(values["--count"] ?? 3);
  const maxCharacters = Number(values["--max-characters"] ?? 200);
  if (
    !Number.isInteger(count) ||
    count < 1 ||
    count > 5 ||
    !Number.isInteger(maxCharacters) ||
    maxCharacters < 1 ||
    maxCharacters > 500
  )
    throw new TranslationSampleError("Sample limits exceeded");
  return { frontendUrl: url("--frontend-url"), directusUrl: url("--directus-url"), count, maxCharacters, apply };
}
export function planTranslationSample(data: unknown, count: number, maxCharacters: number) {
  if (
    !Number.isInteger(count) ||
    count < 1 ||
    count > 5 ||
    !Number.isInteger(maxCharacters) ||
    maxCharacters < 1 ||
    maxCharacters > 500
  )
    throw new TranslationSampleError("Sample limits exceeded");
  const parsed = SiteLayoutSchema.parse(data);
  const pages = parsed.pages
    .filter((page) => page.name.trim())
    .slice(0, count)
    .map(({ id, slug, name }) => ({ id, slug, name }));
  if (!pages.length) throw new TranslationSampleError("No published navigation titles available");
  const maximumSourceCharacters = pages.reduce((total, page) => total + Array.from(page.name).length, 0) * 2;
  if (maximumSourceCharacters > maxCharacters)
    throw new TranslationSampleError("Selected titles exceed sample character ceiling; reduce --count");
  const units = new Set(
    pages.flatMap((page) => prepareTranslationDocument({ text: page.name, format: "text", context: "name" }).texts),
  );
  if (units.size > 50)
    throw new TranslationSampleError("Selected titles exceed one batch per language; reduce --count");
  return { pages, maximumSourceCharacters };
}
const StatusSchema = z.object({
  limits: z.object({ total: z.number().int().positive(), daily: z.number().int().positive() }),
  usage: z.array(z.object({ id: z.string(), reserved_characters: z.number(), billed_characters: z.number() })),
  job: z.object({ namespace: z.string().nullable(), lease_until: z.string().nullable() }).nullable(),
});

/** Explicit operator command. Dry-run never authenticates to DeepL or writes to Directus.
 * Apply uses the production worker/memory, restricted to at most five public page titles.
 */
export async function runTranslationSample(
  options: ReturnType<typeof parseSampleOptions>,
  env: Record<string, string | undefined>,
  fetcher: typeof fetch = fetch,
  timing = { wait: translationDelay, paceMs: 13_000 },
) {
  const signal = AbortSignal.timeout(240_000);
  const headers: Record<string, string> =
    env.FRONTEND_BASIC_AUTH_USERNAME && env.FRONTEND_BASIC_AUTH_PASSWORD
      ? {
          Authorization: `Basic ${Buffer.from(`${env.FRONTEND_BASIC_AUTH_USERNAME}:${env.FRONTEND_BASIC_AUTH_PASSWORD}`).toString("base64")}`,
        }
      : {};
  async function source(locale: string) {
    const response = await fetcher(`${options.frontendUrl}${route}?contentLocale=${locale}`, {
      headers,
      redirect: "error",
      signal: AbortSignal.any([signal, AbortSignal.timeout(20_000)]),
    });
    if (!response.ok) throw new TranslationSampleError("Checked public navigation unavailable");
    const reader = response.body?.getReader();
    if (!reader) throw new TranslationSampleError("Empty public navigation response");
    let bytes = 0;
    let body = "";
    const decoder = new TextDecoder("utf-8", { fatal: true });
    try {
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > 2_000_000) throw new TranslationSampleError("Public navigation too large");
        body += decoder.decode(chunk.value, { stream: true });
      }
      body += decoder.decode();
    } finally {
      await reader.cancel().catch(() => {});
    }
    return SiteLayoutSchema.parse(JSON.parse(body) as unknown);
  }
  let plan = planTranslationSample(await source("de-DE"), options.count, options.maxCharacters);
  if (!options.apply)
    return {
      mode: "dry-run",
      ...plan,
      maximumAdditionalCharacters: options.maxCharacters,
      providerCalls: 0,
      writes: 0,
    };
  if (
    (env.NUXT_CONTENT_TRANSLATION_ENABLED ?? env.CONTENT_TRANSLATION_ENABLED) !== "true" ||
    (env.NUXT_CONTENT_TRANSLATION_GENERATION_ENABLED ?? env.CONTENT_TRANSLATION_GENERATION_ENABLED ?? "false") !==
      "false"
  )
    throw new TranslationSampleError(
      "Apply requires enabled translations with automatic generation explicitly disabled",
    );
  const token = env.CLI_DIRECTUS_STATIC_TOKEN;
  const worker = env.NUXT_CONTENT_TRANSLATION_WORKER_TOKEN ?? env.CONTENT_TRANSLATION_WORKER_TOKEN;
  const server = env.NUXT_DIRECTUS_FRONTEND_SERVER_TOKEN ?? env.DIRECTUS_FRONTEND_SERVER_TOKEN;
  const key = env.NUXT_DEEPL_API_KEY ?? env.DEEPL_API_KEY;
  if (!token || !worker || !server || !key)
    throw new TranslationSampleError("Missing private operator/provider configuration");
  const providerOptions = {
    apiKey: key,
    ...DeepLSettingsSchema.parse({
      endpoint: env.NUXT_DEEPL_API_ENDPOINT ?? env.DEEPL_API_ENDPOINT ?? "auto",
      model: env.NUXT_DEEPL_MODEL ?? env.DEEPL_MODEL ?? "prefer_quality_optimized",
      glossaryEn: env.NUXT_DEEPL_GLOSSARY_EN ?? env.DEEPL_GLOSSARY_EN ?? "",
      glossaryIt: env.NUXT_DEEPL_GLOSSARY_IT ?? env.DEEPL_GLOSSARY_IT ?? "",
      policyRevision: env.NUXT_DEEPL_POLICY_REVISION ?? env.DEEPL_POLICY_REVISION ?? "v1",
    }),
  };
  let providerCalls = 0;
  let submittedCharacters = 0;
  const provider = createDeepLTranslator(providerOptions, async (url, init) => {
    if (String(url).endsWith("/v2/translate")) {
      const body = JSON.parse(String(init?.body)) as { text: string[] };
      const characters = body.text.reduce((total, text) => total + Array.from(text).length, 0);
      if (providerCalls >= 2 || submittedCharacters + characters > options.maxCharacters)
        throw new TranslationSampleError("Sample provider ceiling reached");
      providerCalls++;
      submittedCharacters += characters;
    }
    return fetcher(url, init);
  });
  const admin = translationTransport(options.directusUrl, token, fetcher);
  const persistence = createTranslationPersistence(
    options.directusUrl,
    worker,
    provider.namespace,
    fetcher,
    timing.paceMs,
  );
  const status = () => admin("/content-translations/status", signal).then((value) => StatusSchema.parse(value));
  const before = await status();
  if (before.job?.lease_until && Date.parse(before.job.lease_until) > Date.now())
    throw new TranslationSampleError("Worker busy; disable automatic generation and wait for its lease to expire");
  if (before.job?.namespace && before.job.namespace !== provider.namespace)
    throw new TranslationSampleError("Namespace differs; sample command never switches or rebuilds namespaces");
  const fieldKeys = ["en-GB", "it-IT"].flatMap((locale) => [
    ...collectContentTranslationSegments(
      { pages: plan.pages },
      contentTranslationPolicy(route)!,
      provider.namespace,
      locale as "en-GB" | "it-IT",
    ).keys(),
  ]);
  const stored = await persistence.load(fieldKeys, signal);
  const requiredCharacters = fieldKeys.every((key) => stored.get(key)?.state === "ready")
    ? 0
    : plan.maximumSourceCharacters;
  const reserved = (id: string) => before.usage.find((row) => row.id === id)?.reserved_characters ?? 0;
  if (
    Math.min(
      before.limits.total - reserved("total"),
      before.limits.daily - reserved(`day:${new Date().toISOString().slice(0, 10)}`),
    ) < requiredCharacters
  )
    throw new TranslationSampleError("Insufficient local sample budget; limits and counters were preserved");
  await admin("/content-translations", signal, { op: "enqueue" });
  await timing.wait(31_000, signal);
  plan = planTranslationSample(await source("de-DE"), options.count, options.maxCharacters);
  const summary = await runContentTranslationWorker({
    persistence,
    provider,
    providerOptions,
    signal,
    source: {
      records: async () => [],
      fetch: async (path) => (path === route ? { pages: plan.pages.map(({ name }) => ({ name })) } : {}),
    },
  });
  const reader = createPersistedTranslationReader(options.directusUrl, server, provider.namespace, true, fetcher);
  const translator = createContentTranslator(reader, 10_000);
  const samples = [];
  for (const locale of ["en-GB", "it-IT"] as const) {
    const result = await translator({ pages: plan.pages }, locale, contentTranslationPolicy(route)!);
    if (result.degraded || result.pending)
      throw new TranslationSampleError("Sample incomplete; inspect private status before retrying uncertain requests");
    const actual = await source(locale);
    for (const page of result.data.pages)
      if (actual.pages.find((item) => item.id === page.id)?.name !== page.name)
        throw new TranslationSampleError(
          "Staging API does not serve the prepared locale; check deployed reader configuration",
        );
    samples.push({ locale, pages: result.data.pages });
  }
  const after = await status();
  const billed = (rows: typeof before.usage) => rows.find((row) => row.id === "total")?.billed_characters ?? 0;
  return {
    mode: "applied",
    summary,
    providerCalls,
    submittedCharacters,
    billedDelta: billed(after.usage) - billed(before.usage),
    limits: after.limits,
    samples,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv.slice(2).join(" ") === "--help") console.log(sampleUsage);
  else {
    try {
      const options = parseSampleOptions(process.argv.slice(2));
      const root = fileURLToPath(new URL("../../../", import.meta.url));
      const frontFile = `${root}/src/frontend/.env`;
      const env = {
        ...(options.apply ? parseEnv(readFileSync(`${root}/src/directus/.env`, "utf8")) : {}),
        ...(existsSync(frontFile) ? parseEnv(readFileSync(frontFile, "utf8")) : {}),
        ...process.env,
      };
      console.log(JSON.stringify(await runTranslationSample(options, env), null, 2));
    } catch (error) {
      if (error instanceof TranslationSampleError) console.error(error.message);
      console.error(
        "Translation sample failed. Use --help, check the title/character bounds, private configuration, active worker lease and operator status. Provider errors and credentials are never printed; ambiguous paid requests are not automatically retried.",
      );
      process.exitCode = 1;
    }
  }
}

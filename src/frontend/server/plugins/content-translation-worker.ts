import { configureContentTranslationReader, noopContentTranslationReader } from "../utils/contentTranslation";
import {
  createPersistedTranslationReader,
  createTranslationPersistence,
  translationDeadline,
} from "../utils/contentTranslationPersistence";
import {
  createDeepLTranslator,
  deepLNamespace,
  DeepLSettingsSchema,
  type DeepLOptions,
} from "../utils/deepLTranslation";
import { runContentTranslationWorker } from "../utils/contentTranslationWorker";
import { readPublicItems } from "../utils/publicItems";
import { systemLog } from "../utils/securityLogging";
import { contentTranslationPolicy } from "~/shared/contentTranslation";

/** One background loop per process; PostgreSQL lease/reservations cover every replica.
 * Disabled/missing-key startup has zero provider work. Removing a key keeps serving memory.
 */
export default defineNitroPlugin((nitro) => {
  const state = globalThis as typeof globalThis & { __slkTranslationWorker?: { abort: () => void } };
  state.__slkTranslationWorker?.abort();
  delete state.__slkTranslationWorker;
  const config = useRuntimeConfig();
  configureContentTranslationReader(noopContentTranslationReader);
  if (!config.contentTranslationEnabled) return;
  const parsed = DeepLSettingsSchema.safeParse({
    endpoint: config.deeplApiEndpoint,
    model: config.deeplModel,
    glossaryEn: config.deeplGlossaryEn,
    glossaryIt: config.deeplGlossaryIt,
    policyRevision: config.deeplPolicyRevision,
  });
  if (!parsed.success) {
    systemLog("warn", "content.translation.configuration_invalid");
    return;
  }
  const options: DeepLOptions = { ...parsed.data, apiKey: config.deeplApiKey };
  const namespace = deepLNamespace(options);
  const baseUrl = config.directusServerUrl || "http://directus:8055";
  try {
    configureContentTranslationReader(
      createPersistedTranslationReader(baseUrl, config.directusFrontendServerToken, namespace, true),
    );
  } catch {
    systemLog("warn", "content.translation.reader_unavailable");
    return;
  }
  if (import.meta.prerender || process.env.NITRO_PRERENDER === "true") return;
  if (!config.deeplApiKey || !config.contentTranslationWorkerToken) {
    systemLog("info", "content.translation.generation_paused");
    return;
  }
  let provider: ReturnType<typeof createDeepLTranslator>;
  try {
    provider = createDeepLTranslator(options);
  } catch {
    systemLog("warn", "content.translation.configuration_invalid");
    return;
  }
  const persistence = createTranslationPersistence(baseUrl, config.contentTranslationWorkerToken, namespace);
  const controller = new AbortController();
  let running = false;
  // Refreshes in dev must abort the prior loop, including in-flight provider work.
  state.__slkTranslationWorker = controller;
  const basicAuth =
    config.frontendBasicAuthUsername && config.frontendBasicAuthPassword
      ? `Basic ${Buffer.from(`${config.frontendBasicAuthUsername}:${config.frontendBasicAuthPassword}`).toString("base64")}`
      : undefined;
  const tick = async () => {
    if (running || controller.signal.aborted) return;
    running = true;
    try {
      const result = await runContentTranslationWorker({
        persistence,
        provider,
        providerOptions: options,
        signal: controller.signal,
        source: {
          records: (collection, fields, filter) =>
            translationDeadline(
              () => readPublicItems(collection, { fields, filter }, 20_000),
              60_000,
              controller.signal,
            ),
          fetch: (path) =>
            translationDeadline(
              async () => {
                if (!contentTranslationPolicy(path)) throw new Error("Invalid public translation source");
                const url = new URL(path, "http://nuxt.internal");
                url.searchParams.set("contentLocale", "de-DE");
                const response = await nitro.localFetch(url.pathname + url.search, {
                  method: "GET",
                  signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)]),
                  ...(basicAuth ? { headers: { Authorization: basicAuth } } : {}),
                });
                if (response.status === 404) return undefined;
                if (!response.ok) throw new Error("Public translation source unavailable");
                return (await response.json()) as unknown;
              },
              30_000,
              controller.signal,
            ),
        },
      });
      if (result.generated || result.preparedFields)
        systemLog("info", "content.translation.prepared", { count: result.generated });
    } catch {
      if (!controller.signal.aborted) systemLog("warn", "content.translation.worker_deferred");
    } finally {
      running = false;
    }
  };
  const interval = setInterval(() => {
    void tick();
  }, 60_000);
  const initial = setTimeout(() => {
    void tick();
  }, 5000);
  nitro.hooks.hook("close", () => {
    controller.abort();
    clearInterval(interval);
    clearTimeout(initial);
  });
});

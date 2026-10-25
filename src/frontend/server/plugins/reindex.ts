import { collectSearchSnapshot, createSearchCms } from "../utils/searchSnapshot";
import { reconcileSearchIndex, searchReadiness } from "../utils/searchReconciliation";
import type { SiteContentDoc } from "../utils/extractContent";

type ReindexGlobals = typeof globalThis & {
  __slkReindexTimer?: ReturnType<typeof setInterval>;
  __slkReindexRunning?: boolean;
};

// Nitro 2 declares void plugins; setup must finish before public search can be served.
// eslint-disable-next-line @typescript-eslint/no-misused-promises
export default defineNitroPlugin(async () => {
  const config = useRuntimeConfig();
  const ms = getMeilisearch();
  const index = ms.index<SiteContentDoc>("site_content");
  const token = config.directusFrontendServerToken;
  if (!token) throw new Error("Reindexing requires the private server token");
  const directus = createSearchCms(config.directusServerUrl || "http://directus:8055", token);
  const g = globalThis as ReindexGlobals;
  searchReadiness.ready = false;
  let nextRun = 0;
  const healthyInterval = process.env.APP_ENV === "production" ? 60 * 60 * 1000 : 15 * 60 * 1000;
  const runReindex = async () => {
    if (g.__slkReindexRunning || Date.now() < nextRun) return;
    g.__slkReindexRunning = true;
    // Never expose a previously trusted index after a failed refresh.
    searchReadiness.ready = false;
    try {
      const settings = await index.updateSettings({
        searchableAttributes: ["title", "text", "meta"],
        filterableAttributes: ["type"],
        typoTolerance: { enabled: true, minWordSizeForTypos: { oneTypo: 4, twoTypos: 8 } },
        stopWords: ["der", "die", "das", "und", "oder", "in", "von", "zu", "mit", "für", "bei", "an"],
      });
      const task = await ms.tasks.waitForTask(settings.taskUid);
      if (task.status !== "succeeded") throw new Error("Search settings task failed");
      const { docs, counts } = await collectSearchSnapshot(directus);
      await reconcileSearchIndex(index, (uid) => ms.tasks.waitForTask(uid), docs);
      searchReadiness.ready = true;
      nextRun = Date.now() + healthyInterval;
      console.info("[reindex] Reconciled public search:", counts);
    } catch {
      nextRun = Date.now() + 30_000;
      console.error("[reindex] Reconciliation failed; public search remains unavailable");
    } finally {
      g.__slkReindexRunning = false;
    }
  };
  await runReindex();
  if (g.__slkReindexTimer) clearInterval(g.__slkReindexTimer);
  g.__slkReindexTimer = setInterval(() => {
    void runReindex();
  }, 30_000);
});

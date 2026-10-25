import type { Index } from "meilisearch";
import type { SiteContentDoc } from "./extractContent";

export const searchReadiness = { ready: false };
const BATCH_SIZE = 200;

/** Paginate a stable list before deletion, so offset shifts cannot skip obsolete documents. */
export async function reconcileSearchIndex(
  index: Index<SiteContentDoc>,
  wait: (uid: number) => Promise<{ status: string }>,
  docs: SiteContentDoc[],
): Promise<void> {
  const desired = new Set(docs.map((doc) => doc.id));
  if (desired.size !== docs.length) throw new Error("Duplicate search document identity");
  const obsolete: string[] = [];
  for (let offset = 0; ; offset += BATCH_SIZE) {
    const page = await index.getDocuments({ offset, limit: BATCH_SIZE, fields: ["id"] });
    for (const doc of page.results) {
      if (typeof doc.id !== "string" || !doc.id) throw new Error("Invalid stored search identity");
      if (!desired.has(doc.id)) obsolete.push(doc.id);
    }
    if (page.results.length < BATCH_SIZE) break;
  }
  const finish = async (task: { taskUid: number }) => {
    if ((await wait(task.taskUid)).status !== "succeeded") throw new Error("Search mutation task failed");
  };
  // Remove all obsolete types/legacy IDs, not just the first page of measures.
  for (let i = 0; i < obsolete.length; i += BATCH_SIZE)
    await finish(await index.deleteDocuments(obsolete.slice(i, i + BATCH_SIZE)));
  for (let i = 0; i < docs.length; i += BATCH_SIZE)
    await finish(await index.addDocuments(docs.slice(i, i + BATCH_SIZE)));
}

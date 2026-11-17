import { randomUUID } from "node:crypto";
import { z } from "zod";
import { TranslationLeaseSchema, type TranslationOperation } from "../../shared/contentTranslationProtocol";
import { contentTranslationPolicy, type ContentFormat } from "../../shared/contentTranslation";
import {
  collectContentTranslationSegments,
  contentTranslationUnitKey,
  type TranslationSegment,
} from "./contentTranslation";
import { prepareTranslationDocument, type TranslationDocument } from "./contentTranslationFormat";
import { deepLBatch, DeepLTranslationError, type createDeepLTranslator, type DeepLOptions } from "./deepLTranslation";
import { collectPublicTranslationSnapshots, type TranslationSourceReader } from "./contentTranslationSources";
import {
  TranslationPersistenceError,
  type TranslationPersistence,
  type PreparedTranslationRow,
} from "./contentTranslationPersistence";

type Target = "en-GB" | "it-IT";
type Field = {
  key: string;
  locale: Target;
  segment: TranslationSegment;
  priority: number;
  document?: TranslationDocument;
};
type Unit = { key: string; locale: Target; text: string };
const claimSchema = z.object({ lease: TranslationLeaseSchema.nullable() });
const reservedSchema = z.object({ reserved: z.literal(true) });
const committedSchema = z.object({ committed: z.literal(true) });
const unitKey = contentTranslationUnitKey;
export type TranslationWorkerSummary = {
  generated: number;
  preparedFields: number;
  attention: boolean;
  changed: boolean;
};

/** Background only. A persisted reservation precedes every paid POST; only known-safe
 * rejections can be retried. Successful segments survive source edits and process restarts.
 */
export async function runContentTranslationWorker(input: {
  persistence: TranslationPersistence;
  provider: ReturnType<typeof createDeepLTranslator>;
  providerOptions: DeepLOptions;
  source: TranslationSourceReader;
  signal: AbortSignal;
}): Promise<TranslationWorkerSummary> {
  const { persistence, provider, providerOptions, signal } = input;
  const namespace = persistence.namespace;
  if (provider.namespace !== namespace) throw new Error("Translation namespace mismatch");
  const owner = randomUUID();
  const ownership = { owner, namespace };
  const claim = claimSchema.parse(await persistence.operation({ op: "claim", ...ownership }, signal));
  const summary: TranslationWorkerSummary = { generated: 0, preparedFields: 0, attention: false, changed: false };
  if (!claim.lease) return summary;
  const revision = claim.lease.revision;
  const targets = claim.lease.targets;
  let budget = claim.lease.budget;
  let lastRenew = Date.now();
  let finishError: Extract<TranslationOperation, { op: "finish" }>["error"] = "none";
  let activeBatch: string | undefined;
  let generationStarted = false;
  try {
    const fields = new Map<string, Field>();
    let sourceSize = 0;
    const progress = async () => {
      signal.throwIfAborted();
      if (Date.now() - lastRenew < 60_000) return;
      const refreshed = claimSchema.parse(await persistence.operation({ op: "claim", ...ownership }, signal));
      if (!refreshed.lease || refreshed.lease.revision !== revision)
        throw new TranslationPersistenceError("source_changed", 409);
      budget = refreshed.lease.budget;
      lastRenew = Date.now();
    };
    for await (const snapshot of collectPublicTranslationSnapshots({ ...input.source, progress })) {
      const policy = contentTranslationPolicy(snapshot.path)!;
      for (const [localeIndex, locale] of targets.entries()) {
        for (const [key, segment] of collectContentTranslationSegments(snapshot.data, policy, namespace, locale)) {
          const priority =
            localeIndex * 10 + Math.max(snapshot.priority ?? 0, segment.context === "current_progress" ? 3 : 0);
          const existing = fields.get(key);
          if (existing) {
            existing.priority = Math.min(existing.priority, priority);
            continue;
          }
          sourceSize += segment.text.length;
          if (fields.size >= 20_000 || sourceSize > 20_000_000) throw new Error("Translation inventory limit exceeded");
          fields.set(key, { key, locale, segment, priority });
        }
      }
    }
    const orderedFields = [...fields.values()].sort((a, b) => a.priority - b.priority);
    await progress();
    const fieldMemory = await persistence.load([...fields.keys()], signal);
    const units = new Map<string, Unit>();
    const documents = new Map<string, TranslationDocument>();
    for (const field of fields.values()) {
      if (fieldMemory.get(field.key)?.state === "ready") continue;
      try {
        if (field.segment.text.length > 100_000) throw new Error("Translation field limit exceeded");
        const documentKey = `${field.segment.format}:${field.segment.text}`;
        field.document = documents.get(documentKey) ?? prepareTranslationDocument(field.segment);
        documents.set(documentKey, field.document);
        for (const text of field.document.texts) {
          const key = unitKey(namespace, field.locale, text);
          units.set(key, { key, locale: field.locale, text });
        }
      } catch {
        summary.attention = true;
      }
    }
    await progress();
    const memory = await persistence.load([...units.keys()], signal);
    const readyFieldKeys = new Set([...fieldMemory].filter(([, row]) => row.state === "ready").map(([key]) => key));
    const readyFields = () => {
      const results: { key: string; locale: Target; format: ContentFormat; text: string }[] = [];
      let bytes = 0;
      for (const field of orderedFields) {
        if (!field.document || readyFieldKeys.has(field.key)) continue;
        try {
          const value = field.document.render((text) => {
            const row = memory.get(unitKey(namespace, field.locale, text));
            return row?.state === "ready" ? (row.translated_text ?? undefined) : undefined;
          });
          if (value === undefined) continue;
          if (value.length > 100_000) {
            summary.attention = true;
            continue;
          }
          const row = { key: field.key, locale: field.locale, format: field.segment.format, text: value };
          const size = Buffer.byteLength(JSON.stringify(row));
          if (results.length >= 100 || bytes + size > 350_000) break;
          bytes += size;
          results.push(row);
        } catch {
          summary.attention = true;
        }
      }
      return results;
    };
    const commitFields = async () => {
      for (;;) {
        const prepared = readyFields();
        if (!prepared.length) return;
        committedSchema.parse(
          await persistence.operation({ op: "commit", ...ownership, batch: null, units: [], fields: prepared }, signal),
        );
        for (const field of prepared) readyFieldKeys.add(field.key);
        summary.preparedFields += prepared.length;
      }
    };
    await commitFields();
    for (;;) {
      await progress();
      const eligible = new Set<string>();
      let priority = Infinity;
      for (const field of orderedFields) {
        if (field.priority > priority) break;
        if (!field.document || readyFieldKeys.has(field.key)) continue;
        const keys = field.document.texts.map((text) => unitKey(namespace, field.locale, text));
        const blocked = keys.some((key) => {
          const row = memory.get(key);
          return (
            row &&
            (["inflight", "uncertain", "blocked"].includes(row.state) ||
              (row.retry_at && Date.parse(row.retry_at) > Date.now()))
          );
        });
        if (blocked) {
          summary.attention = true;
          continue;
        }
        for (const key of keys)
          if (memory.get(key)?.state !== "ready") {
            priority = field.priority;
            eligible.add(key);
          }
      }
      const firstKey = eligible.values().next().value;
      if (firstKey === undefined) break;
      const first = units.get(firstKey)!;
      const candidates = [...eligible].map((key) => units.get(key)!).filter((unit) => unit.locale === first.locale);
      if (budget.day !== new Date().toISOString().slice(0, 10)) budget = await persistence.budget(signal);
      const allowance = Math.min(budget.remaining, await provider.remaining(signal));
      const batch = deepLBatch(
        providerOptions,
        first.locale,
        candidates.map((unit) => unit.text),
        allowance,
      );
      const byText = new Map(candidates.map((unit) => [unit.text, unit]));
      const selected = batch.texts.map((text) => byText.get(text)!);
      if (!selected.length) {
        finishError = "budget";
        break;
      }
      activeBatch = randomUUID();
      reservedSchema.parse(
        await persistence.operation(
          {
            op: "reserve",
            ...ownership,
            revision,
            batch: activeBatch,
            units: selected.map((unit) => ({
              key: unit.key,
              locale: unit.locale,
              characters: Array.from(unit.text).length,
            })),
          },
          signal,
        ),
      );
      budget.remaining -= batch.characters;
      generationStarted = true;
      const translated = await provider.translate(first.locale, batch.texts, signal);
      // Validate the complete batch before publishing any field. A bad result is quarantined,
      // not silently re-requested. Format serializers prevent provider markup from becoming code.
      for (const value of translated)
        if (!value.text.trim() || /\[\[\[|\{\{|\$\{|https?:\/\//.test(value.text))
          throw new DeepLTranslationError("uncertain");
      const preparedUnits = selected.map((unit, index) => ({
        key: unit.key,
        text: translated[index]!.text,
        billed: translated[index]!.billed,
      }));
      for (const unit of selected) {
        const text = preparedUnits.find((value) => value.key === unit.key)!.text;
        const row: PreparedTranslationRow = {
          id: unit.key,
          namespace,
          kind: "unit",
          locale: unit.locale,
          format: "text",
          state: "ready",
          translated_text: text,
          retry_at: null,
        };
        memory.set(unit.key, row);
      }
      const prepared = readyFields();
      committedSchema.parse(
        await persistence.operation(
          { op: "commit", ...ownership, batch: activeBatch, units: preparedUnits, fields: prepared },
          signal,
        ),
      );
      summary.generated += selected.length;
      summary.preparedFields += prepared.length;
      for (const field of prepared) readyFieldKeys.add(field.key);
      activeBatch = undefined;
      generationStarted = false;
      lastRenew = Date.now();
      await commitFields();
    }
    if (summary.attention && finishError === "none") finishError = "attention";
  } catch (error) {
    if (activeBatch) {
      // Without a definitive rejection, the provider may have charged even if the response was lost.
      const code = error instanceof DeepLTranslationError ? error.code : generationStarted ? "uncertain" : "cancelled";
      if (!signal.aborted) {
        try {
          await persistence.operation({ op: "failed-batch", ...ownership, batch: activeBatch, code }, signal);
        } catch {
          /* Expiry will quarantine inflight units. */
        }
      }
    }
    if (error instanceof TranslationPersistenceError && ["source_changed", "units_unavailable"].includes(error.code))
      summary.changed = true;
    else if (error instanceof TranslationPersistenceError && error.code === "local_character_budget")
      finishError = "budget";
    else finishError = error instanceof DeepLTranslationError || generationStarted ? "provider" : "source";
  } finally {
    if (!signal.aborted) {
      try {
        await persistence.operation({ op: "finish", ...ownership, revision, error: finishError }, signal);
      } catch {
        /* Durable lease expiry recovers a lost worker. */
      }
    }
  }
  return summary;
}

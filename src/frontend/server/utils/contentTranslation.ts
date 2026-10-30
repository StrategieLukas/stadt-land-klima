import { createHash } from "node:crypto";
import type { Locale } from "../../shared/i18n";
import {
  CONTENT_SOURCE_LOCALE,
  contentTranslationPolicy,
  type ContentFormat,
  type ContentTranslationPolicy,
} from "../../shared/contentTranslation";
import { BLOCK_DEFINITIONS, isBlockBundle, isRecord } from "../../shared/editorBlocks";

export type TranslationSegment = { text: string; format: ContentFormat; context: string };
export interface ContentTranslationProvider {
  /** Include model, glossary and adapter revisions here to invalidate cached results. */
  readonly namespace: string;
  readonly enabled: boolean;
  translate(request: {
    sourceLocale: Locale;
    targetLocale: Locale;
    segments: readonly TranslationSegment[];
    signal: AbortSignal;
  }): Promise<unknown>;
}
/** Read-only capability used by page requests. It cannot call a provider or write translations. */
export interface ContentTranslationReader {
  readonly namespace: string;
  readonly enabled: boolean;
  getMany(keys: readonly string[], signal: AbortSignal): Promise<ReadonlyMap<string, string>>;
}
/** Write capability reserved for background preparation. */
export interface ContentTranslationStore extends ContentTranslationReader {
  setMany(entries: ReadonlyMap<string, string>, signal: AbortSignal): Promise<void>;
}
export const noopContentTranslationReader: ContentTranslationReader = {
  namespace: "noop-v1",
  enabled: false,
  getMany: () => Promise.resolve(new Map()),
};

/** The only production provider for now: no network, cache, credentials or content changes. */
export const noopContentTranslationProvider: ContentTranslationProvider = {
  namespace: "noop-v1",
  enabled: false,
  translate: ({ segments }) => Promise.resolve(segments.map((segment) => segment.text)),
};

type SelectedSegment = TranslationSegment & { set: (value: string) => void };
const unsafeKeys = new Set(["__proto__", "prototype", "constructor"]);

function selectFields(
  value: unknown,
  path: string[],
  format: ContentFormat,
  context: string,
  selected: SelectedSegment[],
  depth = 0,
): void {
  if (depth > 64 || !value || typeof value !== "object") return;
  const [part, ...rest] = path;
  if (!part || unsafeKeys.has(part)) return;
  const record = value as Record<string, unknown>;
  const keys = part === "*" ? Object.keys(value) : [part];
  for (const key of keys) {
    if (unsafeKeys.has(key) || !Object.hasOwn(value, key)) continue;
    // A public itinerary can contain an unpublished report envelope. Its report-only
    // text/media are not displayed and must never be submitted to a provider.
    if (
      Object.hasOwn(value, "report_status") &&
      record.report_status !== "published" &&
      ["report_title", "teaser", "media"].includes(key)
    )
      continue;
    if (record.under_construction === false && key === "under_construction_explanation") continue;
    const child = record[key];
    if (rest.length) selectFields(child, rest, format, context, selected, depth + 1);
    else if (typeof child === "string" && child.trim()) {
      selected.push({
        text: child,
        format,
        context,
        set: (translated) => {
          record[key] = translated;
        },
      });
    }
  }
}

/** Persistence text props also contain IDs/specifications; translate a smaller, explicit subset. */
const blockText: Partial<Record<keyof typeof BLOCK_DEFINITIONS, readonly string[]>> = {
  heading: ["text"],
  image: ["alt", "caption"],
  button: ["label"],
  video: ["caption"],
  hero: ["title", "subtitle"],
  citation: ["quote"],
  stat: ["unit", "label", "description"],
  timeline: ["title"],
  timeline_item: ["title"],
  progress_bar: ["label", "unit", "description"],
  hex_item: ["label"],
  projects_carousel: ["label", "heading", "linkText"],
  municipality_search_hero: ["title", "subtitle"],
  landing_page: ["title", "subtitle"],
  newsletter_signup: ["title", "description"],
  form: ["title", "description", "successMessage"],
  form_label: ["text", "description"],
};
const blockOptions: Partial<Record<keyof typeof BLOCK_DEFINITIONS, readonly string[]>> = {
  citation: ["author"],
  form: ["submitLabel"],
  form_field: ["placeholder"],
  municipality_search_hero: ["title", "subtitle"],
};

function selectBlocks(value: unknown, selected: SelectedSegment[], commits: (() => void)[], depth = 0): void {
  if (!Array.isArray(value) || depth > 32) return;
  for (const block of value) {
    if (!isRecord(block) || typeof block.bundle !== "string" || !isBlockBundle(block.bundle)) continue;
    const bundle = block.bundle;
    for (const prop of blockText[bundle] ?? [])
      selectFields(block, ["props", prop], "text", `block.${bundle}.${prop}`, selected);
    if (bundle === "text" || bundle === "richtext")
      selectFields(
        block,
        ["props", "content"],
        bundle === "richtext" ? "markdown" : "html",
        `block.${bundle}.content`,
        selected,
      );
    for (const option of blockOptions[bundle] ?? [])
      selectFields(block, ["options", option], "text", `block.${bundle}.options.${option}`, selected);
    if (bundle === "page_nav" && isRecord(block.options) && typeof block.options.items === "string") {
      try {
        const items: unknown = JSON.parse(block.options.items);
        if (
          Array.isArray(items) &&
          items.every(
            (item: unknown) => isRecord(item) && typeof item.label === "string" && typeof item.href === "string",
          )
        ) {
          selectFields(items, ["*", "label"], "text", "block.page_nav.label", selected);
          const options = block.options;
          const sourceItems = JSON.stringify(items);
          commits.push(() => {
            const translatedItems = JSON.stringify(items);
            if (translatedItems !== sourceItems) options.items = translatedItems;
          });
        }
      } catch {
        /* Malformed source JSON remains untouched. */
      }
    }
    for (const nested of BLOCK_DEFINITIONS[bundle].nested) {
      if (isRecord(block.props)) selectBlocks(block.props[nested], selected, commits, depth + 1);
    }
  }
}

function selectNavigation(value: unknown, selected: SelectedSegment[], depth = 0): void {
  if (!Array.isArray(value) || depth > 32) return;
  for (const item of value) {
    if (!isRecord(item)) continue;
    // Key-based UI translations retain precedence over CMS fallback labels.
    if (!item.translation_key)
      for (const key of ["label", "name", "title", "description"]) {
        selectFields(item, [key], "text", `navigation.${key}`, selected);
      }
    selectNavigation(item.children, selected, depth + 1);
    selectNavigation(item.links, selected, depth + 1);
  }
}

export function contentTranslationKey(namespace: string, locale: Locale, segment: TranslationSegment): string {
  return `content-translation:v1:${createHash("sha256")
    .update(JSON.stringify([namespace, CONTENT_SOURCE_LOCALE, locale, segment.format, segment.context, segment.text]))
    .digest("hex")}`;
}

type TranslationEntry = { segment: TranslationSegment; targets: SelectedSegment[] };
function translationSelection<T>(original: T, policy: ContentTranslationPolicy, namespace: string, locale: Locale) {
  const data = structuredClone(original);
  const selected: SelectedSegment[] = [];
  const commits: (() => void)[] = [];
  for (const field of policy.fields)
    selectFields(data, field.path.split("."), field.format, field.context ?? field.path, selected);
  if (isRecord(data)) {
    if (policy.blocks) selectBlocks(data.blocks, selected, commits);
    if (policy.navigation && isRecord(data.navigationConfig)) {
      selectNavigation(data.navigationConfig.header_items, selected);
      selectNavigation(data.navigationConfig.footer_columns, selected);
    }
  }
  if (selected.length > 5000 || selected.reduce((size, segment) => size + segment.text.length, 0) > 500_000)
    throw new Error("Translation limit exceeded");
  const entries = new Map<string, TranslationEntry>();
  for (const segment of selected) {
    const key = contentTranslationKey(namespace, locale, segment);
    const entry = entries.get(key) ?? {
      segment: { text: segment.text, format: segment.format, context: segment.context },
      targets: [],
    };
    entry.targets.push(segment);
    entries.set(key, entry);
  }
  return { data, entries, commits };
}

/** Uses the same allowlist/keys as reads. Only background preparation receives source segments. */
export function collectContentTranslationSegments(
  original: unknown,
  policy: ContentTranslationPolicy,
  namespace: string,
  locale: Locale,
) {
  return new Map(
    [...translationSelection(original, policy, namespace, locale).entries].map(([key, entry]) => [key, entry.segment]),
  );
}

/** Offline cold-backfill estimate from checked public DTO snapshots; no store, provider or source text in the report. */
export function planContentTranslations(snapshots: readonly { path: string; data: unknown }[]) {
  if (snapshots.length > 1000) throw new Error("Translation snapshot limit exceeded");
  const formats: Record<ContentFormat, { uniqueFields: number; occurrences: number; sourceCodePoints: number }> = {
    text: { uniqueFields: 0, occurrences: 0, sourceCodePoints: 0 },
    html: { uniqueFields: 0, occurrences: 0, sourceCodePoints: 0 },
    markdown: { uniqueFields: 0, occurrences: 0, sourceCodePoints: 0 },
  };
  const seen = new Set<string>();
  for (const snapshot of snapshots) {
    const policy = contentTranslationPolicy(snapshot.path);
    if (!policy) throw new Error("Unregistered translation snapshot route");
    // The namespace/locale here only identify duplicates; this planner never generates stored keys.
    const { entries } = translationSelection(snapshot.data, policy, "assessment-v1", "en-GB");
    for (const [key, { segment, targets }] of entries) {
      const format = formats[segment.format];
      format.occurrences += targets.length;
      if (seen.has(key)) continue;
      seen.add(key);
      format.uniqueFields++;
      // Providers count Unicode code points rather than JavaScript UTF-16 code units.
      format.sourceCodePoints += Array.from(segment.text).length;
    }
  }
  const sourceCodePointsPerTarget = Object.values(formats).reduce((sum, format) => sum + format.sourceCodePoints, 0);
  return {
    sourceLocale: CONTENT_SOURCE_LOCALE,
    targetLocales: ["en-GB", "it-IT"] as const,
    snapshotCount: snapshots.length,
    uniqueFieldsPerTarget: seen.size,
    sourceCodePointsPerTarget,
    sourceCodePointsBothTargets: sourceCodePointsPerTarget * 2,
    formats,
  };
}

function validTranslation(value: unknown): value is string {
  return typeof value === "string" && !!value.trim() && value.length <= 100_000;
}
async function withDeadline<T>(work: (signal: AbortSignal) => Promise<T>, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work(controller.signal),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error("Translation timeout"));
        }, timeoutMs);
      }),
    ]);
  } finally {
    controller.abort();
    if (timer) clearTimeout(timer);
  }
}

/** Public request path: one batched stored-translation read, never generation or a write. */
export function createContentTranslator(
  reader: ContentTranslationReader = noopContentTranslationReader,
  timeoutMs = 500,
) {
  return async <T>(
    original: T,
    locale: Locale,
    policy: ContentTranslationPolicy,
  ): Promise<{ data: T; degraded: boolean; pending: boolean }> => {
    if (!reader.enabled || locale === CONTENT_SOURCE_LOCALE) return { data: original, degraded: false, pending: false };
    try {
      return await withDeadline(async (signal) => {
        const { data, entries, commits } = translationSelection(original, policy, reader.namespace, locale);
        if (!entries.size) return { data: original, degraded: false, pending: false };
        const stored = await reader.getMany([...entries.keys()], signal);
        if (signal.aborted) throw new Error("Translation lookup expired");
        let pending = false;
        for (const [key, entry] of entries) {
          const translated = stored.get(key);
          if (translated === undefined) {
            pending = true;
            continue;
          }
          if (!validTranslation(translated)) throw new Error("Invalid stored translation");
          for (const target of entry.targets) target.set(translated);
        }
        for (const commit of commits) commit();
        return { data, degraded: false, pending };
      }, timeoutMs);
    } catch {
      return { data: original, degraded: true, pending: false };
    }
  };
}

/** Background-only entry point for a future durable edit/publish listener and worker.
 * The caller must supply authorized, projected source content and recheck publication/revision
 * before making results eligible for public reads. No HTTP handler invokes this function.
 */
export async function prepareContentTranslations(
  original: unknown,
  locale: Locale,
  policy: ContentTranslationPolicy,
  provider: ContentTranslationProvider,
  store: ContentTranslationStore,
  timeoutMs = 30_000,
): Promise<{ translated: number; reused: number }> {
  if (!provider.enabled || !store.enabled || locale === CONTENT_SOURCE_LOCALE) return { translated: 0, reused: 0 };
  if (provider.namespace !== store.namespace) throw new Error("Translation namespace mismatch");
  return withDeadline(async (signal) => {
    const { entries } = translationSelection(original, policy, provider.namespace, locale);
    if (!entries.size) return { translated: 0, reused: 0 };
    const stored = await store.getMany([...entries.keys()], signal);
    const missing = [...entries].filter(([key]) => !validTranslation(stored.get(key)));
    if (!missing.length) return { translated: 0, reused: entries.size };
    if (signal.aborted) throw new Error("Translation preparation expired");
    const response = await provider.translate({
      sourceLocale: CONTENT_SOURCE_LOCALE,
      targetLocale: locale,
      segments: missing.map(([, entry]) => entry.segment),
      signal,
    });
    if (
      !Array.isArray(response) ||
      response.length !== missing.length ||
      response.some((value: unknown) => !validTranslation(value))
    )
      throw new Error("Invalid translation response");
    const results = new Map<string, string>();
    for (const [index, [key]] of missing.entries()) {
      const translated: unknown = response[index];
      if (!validTranslation(translated)) throw new Error("Invalid translation response");
      results.set(key, translated);
    }
    if (signal.aborted) throw new Error("Translation preparation expired");
    await store.setMany(results, signal);
    return { translated: missing.length, reused: entries.size - missing.length };
  }, timeoutMs);
}

let activeTranslator = createContentTranslator();
/** Installed once by the server plugin; HTTP receives a read-only capability. */
export function configureContentTranslationReader(reader: ContentTranslationReader) {
  activeTranslator = createContentTranslator(reader);
}
export const translatePublicContent: ReturnType<typeof createContentTranslator> = (data, locale, policy) =>
  activeTranslator(data, locale, policy);

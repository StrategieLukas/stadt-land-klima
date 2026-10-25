import type { FieldListItem } from "#blokkli/types";

/** Kept in sync with defineProps, adapter field config and Blökkli bundle names. */
export const BLOCK_DEFINITIONS = {
  text: { text: ["content"], nested: [] },
  richtext: { text: ["content"], nested: [] },
  heading: { text: ["text"], nested: [] },
  image: { text: ["imageId", "alt", "caption"], nested: [] },
  button: { text: ["label"], nested: [] },
  container: { text: [], nested: ["blocks"] },
  directus_page: { text: ["pageSlug"], nested: [] },
  video: { text: ["caption"], nested: [] },
  hero: { text: ["title", "subtitle", "imageId"], nested: ["blocks"] },
  citation: { text: ["quote", "attribution", "source", "imageId"], nested: [] },
  stat: { text: ["value", "unit", "label", "description"], nested: [] },
  vega_chart: { text: ["spec", "query"], nested: [] },
  timeline: { text: ["title"], nested: ["items"] },
  timeline_item: { text: ["date", "title"], nested: ["blocks"] },
  carousel: { text: [], nested: ["slides"] },
  progress_bar: { text: ["label", "value", "unit", "description"], nested: [] },
  page_nav: { text: [], nested: [] },
  hex_grid: { text: [], nested: ["hexagons"] },
  hex_item: { text: ["label", "imageId"], nested: [] },
  projects_carousel: { text: ["label", "heading", "linkText"], nested: [] },
  municipality_search_hero: { text: ["title", "subtitle"], nested: [] },
  newsletter_signup: { text: ["title", "description"], nested: [] },
  donation_widget: { text: [], nested: [] },
  form: { text: ["title", "description", "successMessage"], nested: ["fields"] },
  form_field: { text: [], nested: ["label"] },
  form_label: { text: ["text", "description"], nested: [] },
  icon: { text: [], nested: [] },
} as const;
export type BlockBundle = keyof typeof BLOCK_DEFINITIONS;
export type NestedField = (typeof BLOCK_DEFINITIONS)[BlockBundle]["nested"][number];
type Props<B extends BlockBundle> = Record<string, unknown> &
  Partial<Record<(typeof BLOCK_DEFINITIONS)[B]["text"][number], string | null>> &
  Partial<Record<(typeof BLOCK_DEFINITIONS)[B]["nested"][number], EditorBlock[]>>;
export type BlockOf<B extends BlockBundle> = Omit<FieldListItem, "bundle" | "props" | "options"> & {
  bundle: B;
  props: Props<B>;
  options: Record<string, unknown>;
};
export type EditorBlock = { [B in BlockBundle]: BlockOf<B> }[BlockBundle];

export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function invalid(): never {
  throw new Error("Invalid editor content");
}
/** JSON only: reject cycles, unsafe keys and non-finite numbers before cloning or assigning. */
export function assertEditorJson(value: unknown, depth = 0, seen = new Set<object>()): void {
  if (depth > 64) invalid();
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number" && Number.isFinite(value)) return;
  if (typeof value !== "object" || seen.has(value)) invalid();
  if (!Array.isArray(value) && Object.prototype.toString.call(value) !== "[object Object]") invalid();
  seen.add(value);
  for (const [key, child] of Object.entries(value)) {
    if (["__proto__", "constructor", "prototype"].includes(key)) invalid();
    if (child === undefined && !Array.isArray(value)) continue;
    assertEditorJson(child, depth + 1, seen);
  }
  seen.delete(value);
}
export function cloneEditorJson<T>(value: T): T {
  assertEditorJson(value);
  // JSON validation above guarantees that serialization preserves this data model.
  return JSON.parse(JSON.stringify(value)) as T;
}
export function isBlockBundle(value: string): value is BlockBundle {
  return Object.hasOwn(BLOCK_DEFINITIONS, value);
}
export function nestedFields(bundle: BlockBundle): readonly NestedField[] {
  return BLOCK_DEFINITIONS[bundle].nested;
}
export function nestedBlocks(block: EditorBlock, field: string): EditorBlock[] | undefined {
  if (!nestedFields(block.bundle).some((key) => key === field)) return undefined;
  const value = block.props[field];
  // Only validated block trees and the adapter's checked constructors enter this model.
  return Array.isArray(value) ? (value as EditorBlock[]) : undefined;
}
export function ensureNestedBlocks(block: EditorBlock, field: string): EditorBlock[] {
  if (!nestedFields(block.bundle).some((key) => key === field)) invalid();
  if (!block.props[field]) block.props[field] = [];
  const result = nestedBlocks(block, field);
  return result ?? invalid();
}

/** Validate the complete tree. Never silently remove malformed content from a recoverable draft. */
export function parseEditorBlocks(input: unknown): EditorBlock[] {
  assertEditorJson(input);
  const ids = new Set<string>();
  let count = 0;
  function parseList(value: unknown, depth: number): EditorBlock[] {
    if (!Array.isArray(value) || depth > 32 || (depth === 0 && value.length > 500)) invalid();
    return value.map((raw: unknown) => {
      if (
        !isRecord(raw) ||
        typeof raw.uuid !== "string" ||
        !raw.uuid ||
        raw.uuid.length > 100 ||
        ids.has(raw.uuid) ||
        typeof raw.bundle !== "string" ||
        !isBlockBundle(raw.bundle) ||
        ++count > 5000
      )
        invalid();
      ids.add(raw.uuid);
      if (raw.isVisible !== undefined && typeof raw.isVisible !== "boolean") invalid();
      const props = raw.props == null ? {} : raw.props;
      const options = raw.options == null ? {} : raw.options;
      if (!isRecord(props) || !isRecord(options)) invalid();
      const definition = BLOCK_DEFINITIONS[raw.bundle];
      const mapped = { ...props };
      for (const key of definition.text) {
        if (props[key] !== undefined && props[key] !== null && typeof props[key] !== "string") invalid();
      }
      for (const key of definition.nested) {
        mapped[key] = parseList(props[key] ?? [], depth + 1);
      }
      // The discriminant, known props, nested children and JSON extras have all been checked above.
      return {
        uuid: raw.uuid,
        bundle: raw.bundle,
        isVisible: raw.isVisible !== false,
        props: mapped,
        options: { ...options },
      } as EditorBlock;
    });
  }
  return parseList(input, 0);
}
export function createEditorBlock<B extends BlockBundle>(
  bundle: B,
  props?: Record<string, unknown>,
  options?: Record<string, unknown>,
  uuid?: string,
): Extract<EditorBlock, { bundle: B }>;
export function createEditorBlock(
  bundle: string,
  props?: Record<string, unknown>,
  options?: Record<string, unknown>,
  uuid?: string,
): EditorBlock;
export function createEditorBlock(
  bundle: string,
  props: Record<string, unknown> = {},
  options: Record<string, unknown> = {},
  uuid: string = crypto.randomUUID(),
): EditorBlock {
  const block = parseEditorBlocks([{ uuid, bundle, props, options }])[0];
  return block ?? invalid();
}

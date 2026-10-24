import { z } from "zod";
import type { MutationItem } from "#blokkli/editor/types/state";
import { parseEditorBlocks } from "../editorBlocks";
const mutation = z
  .object({
    timestamp: z.string().optional(),
    pluginId: z.string().optional(),
    enabled: z.boolean().optional(),
    plugin: z.object({ label: z.string().optional(), affectedItemUuid: z.string().optional() }).optional(),
  })
  .transform((value): MutationItem => ({
    ...(value.timestamp === undefined ? {} : { timestamp: value.timestamp }),
    ...(value.pluginId === undefined ? {} : { pluginId: value.pluginId }),
    ...(value.enabled === undefined ? {} : { enabled: value.enabled }),
    ...(value.plugin === undefined
      ? {}
      : {
          plugin: {
            ...(value.plugin.label === undefined ? {} : { label: value.plugin.label }),
            ...(value.plugin.affectedItemUuid === undefined ? {} : { affectedItemUuid: value.plugin.affectedItemUuid }),
          },
        }),
  }));
const blocks = z.unknown().transform((value, ctx) => {
  try {
    return parseEditorBlocks(value);
  } catch {
    ctx.addIssue({ code: "custom", message: "Invalid editor blocks" });
    return z.NEVER;
  }
});
export const PersistenceResponseSchema = z.object({ blocks, revision: z.string().min(1) });
export const StoredDraftSchema = z
  .object({
    blocks,
    mutations: z.array(mutation).max(10000).default([]),
    currentIndex: z.number().int().min(-1).default(-1),
    baseRevision: z.string().default(""),
    updatedAt: z.string().default(""),
    ownerId: z.string().default(""),
  })
  .refine((value) => value.currentIndex < value.mutations.length);
export type StoredDraft = z.output<typeof StoredDraftSchema>;
export const EditStateSchema = z.object({
  id: z.number().int(),
  owner: z.union([z.string(), z.object({ id: z.string() })]).nullish(),
  owner_name: z.string().nullish(),
  current_index: z.number().int().nullish(),
  mutations: z.unknown().optional(),
  draft_blocks: z.unknown().optional(),
  base_revision: z.string().nullish(),
  date_updated: z.string().nullish(),
});
export const LibraryItemSchema = z
  .object({
    uuid: z.string(),
    label: z.string().optional(),
    bundle: z.string(),
    props: z.unknown().optional(),
    options: z.unknown().optional(),
  })
  .transform((value) => ({ ...value, block: parseEditorBlocks([value])[0]! }));
export const PermissionsSchema = z.record(
  z.string(),
  z.record(z.string(), z.object({ access: z.enum(["full", "partial", "none"]) })),
);

export const EditorFilesSchema = z
  .array(
    z.object({ id: z.string().min(1).max(100), title: z.string().nullish(), filename_download: z.string().nullish() }),
  )
  .max(25);

import { parseEditorBlocks } from "./editorBlocks";
export const BLOKKLI_CONTENT_FIELD = "content";
export function getBlokkliDataKey(entityType: string, entityUuid: string): string {
  return `blokkli-blocks-${entityType}-${entityUuid}`;
}
export const mapBlokkliBlocks = parseEditorBlocks;

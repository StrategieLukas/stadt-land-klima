export type EditorDraftState = {
  id: number;
  entity_type: string;
  entity_uuid: string;
  draft_blocks: unknown;
  mutations: unknown;
  current_index: number | null;
  base_revision: string | null;
};

export const editorDraftStateFields = ["id", "draft_blocks", "mutations", "current_index", "base_revision"] as const;

/** Legacy editor placeholders contain no saved snapshot, revision or editing history. */
export function isPristineEditorState(
  state: Pick<EditorDraftState, "draft_blocks" | "mutations" | "current_index" | "base_revision">,
): boolean {
  return (
    state.draft_blocks === null &&
    Array.isArray(state.mutations) &&
    state.mutations.length === 0 &&
    state.current_index === -1 &&
    state.base_revision === null
  );
}

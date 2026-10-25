import type { CoreSchema } from "@directus/sdk";
import type { EditorBlock } from "~/shared/editorBlocks";
import type { MutationItem } from "#blokkli/editor/types/state";
export interface EditState {
  id: number;
  entity_type: string;
  entity_uuid: string;
  entity_bundle: string;
  owner: string | null;
  owner_name: string;
  current_index: number;
  mutations: MutationItem[];
  draft_blocks: EditorBlock[] | null;
  base_revision: string;
  date_updated: string | null;
}
export interface ReusableBlock {
  id: number;
  uuid: string;
  label: string;
  bundle: string;
  props: Record<string, unknown>;
  options: Record<string, unknown>;
  date_created: string;
}
interface Collections {
  edit_states: EditState[];
  library_items: ReusableBlock[];
}
export type BlokkliCmsSchema = Collections & CoreSchema<Collections>;

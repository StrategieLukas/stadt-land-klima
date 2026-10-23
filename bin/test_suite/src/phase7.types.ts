import type { BlockOf } from "../../../src/frontend/shared/editorBlocks.js";
// Checked by the harness compiler; these must stay rejected when the model changes.
const validHeading: BlockOf<"heading">["props"] = { text: "Heading" };
// @ts-expect-error Heading text cannot contain nested blocks.
const invalidHeading: BlockOf<"heading">["props"] = { text: [] };
// @ts-expect-error A form field's label is a block list, not a string.
const invalidLabel: BlockOf<"form_field">["props"] = { label: "Label" };
void [validHeading, invalidHeading, invalidLabel];

// A runtime-known registered bundle must still produce the discriminated union.
import type { BlockBundle, EditorBlock } from "../../../src/frontend/shared/editorBlocks.js";
import { createEditorBlock } from "../../../src/frontend/shared/editorBlocks.js";
declare const registeredBundle: BlockBundle;
const dynamicBlock: EditorBlock = createEditorBlock(registeredBundle);
void dynamicBlock;

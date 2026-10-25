import { createError } from "h3";
import { BLOCK_DEFINITIONS, parseEditorBlocks, type EditorBlock } from "~/shared/editorBlocks";
import { readPublicBlocks } from "./publicBlocks";

const text = (value: unknown) => (typeof value === "string" ? value : "");
/** The caller selects a published owner, never the form's routing or field contract. */
export async function publishedForm(entityType: string, entityUuid: string, uuid: string) {
  const roots = parseEditorBlocks(await readPublicBlocks(entityType, entityUuid));
  function find(blocks: EditorBlock[]): Extract<EditorBlock, { bundle: "form" }> | undefined {
    for (const block of blocks) {
      if (block.bundle === "form" && block.uuid === uuid) return block;
      for (const key of BLOCK_DEFINITIONS[block.bundle].nested) {
        const children: unknown = block.props[key];
        if (Array.isArray(children)) {
          const match = find(children as EditorBlock[]);
          if (match) return match;
        }
      }
    }
    return undefined;
  }
  const form = find(roots);
  if (!form) throw createError({ statusCode: 404, statusMessage: "Published form not found" });
  const fields = (form.props.fields ?? [])
    .filter((field) => field.bundle === "form_field")
    .map((field) => {
      const options = field.options;
      const name =
        text(options.fieldName)
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9_]+/g, "_")
          .replace(/^_+|_+$/g, "")
          .slice(0, 60) || `field_${field.uuid.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12)}`;
      const labels = (field.props.label ?? [])
        .map((label) => text(label.props.text))
        .filter(Boolean)
        .join(" ");
      return {
        name,
        label: labels || name,
        type: text(options.fieldType) || "text",
        required: options.required === true,
      };
    });
  return {
    fields,
    formKey: text(form.options.formKey).trim() || form.uuid,
    formTitle: form.props.title || "Formular",
    notificationEmail: text(form.options.notificationEmail).trim(),
    sendCopy: form.options.sendCopy !== false,
  };
}

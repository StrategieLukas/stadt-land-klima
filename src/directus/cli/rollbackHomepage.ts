import { deleteItem, readItems } from "@directus/sdk";
import { readFileSync } from "node:fs";
import createDirectusClient from "./tasks/shared/createDirectusClient.ts";

// Operator-only release rollback: never remove a block that an editor changed.
const page: unknown = JSON.parse(readFileSync(0, "utf8"));
if (!page || typeof page !== "object" || !("id" in page) || typeof page.id !== "string") {
  throw new Error("A saved homepage checkpoint is required");
}
const client = createDirectusClient<{
  blocks: {
    id: number;
    uuid: string;
    entity_type: string;
    entity_uuid: string;
    bundle: string;
    props: Record<string, unknown>;
    options: Record<string, unknown>;
    status: string;
    field_name: string;
    sort_order: number;
  }[];
  edit_states: { id: number; entity_type: string; entity_uuid: string }[];
}>();
const filter = { entity_type: { _eq: "pages" }, entity_uuid: { _eq: page.id } };
const blocks = await client.request(
  readItems("blocks", {
    filter,
    fields: ["id", "uuid", "bundle", "props", "options", "status", "field_name", "sort_order"],
    limit: 2,
  }),
);
const drafts = await client.request(readItems("edit_states", { filter, fields: ["id"], limit: 1 }));
const block = blocks[0];
if (blocks.length === 0) process.exit(0);
if (
  drafts.length ||
  blocks.length !== 1 ||
  block?.uuid !== "32233232-4056-4b53-92e1-59e4ca3f5a01" ||
  block.bundle !== "landing_page" ||
  block.status !== "published" ||
  block.field_name !== "content" ||
  block.sort_order !== 0 ||
  !block.options ||
  Object.keys(block.options).length !== 0 ||
  Object.keys(block.props).sort().join() !== "subtitle,title" ||
  block.props.title !== "" ||
  block.props.subtitle !== ""
) {
  throw new Error("Homepage was edited; preserve it and review rollback manually");
}
await client.request(deleteItem("blocks", block.id));

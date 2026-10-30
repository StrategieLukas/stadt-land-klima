import { createItem, readItems } from "@directus/sdk";
import createDirectusClient from "../shared/createDirectusClient.ts";

/** Add an editable landing block only to an unmigrated homepage. Legacy HTML stays recoverable. */
export async function seedHomepage() {
  const client = createDirectusClient<{
    pages: { id: string; slug: string; status: string }[];
    blocks: {
      id: number;
      uuid: string;
      entity_type: string;
      entity_uuid: string;
      field_name: string;
      bundle: string;
      props: { title: string; subtitle: string };
      options: Record<string, never>;
      status: string;
      sort_order: number;
    }[];
    edit_states: { id: number; entity_type: string; entity_uuid: string }[];
  }>();
  const [page] = await client.request(
    readItems("pages", { filter: { slug: { _eq: "index" }, status: { _eq: "published" } }, fields: ["id"], limit: 1 }),
  );
  if (!page) return;
  const filter = { entity_type: { _eq: "pages" }, entity_uuid: { _eq: page.id } };
  const [blocks, drafts] = await Promise.all([
    client.request(readItems("blocks", { filter, fields: ["id"], limit: 1 })),
    client.request(readItems("edit_states", { filter, fields: ["id"], limit: 1 })),
  ]);
  // Existing authored content and in-flight drafts always win, including after a rollback.
  if (blocks.length || drafts.length) return;
  await client.request(
    createItem("blocks", {
      uuid: "32233232-4056-4b53-92e1-59e4ca3f5a01",
      entity_type: "pages",
      entity_uuid: page.id,
      field_name: "content",
      bundle: "landing_page",
      props: { title: "", subtitle: "" },
      options: {},
      status: "published",
      sort_order: 0,
    }),
  );
}

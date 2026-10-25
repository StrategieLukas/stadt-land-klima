import { readItems, readUsers } from "@directus/sdk";
import type { createDirectusServerClient } from "./directusServerClient";
import { cmsRows } from "./cmsValue";
import { STATIC_PAGES } from "./extractContent";

type Hit = { id: string | number; type: string; url: string };

/** Search is a cache, never an authority for publication or team-member visibility. */
export async function publicSearchHits<T extends Hit>(
  client: ReturnType<typeof createDirectusServerClient>,
  hits: T[],
): Promise<T[]> {
  const allowed = new Set<string>();
  const key = (hit: Hit) => `${hit.type}:${hit.id}:${hit.url}`;
  const rows = async (collection: string, filter: Record<string, unknown>, fields: string[]) =>
    cmsRows(await client.request(readItems(collection, { filter, fields, limit: -1 })));
  await Promise.all(
    ["page", "event", "article", "news_item", "measure", "member", "block", "static_page"].map(async (type) => {
      const group = hits.filter((hit) => hit.type === type);
      if (!group.length) return;
      if (type === "static_page") {
        for (const hit of group)
          if (STATIC_PAGES.some((page) => page.id === hit.id && page.url === hit.url)) allowed.add(key(hit));
        return;
      }
      const ids = group.map((hit) => String(hit.id).slice(`${type}_`.length));
      if (group.some((hit) => !String(hit.id).startsWith(`${type}_`))) throw new Error("Invalid search identity");
      if (type === "member") {
        const members = cmsRows(
          await client.request(
            readUsers({
              filter: { id: { _in: ids }, show_on_team_page: { _eq: true } },
              fields: ["id", "show_on_team_page"],
              limit: -1,
            }),
          ),
        );
        for (const hit of group)
          if (
            members.some(
              (member) =>
                member.show_on_team_page === true &&
                `member_${String(member.id)}` === hit.id &&
                hit.url === `/organisation#member-${String(member.id)}`,
            )
          )
            allowed.add(key(hit));
        return;
      }
      if (type === "block") {
        const blocks = await rows(
          "blocks",
          {
            uuid: { _in: ids },
            status: { _eq: "published" },
            field_name: { _eq: "content" },
            entity_type: { _in: ["pages", "news_items"] },
          },
          ["uuid", "entity_type", "entity_uuid", "status"],
        );
        for (const collection of ["pages", "news_items"]) {
          const children = blocks.filter((block) => block.status === "published" && block.entity_type === collection);
          if (!children.length) continue;
          const entities = children.map((block) => block.entity_uuid);
          const uuidEntities = entities.filter(
            (value): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value),
          );
          const parents = await rows(
            collection,
            { status: { _eq: "published" }, _or: [{ id: { _in: uuidEntities } }, { slug: { _in: entities } }] },
            ["id", "slug", "status"],
          );
          for (const hit of group)
            if (
              children.some(
                (block) =>
                  `block_${String(block.uuid)}` === hit.id &&
                  parents.some(
                    (parent) =>
                      parent.status === "published" &&
                      (parent.id === block.entity_uuid || parent.slug === block.entity_uuid) &&
                      hit.url ===
                        `${collection === "news_items" ? "/news" : ""}/${String(parent.slug)}#block-${String(block.uuid)}`,
                  ),
              )
            )
              allowed.add(key(hit));
        }
        return;
      }
      const collection = {
        page: "pages",
        event: "events",
        article: "articles",
        news_item: "news_items",
        measure: "measures",
      }[type];
      if (!collection) return;
      const filter =
        type === "measure"
          ? { catalog_version: { hidden: { _eq: false }, isCurrentFrontend: { _eq: true } } }
          : { status: { _eq: "published" } };
      const published = await rows(
        collection,
        { ...filter, slug: { _in: ids } },
        type === "measure" ? ["slug"] : ["slug", "status"],
      );
      const prefix = { page: "", event: "/events", article: "/projects", news_item: "/news", measure: "/measures" }[
        type
      ];
      for (const hit of group)
        if (
          published.some(
            (row) =>
              (type === "measure" || row.status === "published") &&
              `${type}_${String(row.slug)}` === hit.id &&
              new URL(hit.url, "https://search.invalid").pathname === `${prefix}/${String(row.slug)}`,
          )
        )
          allowed.add(key(hit));
    }),
  );
  return hits.filter((hit) => allowed.has(key(hit)));
}

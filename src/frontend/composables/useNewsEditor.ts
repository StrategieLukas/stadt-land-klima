import { z } from "zod";
import { readItems, createItem, updateItem } from "@directus/sdk";
import { NewsDetailSchema, NewsListSchema } from "~/shared/contracts/content";
import { useAuth } from "~/composables/useAuth";

const EditorListSchema = NewsListSchema.extend({ status: z.string() });
type News = z.output<typeof NewsDetailSchema>;
interface File {
  id: string;
  type: string | null;
}
interface Series {
  id: string;
  slug: string;
  title: string;
  format: string | null;
}
interface Tour {
  id: string;
  slug: string;
  title: string;
}
interface Stop {
  id: string;
  slug: string;
  tour: Tour | null;
}
interface Event {
  id: string;
  slug: string;
  title: string;
  series: Series | null;
}
type CmsNews = Omit<News, "image" | "tour_stop" | "report_event"> & {
  image: File | null;
  tour_stop: Stop | null;
  report_event: Event | null;
};
interface Schema {
  news_items: CmsNews[];
  directus_files: File[];
  success_project_tour_stops: Stop[];
  success_project_tours: Tour[];
  events: Event[];
  event_series: Series[];
}
export function useNewsEditor() {
  const { getAuthenticatedClient } = useAuth();
  const client = () => getAuthenticatedClient<Schema>();
  const detailFields = [
    "id",
    "slug",
    "title",
    "teaser",
    "author",
    "date_published",
    "date_created",
    "image_credits",
    "status",
    "is_tour_redirect",
    { image: ["id", "type"] },
    { tour_stop: ["id", "slug", { tour: ["slug", "title"] }] },
    { report_event: ["id", "slug", "title", { series: ["slug", "title", "format"] }] },
  ] as const;
  return {
    async list() {
      return z.array(EditorListSchema).parse(
        await client().request(
          readItems("news_items", {
            filter: { is_tour_redirect: { _eq: false } },
            fields: [
              "id",
              "slug",
              "title",
              "teaser",
              { image: ["id", "type"] },
              "image_credits",
              "date_published",
              "date_created",
              "status",
            ],
            sort: ["-date_published", "-date_created"],
            limit: 200,
          }),
        ),
      );
    },
    async detail(slug: string) {
      const rows = await client().request(
        readItems("news_items", { filter: { slug: { _eq: slug } }, fields: [...detailFields], limit: 1 }),
      );
      return rows[0] ? NewsDetailSchema.parse(rows[0]) : null;
    },
    async create(title: string, slug: string) {
      return client().request(createItem("news_items", { title, slug, status: "draft" }, { fields: ["slug"] }));
    },
    async save(
      id: string,
      metadata: Pick<News, "title" | "teaser" | "author" | "date_published" | "status"> & { image: string | null },
    ) {
      await client().request(updateItem("news_items", id, metadata));
    },
  };
}

import { readItems } from "@directus/sdk";
import { defineEventHandler, setResponseHeader } from "h3";
import { createDirectusServerClient } from "../../utils/directusServerClient";

export default defineEventHandler(async (event) => {
  const client = createDirectusServerClient();
  const [news, articles, events, municipalities, catalogs, visitReports] = await Promise.all([
    client.request(
      readItems("news_items", {
        filter: { status: { _eq: "published" }, is_tour_redirect: { _eq: false } },
        fields: [
          "id",
          "slug",
          "title",
          "teaser",
          { image: ["id", "type"] },
          "image_credits",
          "date_published",
          "date_created",
        ],
        sort: ["-date_published", "-date_created"],
        limit: 50,
      }),
    ),
    client.request(
      readItems("articles", {
        filter: { status: { _eq: "published" } },
        fields: ["id", "slug", "title", "abstract", { image: ["id", "type"] }, "image_credits", "date_created"],
        sort: ["-date_created"],
        limit: 20,
      }),
    ),
    client.request(
      readItems("events", {
        filter: { status: { _eq: "published" } },
        fields: [
          "id",
          "slug",
          "title",
          "description",
          "event_type",
          "event_category",
          "date_only",
          "start_date",
          "end_date",
          "date_created",
          { image: ["id", "type"] },
          "image_credits",
          "location",
        ],
        sort: ["-start_date"],
        limit: 20,
      }),
    ),
    client.request(
      readItems("municipalities", {
        filter: { status: { _eq: "published" } },
        fields: ["id", "slug", "name", "description", "date_updated", { image: ["id", "type"] }, "image_credits"],
        sort: ["-date_updated"],
        limit: 20,
      }),
    ),
    client.request(
      readItems("measure_catalog", {
        filter: { hidden: { _eq: false } },
        fields: ["id", "name", "date_created"],
        sort: ["-date_created"],
        limit: 10,
      }),
    ),
    client.request(
      readItems("success_project_tour_stops", {
        filter: {
          status: { _eq: "published" },
          report_status: { _eq: "published" },
          tour: { status: { _eq: "published" } },
        },
        fields: [
          "id",
          "slug",
          "report_title",
          "title",
          "teaser",
          "date_published",
          "image_credits",
          "start_date",
          "end_date",
          "date_only",
          "location",
          { image: ["id", "type"] },
          { tour: ["slug"] },
        ],
        sort: ["-date_published"],
        limit: 50,
      }),
    ),
  ]);
  setResponseHeader(event, "Cache-Control", "public, max-age=60");
  return { news, articles, events, municipalities, catalogs, visitReports };
});

/** Default public chart configuration shared by the renderer and server. */
export const defaultVegaQuery = JSON.stringify(
  {
    collection: "ratings_measures",
    query: {
      filter: {
        measure_id: { catalog_version: { name: { _eq: "v1.0" } } },
        status: { _eq: "published" },
        applicable: { _eq: true },
      },
      fields: ["id", "rating", "measure_id.sector", "measure_id.name", "measure_id.measure_id"],
      limit: -1,
    },
  },
  null,
  2,
);

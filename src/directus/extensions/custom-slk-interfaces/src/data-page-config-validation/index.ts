import { defineHook } from "@directus/extensions-sdk";
import { createError } from "@directus/errors";
import { getDataPageCatalog } from "../data-page-catalog/catalog";

type Payload = Record<string, unknown>;
type Meta = { collection?: string };
const InvalidDataPageConfig = createError<{ reason: string }>(
  "INVALID_DATA_PAGE_CONFIG",
  ({ reason }) => reason,
  400,
);

export default defineHook(({ filter }, { env }) => {
  const validate = async (
    payload: Payload,
    meta: Meta,
    { database }: { database: any },
  ) => {
    if (meta.collection !== "data_page_config") return payload;

    const current = (await database("data_page_config")
      .select("include_only", "collection_ids")
      .first()) as
      | { include_only?: boolean; collection_ids?: string[] }
      | undefined;
    const includeOnly =
      (payload.include_only ?? current?.include_only) === true;
    const ids = payload.collection_ids ?? current?.collection_ids ?? [];
    if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string")) {
      throw new InvalidDataPageConfig({
        reason: "Die Datenprodukt-Auswahl muss eine Liste von IDs sein.",
      });
    }
    if (includeOnly && ids.length === 0) {
      throw new InvalidDataPageConfig({
        reason:
          "Wähle mindestens ein Datenprodukt für „Nur ausgewählte Datenprodukte anzeigen“ aus.",
      });
    }
    if (!includeOnly && ids.length > 0) {
      const catalog = await getDataPageCatalog(env.DATA_PAGE_CATALOG_BASE_URL);
      if (
        catalog.length > 0 &&
        catalog.every((entry) => ids.includes(entry.id))
      ) {
        throw new InvalidDataPageConfig({
          reason: "Mindestens ein Datenprodukt muss sichtbar bleiben.",
        });
      }
    }
    return payload;
  };

  filter("items.create", validate);
  filter("items.update", validate);
});

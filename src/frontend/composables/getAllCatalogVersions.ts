import { z } from "zod";
import { CatalogSchema } from "~/shared/contracts/search";
export async function getAllCatalogVersions() {
  return z.array(CatalogSchema).parse(await $fetch("/api/public/catalogs"));
}

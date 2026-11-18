import { createFolder, readFolders } from "@directus/sdk";
import { z } from "zod";
import createDirectusClient from "../shared/createDirectusClient.ts";
import readYamlFile from "../shared/readYamlFile.ts";

/** Seed required folders without renaming, deleting or moving existing assets. */
export default async function importFolders(src: string): Promise<void> {
  const folders = readYamlFile(src, z.array(z.object({ id: z.uuid(), name: z.string().trim().min(1) }).strict()));
  const client = createDirectusClient();
  const existing = await client.request(readFolders({ fields: ["id", "name"], limit: -1 }));
  for (const folder of folders) {
    if (existing.some((item) => item.name === folder.name)) continue;
    if (existing.some((item) => item.id === folder.id))
      throw new Error("Required folder ID is already assigned to another folder; refusing to rename it");
    const created = await client.request(createFolder(folder));
    existing.push(created);
  }
}

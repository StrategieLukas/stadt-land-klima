// This file is also mounted alone into the disposable storage-cutover helper.
import { existsSync, renameSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";
export function cutover(storage: string, id: string, move: typeof renameSync = renameSync) {
  if (!id || !/^[A-Za-z0-9_-]+$/.test(id) || !storage.startsWith("/")) throw new Error("Invalid cutover paths");
  for (const name of ["db", "meilisearch"]) {
    if (
      !existsSync(join(storage, name)) ||
      !existsSync(join(storage, `${name}.upgrade-${id}`)) ||
      existsSync(join(storage, `${name}.before-${id}`))
    )
      throw new Error("Cutover preflight failed");
  }
  try {
    for (const name of ["db", "meilisearch"]) {
      move(join(storage, name), join(storage, `${name}.before-${id}`));
      move(join(storage, `${name}.upgrade-${id}`), join(storage, name));
    }
  } catch (error) {
    for (const name of ["db", "meilisearch"])
      if (existsSync(join(storage, `${name}.before-${id}`))) {
        if (existsSync(join(storage, name))) move(join(storage, name), join(storage, `${name}.upgrade-${id}`));
        move(join(storage, `${name}.before-${id}`), join(storage, name));
      }
    throw error;
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [id, storage = "/storage"] = process.argv.slice(2);
  if (!id) throw new Error("Missing upgrade identifier");
  cutover(storage, id);
}

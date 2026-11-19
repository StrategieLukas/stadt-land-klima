/** Sent on stdin to the existing development frontend image, never run on the host. */
import { existsSync, lstatSync, realpathSync, rmSync } from "node:fs";

if (process.env.SLK_ENV !== "development" || realpathSync(process.cwd()) !== "/frontend")
  throw new Error("Development cache cleanup must run inside the selected frontend container.");

for (const parent of ["/frontend/.nuxt", "/frontend/node_modules"])
  if (existsSync(parent) && lstatSync(parent).isSymbolicLink())
    throw new Error("Refusing to clear development caches through a symlinked parent.");

for (const directory of ["/frontend/.nuxt/cache", "/frontend/node_modules/.cache", "/frontend/node_modules/.vite"])
  rmSync(directory, { recursive: true, force: true });

console.log("Development response and compiler caches removed.");

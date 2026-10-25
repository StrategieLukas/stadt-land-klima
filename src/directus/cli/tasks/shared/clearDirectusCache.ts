import { clearCache } from "@directus/sdk";
import createDirectusClient from "./createDirectusClient.ts";
import type { TaskOptions } from "./models.ts";

async function clearDirectusCache(options: TaskOptions = {}) {
  const client = createDirectusClient();

  if (options.verbose) console.info("Clearing cache");
  await client.request(clearCache());
}

export default clearDirectusCache;

import { readMe } from "@directus/sdk";
import createDirectusClient from "../shared/createDirectusClient.ts";

export async function checkAuth() {
  try {
    const directus = createDirectusClient();
    await directus.request(readMe());
    console.log("\x1b[32m%s\x1b[0m", "Success!");
  } catch (error) {
    console.log(error);
    process.exit(1);
  }
}

import createDirectusClient from "../shared/createDirectusClient.js";
import { readMe } from "@directus/sdk";

export async function checkAuth(): Promise<void> {
  try {
    const directus = createDirectusClient();
    await directus.request(readMe());
    console.log('\x1b[32m%s\x1b[0m', 'Success!');

  } catch (error: any) {
    console.log(error);
    process.exit(1);
  }
}

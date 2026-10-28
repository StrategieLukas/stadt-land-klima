import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { provisionServiceUsers } from "./tasks/provisionServiceUsers.ts";
import { createStoredTokenReader } from "./security/storedUserToken.ts";

/** Uses the same guarded provisioning as the existing service identities. Redirect stdout
 * straight to private configuration; never paste the resulting token into browser settings.
 */
export async function provisionTranslationWorker(
  url: string,
  token: string,
  stored: ReturnType<typeof createStoredTokenReader>,
) {
  return provisionServiceUsers(url, token, stored.read, [
    {
      role: "Content-Translation-Worker",
      email: "content-translation-worker@stadt-land-klima.de",
      lastName: "Translation Worker",
      variable: "CONTENT_TRANSLATION_WORKER_TOKEN",
    },
  ]);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const token = process.env.CLI_DIRECTUS_STATIC_TOKEN;
  if (!token) throw new Error("CLI_DIRECTUS_STATIC_TOKEN is required");
  const stored = createStoredTokenReader();
  try {
    const values = await provisionTranslationWorker(process.env.DIRECTUS_URL || "http://localhost:8081", token, stored);
    for (const [key, value] of Object.entries(values)) console.info(`${key}=${value}`);
  } finally {
    await stored.close();
  }
}

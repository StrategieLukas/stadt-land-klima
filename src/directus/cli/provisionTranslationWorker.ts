import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { provisionServiceUsers } from "./tasks/provisionServiceUsers.ts";
import { createStoredTokenReader } from "./security/storedUserToken.ts";
import { createDirectus, customEndpoint, readUsers, rest, staticToken } from "@directus/sdk";
import { z } from "zod";

/** Uses the same guarded provisioning as the existing service identities. Redirect stdout
 * straight to private configuration; never paste the resulting token into browser settings.
 */
export async function provisionTranslationWorker(
  url: string,
  token: string,
  stored: ReturnType<typeof createStoredTokenReader>,
  configuredToken?: string,
) {
  // An existing account must never gain inherited or ordinary CMS access.
  const client = createDirectus<{}>(url).with(staticToken(token)).with(rest());
  const roles = await client.request(customEndpoint({
    path: "/roles", method: "GET",
    params: {
      filter: { name: { _eq: "Content-Translation-Worker" } },
      fields: "id,parent,policies.policy.id,policies.policy.name,policies.policy.admin_access,policies.policy.app_access,policies.policy.permissions.id",
      limit: 2,
    },
  }));
  const safe = z.array(z.object({
    id: z.string().min(1), parent: z.null(),
    policies: z.array(z.object({ policy: z.object({
      name: z.literal("Content-Translation-Worker"), admin_access: z.literal(false),
      app_access: z.literal(false), permissions: z.array(z.unknown()).length(0),
    }) })).length(1),
  })).length(1).safeParse(roles);
  if (!safe.success) throw new Error("Translation worker requires its restricted policy, no parent and no collection access");
  const users = await client.request(readUsers({
    filter: { email: { _eq: "content-translation-worker@stadt-land-klima.de" } },
    fields: ["id", "policies"], limit: 2,
  }));
  if (!z.array(z.object({ id: z.string().min(1), policies: z.array(z.unknown()).length(0) })).max(1).safeParse(users).success)
    throw new Error("Translation worker identity has unexpected direct policies or duplicate accounts");
  return provisionServiceUsers(url, token, stored.read, [
    {
      role: "Content-Translation-Worker",
      email: "content-translation-worker@stadt-land-klima.de",
      lastName: "Translation Worker",
      variable: "CONTENT_TRANSLATION_WORKER_TOKEN",
      ...(configuredToken === undefined ? {} : { token: configuredToken }),
    },
  ]);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const token = process.env.CLI_DIRECTUS_STATIC_TOKEN;
  if (!token) throw new Error("CLI_DIRECTUS_STATIC_TOKEN is required");
  const stored = createStoredTokenReader();
  try {
    // Deployment passes a configured token over stdin, never argv or compose metadata.
    let configuredToken: string | undefined;
    if (process.argv.includes("--reconcile")) {
      let input = "";
      for await (const chunk of process.stdin) {
        input += String(chunk);
        if (input.length > 1024) throw new Error("Invalid provisioning input");
      }
      configuredToken = input.trim() || undefined;
    }
    const values = await provisionTranslationWorker(process.env.DIRECTUS_URL || "http://localhost:8055", token, stored, configuredToken);
    for (const [key, value] of Object.entries(values)) console.info(`${key}=${value}`);
  } finally {
    await stored.close();
  }
}

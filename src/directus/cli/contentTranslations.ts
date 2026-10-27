import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

/** Operator-only control through the reviewed endpoint. No database edits and no provider key. */
export async function contentTranslations(
  baseUrl: string,
  token: string,
  args: string[],
  fetcher: typeof globalThis.fetch = globalThis.fetch,
) {
  const [command = "status", value, confirmation] = args;
  let operation: unknown;
  if (command === "enqueue" && args.length <= 2) {
    if (value && !/^[a-zA-Z0-9:._-]{1,128}$/.test(value)) throw new Error("Invalid translation namespace");
    operation = { op: "enqueue", ...(value ? { namespace: value } : {}) };
  } else if (command === "retry" && value && confirmation === "--allow-rebill" && args.length === 3) {
    const keys = value.split(",");
    if (keys.length > 50 || keys.some((key) => !/^content-translation:v1:[a-f0-9]{64}$/.test(key)))
      throw new Error("Invalid translation keys");
    operation = { op: "retry", keys, allowRebill: true };
  } else if (command !== "status" || args.length > 1) {
    throw new Error("Usage: contentTranslations.ts status | enqueue [namespace] | retry key[,key] --allow-rebill");
  }
  const url = new URL(baseUrl);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash || !token)
    throw new Error("Invalid private control configuration");
  const response = await fetcher(
    `${url.toString().replace(/\/$/, "")}/content-translations${operation ? "" : "/status"}`,
    {
      method: operation ? "POST" : "GET",
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
      headers: { Authorization: `Bearer ${token}`, ...(operation ? { "Content-Type": "application/json" } : {}) },
      ...(operation ? { body: JSON.stringify(operation) } : {}),
    },
  );
  if (!response.ok)
    throw new Error(
      `Translation control failed (HTTP ${response.status}); wait for rate limits or check private configuration.`,
    );
  return (await response.json()) as unknown;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const token = process.env.CLI_DIRECTUS_STATIC_TOKEN;
  if (!token) throw new Error("CLI_DIRECTUS_STATIC_TOKEN is required");
  console.info(
    JSON.stringify(
      await contentTranslations(process.env.DIRECTUS_URL || "http://localhost:8081", token, process.argv.slice(2)),
      null,
      2,
    ),
  );
}

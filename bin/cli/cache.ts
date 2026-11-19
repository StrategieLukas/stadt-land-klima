import { readFileSync } from "node:fs";
import { join } from "node:path";
import yaml from "yaml";
import { root, run, type Environment } from "./process.ts";
import type { Runtime } from "./stack.ts";

export function cacheFlushPlan(environment: Environment): string[] {
  return [
    `Flush application caches for ${process.env.SLK_PODMAN_PROJECT || `slk-podman-${environment}`} (${environment}).`,
    "Clear Directus caches through its authenticated, container-local API.",
    "Stop the frontend and restart Directus to clear CMS extension memory caches.",
    ...(environment === "development" ? ["Remove Nuxt response and Vite development cache folders."] : []),
    "Start the frontend to clear its memory caches; wait for CMS-backed API readiness.",
    "Preserve Redis sessions, protection counters, locks, stored translations, search indexes and built output.",
    "Browser caches and external upstream caches are outside this command's scope.",
  ];
}

export async function flushApplicationCaches(rt: Runtime): Promise<void> {
  const running = new Set((await rt.raw(["ps", "--status", "running", "--services"], { capture: true })).split("\n"));
  if (!["directus", "frontend"].every((service) => running.has(service)))
    throw new Error("Start Directus and frontend before flushing application caches.");
  if (rt.environment === "development") {
    const config = yaml.parse(await rt.raw(["config"], { capture: true })) as {
      services?: { frontend?: { image?: string } };
    };
    const image = config.services?.frontend?.image;
    if (typeof image !== "string" || !image) throw new Error("The frontend service has no configured image.");
    try {
      // Compose run would otherwise build a missing image, even without --build.
      await run("podman", ["--remote=false", "image", "exists", image], { env: rt.env, quiet: true });
    } catch {
      throw new Error("The configured frontend image is unavailable. Cache flush never builds images.");
    }
  }

  console.log(`Clearing Directus caches (${rt.project})...`);
  // Bind this credential-dependent request to the selected container, even when
  // a copied dotenv still names a different CMS origin.
  await rt.compose(
    [
      "exec",
      "-T",
      "-e",
      "FRONTEND_DIRECTUS_URL=http://127.0.0.1:8055",
      "directus",
      "node",
      "--input-type=module",
      "--eval",
      "const { default: clear } = await import('/directus/cli/tasks/shared/clearDirectusCache.ts'); await clear();",
    ],
    { capture: true, label: "Directus cache clear" },
  );

  // Stop writers before removing persisted development response caches.
  let clearFailure: unknown;
  try {
    await rt.raw(["stop", "frontend"]);
    console.log("Restarting Directus to clear extension memory caches...");
    await rt.raw(["restart", "directus"]);
    await rt.ready(`http://127.0.0.1:${rt.cmsPort}/server/health`);
    if (rt.environment === "development") {
      console.log("Clearing Nuxt and Vite development caches...");
      // Reuse the existing image and mounts, without its application entrypoint,
      // dependency installation, published ports or a container build.
      await rt.raw(
        ["run", "--rm", "--no-deps", "-T", "--entrypoint", "node", "frontend", "--input-type=module-typescript"],
        { input: readFileSync(join(root, "bin/lib/clear-frontend-cache.ts"), "utf8") },
      );
    }
  } catch (error) {
    clearFailure = error;
  }

  try {
    console.log("Starting frontend and checking CMS-backed readiness...");
    await rt.raw(["start", "frontend"]);
    for (const path of ["/api/public/site-layout", "/api/public/catalogs"])
      await rt.ready(`http://127.0.0.1:${rt.webPort}${path}`);
  } catch (error) {
    if (clearFailure)
      throw new AggregateError([clearFailure, error], "Cache clearing failed and frontend recovery also failed.");
    throw error;
  }
  if (clearFailure) throw clearFailure;
  console.log("Application caches flushed. Directus and frontend are ready; reload open browser pages.");
}

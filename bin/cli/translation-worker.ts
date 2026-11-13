/** Reconcile the private worker before frontend startup; never expose its credential to argv/logs. */
import dotenv from "dotenv";
import { lstatSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { assertPrivatePodmanFile } from "../lib/podman-security.ts";
import { frontendRuntimeEnvironment, translationDeploymentTarget } from "../../src/frontend/shared/runtimeEnvironment.ts";
import { root } from "./process.ts";
import type { Runtime } from "./stack.ts";

export async function reconcileTranslationWorker(rt: Runtime): Promise<void> {
  if (rt.environment !== "production") return;
  const path = resolve(rt.env.SLK_PODMAN_FRONTEND_ENV_FILE || resolve(root, "src/frontend/.env"));
  assertPrivatePodmanFile(lstatSync(path), process.getuid!());
  const source = readFileSync(path, "utf8");
  const settings = dotenv.parse(source);
  const target = translationDeploymentTarget(rt.environment, rt.env.SLK_DEPLOYMENT_TARGET ?? settings.SLK_DEPLOYMENT_TARGET);
  if (target !== "production") return;
  const mapped = frontendRuntimeEnvironment({ ...settings, SLK_ENV: rt.environment, SLK_DEPLOYMENT_TARGET: target });
  if (mapped.NUXT_CONTENT_TRANSLATION_ENABLED !== "true" || mapped.NUXT_CONTENT_TRANSLATION_GENERATION_ENABLED !== "true") return;
  if (!mapped.NUXT_DEEPL_API_KEY) return; // Explicitly paused/missing-key deployments do no provider work.
  const configured = mapped.NUXT_CONTENT_TRANSLATION_WORKER_TOKEN;
  if (configured !== undefined && configured !== "" && !/^[a-f0-9]{64}$/.test(configured))
    throw new Error("Translation worker token is invalid; repair the private frontend environment");
  let output: string;
  try {
    output = await rt.compose([
      "exec", "-T", "-e", "DIRECTUS_URL=http://127.0.0.1:8055", "directus", "node", "/directus/cli/provisionTranslationWorker.ts", "--reconcile",
    ], { capture: true, input: configured || "" });
  } catch {
    throw new Error("Translation worker provisioning failed; frontend remains stopped. Check the restricted role and private CLI credential.");
  }
  const match = /^CONTENT_TRANSLATION_WORKER_TOKEN=([a-f0-9]{64})$/.exec(output.trim());
  if (!match?.[1]) throw new Error("Translation worker provisioning returned an invalid credential; private output withheld");
  const token = match[1];
  if (token === configured) return;
  // Reuse the stored account token. Never rotate a working identity on redeploy.
  // Replace every legacy/Nuxt assignment, including exported and duplicate values.
  const next = source.split(/\r?\n/).filter((line) => !/^\s*(?:export\s+)?(?:NUXT_)?CONTENT_TRANSLATION_WORKER_TOKEN\s*=/.test(line)).join("\n").replace(/\n*$/, "\n") +
    `CONTENT_TRANSLATION_WORKER_TOKEN=${token}\nNUXT_CONTENT_TRANSLATION_WORKER_TOKEN=${token}\n`;
  const temporary = `${path}.${randomUUID()}`;
  try {
    writeFileSync(temporary, next, { mode: 0o600, flag: "wx" });
    if (readFileSync(path, "utf8") !== source) throw new Error("Private frontend environment changed during provisioning; retry deployment");
    renameSync(temporary, path);
  } finally {
    rmSync(temporary, { force: true });
  }
}

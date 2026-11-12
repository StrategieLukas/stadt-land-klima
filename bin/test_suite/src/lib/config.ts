import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import dotenv from "dotenv";
import { assert } from "./assert.js";

export interface TestConfig {
  backendUrl: string;
  frontendUrl: string;
  envPath: string;
  env: Record<string, string>;
  runId: string;
  headless: boolean;
}

function normalizeUrl(value: string): string {
  const withProtocol = /^https?:\/\//.test(value) ? value : `http://${value}`;
  return withProtocol.replace(/\/+$/, "");
}

export function parseEnvFile(path: string): Record<string, string> {
  return dotenv.parse(readFileSync(path, "utf8"));
}

export function frontendEnvironment(config: TestConfig): Record<string, string> {
  const selected = process.env.TEST_FRONTEND_ENV_FILE || process.env.SLK_PODMAN_FRONTEND_ENV_FILE;
  const path = selected || resolve(dirname(config.envPath), "../frontend/.env");
  return selected || existsSync(path) ? parseEnvFile(path) : {};
}

export function loadConfig(argv: string[]): TestConfig {
  const [backendUrlArg, frontendUrlArg, envPathArg] = argv;
  assert(
    backendUrlArg,
    "Usage: slk test dev (or npm exec tsx src/run.ts <backend-url> <frontend-url> <private-env-file>)",
  );
  assert(
    frontendUrlArg,
    "Usage: slk test dev (or npm exec tsx src/run.ts <backend-url> <frontend-url> <private-env-file>)",
  );
  assert(
    envPathArg,
    "Usage: slk test dev (or npm exec tsx src/run.ts <backend-url> <frontend-url> <private-env-file>)",
  );

  const envPath = resolve(envPathArg);
  assert(existsSync(envPath), `Backend env file does not exist: ${envPath}`);

  const env = parseEnvFile(envPath);
  const runId = `slk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  return {
    backendUrl: normalizeUrl(backendUrlArg),
    frontendUrl: normalizeUrl(frontendUrlArg),
    envPath,
    env,
    runId,
    headless: process.env.TEST_HEADLESS !== "false",
  };
}

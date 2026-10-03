import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assert } from './assert.js';

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
  return withProtocol.replace(/\/+$/, '');
}

export function parseEnvFile(path: string): Record<string, string> {
  const env: Record<string, string> = {};
  const content = readFileSync(path, 'utf8');

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    let value = match[2] ?? '';
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[match[1]] = value;
  }

  return env;
}

export function loadConfig(argv: string[]): TestConfig {
  const [backendUrlArg, frontendUrlArg, envPathArg] = argv;
  assert(backendUrlArg, 'Usage: run_tests.sh [backend url] [frontend url] [absolute path to backend env file]');
  assert(frontendUrlArg, 'Usage: run_tests.sh [backend url] [frontend url] [absolute path to backend env file]');
  assert(envPathArg, 'Usage: run_tests.sh [backend url] [frontend url] [absolute path to backend env file]');

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
    headless: process.env.TEST_HEADLESS !== 'false',
  };
}

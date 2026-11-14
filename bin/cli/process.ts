import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

export const root = fileURLToPath(new URL("../../", import.meta.url));
export type Environment = "development" | "production";
export type RunOptions = {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  input?: string | number;
  output?: number;
  capture?: boolean;
  quiet?: boolean;
};
export class CommandError extends Error {
  readonly code: number;
  constructor(code: number, executable: string) {
    super(`${executable} failed (exit ${code}).`);
    this.code = code;
  }
}
export function run(executable: string, args: string[] = [], options: RunOptions = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd: options.cwd ?? root,
      env: options.env ?? process.env,
      stdio: [
        typeof options.input === "number" ? options.input : typeof options.input === "string" ? "pipe" : "inherit",
        options.output ?? (options.capture ? "pipe" : options.quiet ? "ignore" : "inherit"),
        options.capture || options.quiet ? "pipe" : "inherit",
      ],
    });
    let output = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      output += chunk.toString();
      if (output.length > 16 * 1024 * 1024) child.kill();
    });
    // Capture errors without reflecting upstream credentials or source content.
    child.stderr?.resume();
    child.on("error", () => reject(new Error(`${executable} could not be started.`)));
    child.on("close", (code) =>
      code === 0 ? resolve(output.trim()) : reject(new CommandError(code ?? 1, executable)),
    );
    if (typeof options.input === "string") child.stdin?.end(options.input);
  });
}
export const capture = (executable: string, args: string[], options: RunOptions = {}) =>
  run(executable, args, { ...options, capture: true });
export async function succeeds(executable: string, args: string[], options: RunOptions = {}) {
  try {
    await run(executable, args, { ...options, quiet: true });
    return true;
  } catch {
    return false;
  }
}
export const node = (path: string, args: string[] = [], options: RunOptions = {}) =>
  run(process.execPath, [path, ...args], options);
export const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

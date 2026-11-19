import { execFileSync } from "node:child_process";
import { root } from "./process.ts";

// Pre-rendered FIGlet Small: Stadt.Land.Klima! No font or executable is needed at runtime.
export const HELP_BANNER = [
  " ___ _           _ _     _                 _   _  ___ _            _",
  "/ __| |_ __ _ __| | |_  | |   __ _ _ _  __| | | |/ / (_)_ __  __ _| |",
  "\\__ \\  _/ _` / _` |  _|_| |__/ _` | ' \\/ _` |_| ' <| | | '  \\/ _` |_|",
  "|___/\\__\\__,_\\__,_|\\__(_)____\\__,_|_||_\\__,_(_)_|\\_\\_|_|_|_|_\\__,_(_)",
].join("\n");

export function printHelp(text: string, stream: NodeJS.WriteStream): void {
  const forceColor = process.env.FORCE_COLOR;
  const color =
    process.env.NO_COLOR === undefined &&
    (forceColor !== undefined ? forceColor !== "0" : stream.isTTY && process.env.TERM !== "dumb");
  const banner = color ? `\u001b[38;2;152;255;190m${HELP_BANNER}\u001b[0m` : HELP_BANNER;
  stream.write(`${banner}\n\n${text}\n`);
}

export function cliVersion(directory = root): string {
  try {
    const revision = execFileSync("git", ["describe", "--tags", "--always", "--dirty"], {
      cwd: directory,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 2000,
    }).trim();
    if (revision) return `slk ${revision}`;
  } catch {
    // Source archives and hosts without Git still support help and operations.
  }
  return "slk source archive (Git revision unavailable)";
}

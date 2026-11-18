#!/usr/bin/env node
/** Development-only sendmail adapter: write one escaped email event to container logs. */
import { appendFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export async function logDevelopmentEmail(
  environment: NodeJS.ProcessEnv,
  input: AsyncIterable<Uint8Array> | Iterable<Uint8Array>,
  writeLog: (event: string) => Promise<void>,
): Promise<void> {
  if (environment.SLK_ENV !== "development") throw new Error("Mail logging is restricted to development");
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of input) {
    size += chunk.byteLength;
    if (size > 16 * 1024 * 1024) throw new Error("Development email exceeds the 16 MiB logging limit");
    chunks.push(Buffer.from(chunk));
  }
  const event = {
    level: 30,
    time: Date.now(),
    event: "development.email",
    msg: "Development email recorded locally",
    email: Buffer.concat(chunks).toString("utf8"),
  };
  await writeLog(JSON.stringify(event) + "\n");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    // Nodemailer consumes a sendmail child's stdout. Write directly to PID 1's
    // log stream so the email remains visible in private container logs.
    await logDevelopmentEmail(process.env, process.stdin, (event) => appendFile("/proc/1/fd/1", event));
  } catch {
    console.error("Development email logging failed");
    process.exitCode = 1;
  }
}

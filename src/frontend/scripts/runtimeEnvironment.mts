import { frontendRuntimeEnvironment } from "../shared/runtimeEnvironment.ts";

const [command, ...args] = process.argv.slice(2);
if (!command) throw new Error("A runtime command is required");
if (!process.execve) throw new Error("The supported Node runtime is required");
process.execve(
  "/usr/bin/env",
  ["env", command, ...args],
  Object.fromEntries(
    Object.entries(frontendRuntimeEnvironment(process.env)).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  ),
);

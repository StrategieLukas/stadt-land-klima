#!/usr/bin/env node
// Preserve the installed executable and container executable link. All command logic is TypeScript.
import { register } from "tsx/esm/api";
register();
await import("./index.ts");

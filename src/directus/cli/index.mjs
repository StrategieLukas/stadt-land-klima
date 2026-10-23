#!/usr/bin/env node
// Preserve the installed executable and Docker symlink. All command logic is TypeScript.
import { register } from 'tsx/esm/api';
register();
await import('./index.ts');

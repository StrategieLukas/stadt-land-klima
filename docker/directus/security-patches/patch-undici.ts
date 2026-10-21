import { readdir, readFile, realpath, rm, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { createRequire } from 'node:module';

// Directus's deployed pnpm tree has no source lockfile to override. Replace the
// installed Undici 7 package with this separately locked, compatible 7.x patch.
// Existing driver links continue to resolve through the same store location.
const replacement = await realpath(new URL('./node_modules/undici', import.meta.url));
const patched = JSON.parse(await readFile(join(replacement, 'package.json'), 'utf8')) as { version: string };
if (patched.version !== '7.30.1') throw new Error('Unexpected Undici security patch version');

const store = '/directus/node_modules/.pnpm';
let count = 0;
for (const entry of await readdir(store, { withFileTypes: true })) {
  if (!entry.isDirectory() || !/^undici@7\./.test(entry.name)) continue;
  const installed = join(store, entry.name, 'node_modules/undici');
  const original = JSON.parse(await readFile(join(installed, 'package.json'), 'utf8')) as { name: string; version: string };
  if (original.name !== 'undici' || !original.version.startsWith('7.')) {
    throw new Error('Unexpected deployed Undici package');
  }
  const version = /^7\.(\d+)\.(\d+)$/.exec(original.version);
  if (!version) throw new Error('Unexpected Undici version format');
  const minor = Number(version[1]);
  const patch = Number(version[2]);
  if (minor > 30 || (minor === 30 && patch > 1)) {
    throw new Error('Remove or update the Undici patch instead of downgrading a newer upstream package');
  }
  await rm(installed, { recursive: true });
  await symlink(replacement, installed, 'dir');
  count++;
}
if (!count) throw new Error('Directus package layout changed; review the Undici patch');

const requireApi = createRequire(createRequire('/directus/cli.js').resolve('@directus/api'));
for (const driver of ['cloudinary', 'supabase']) {
  const requireDriver = createRequire(requireApi.resolve(`@directus/storage-driver-${driver}`));
  const resolved = requireDriver('undici/package.json') as { version: string };
  if (resolved.version !== patched.version) throw new Error(`Unpatched Undici in ${driver} driver`);
}
console.log(`Patched ${count} deployed Undici package(s) to ${patched.version}`);

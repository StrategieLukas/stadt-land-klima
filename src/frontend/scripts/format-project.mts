import { execFileSync, spawnSync } from "node:child_process";
import { lstatSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getFileInfo } from "prettier";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const mode = process.argv[2];
if (mode !== "--check" && mode !== "--write") throw new Error("Choose --check or --write");
// Enumerating Git's working files avoids private/permission-restricted Docker data
// and includes new sources without bringing deleted staged diagnostics back to life.
const paths = [
  ...new Set(
    execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], {
      cwd: root,
      encoding: "utf8",
    })
      .split("\0")
      .filter(Boolean),
  ),
].filter((path) => lstatSync(resolve(root, path), { throwIfNoEntry: false })?.isFile());
const ignorePath = [resolve(root, ".gitignore"), resolve(root, ".prettierignore")];
const files: string[] = [];
for (const path of paths) {
  const info = await getFileInfo(resolve(root, path), { ignorePath });
  if (!info.ignored && info.inferredParser) files.push(path);
}
const cli = fileURLToPath(new URL("../node_modules/prettier/bin/prettier.cjs", import.meta.url));
const result = spawnSync(process.execPath, [cli, mode, "--", ...files], { cwd: root, stdio: "inherit" });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;

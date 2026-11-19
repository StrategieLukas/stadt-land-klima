/** Standalone host maintenance: never stop containers or prune volumes. */
import { existsSync, readdirSync, lstatSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { parseArgs } from "node:util";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { join } from "node:path";

type Image = { Id: string; Names?: string[] | null; RepoTags?: string[] | null; Created: number; Containers?: number };
const releaseTag = /^localhost\/slk-podman-(?:frontend|directus|maintenance):(release-[a-f0-9]{8,40})$/;

export function imageRetentionPlan(rows: Image[], releases: string[]) {
  if (!releases.length || releases.some((tag) => !/^release-[a-f0-9]{8,40}$/.test(tag)))
    throw new Error("Successful release records required before image cleanup");
  const unique = new Map<string, Image & { Names: string[] }>();
  for (const image of rows) {
    if (!/^[a-f0-9]{64}$/.test(image.Id) || !Number.isFinite(image.Created)) throw new Error("Invalid image metadata");
    const previous = unique.get(image.Id);
    unique.set(image.Id, {
      ...image,
      Containers: Math.max(previous?.Containers ?? 0, image.Containers ?? 0),
      Names: [...new Set([...(previous?.Names ?? []), ...(image.Names ?? image.RepoTags ?? [])])],
    });
  }
  const preserve = [...unique.values()].filter(
    (image) =>
      image.Containers ||
      image.Names.some((name) => {
        const revision = releaseTag.exec(name)?.[1];
        // All non-release tags, including recovery, runtime bases and data services,
        // remain protected. Container references independently protect active tags.
        return !revision || releases.includes(revision);
      }),
  );
  return { releases, preserve, imageCount: unique.size };
}

function podman(args: string[], capture = true) {
  const confined = existsSync("/etc/apparmor.d/slk-rootless");
  const result = spawnSync(
    confined ? "aa-exec" : "podman",
    [...(confined ? ["-p", "slk-rootless", "--", "podman"] : []), "--remote=false", ...args],
    { encoding: "utf8", maxBuffer: 16 * 1024 * 1024, stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit" },
  );
  if (result.status !== 0) throw new Error(`Image maintenance failed during ${args[0]}`);
  return result.stdout ?? "";
}

export function retainImages(apply = false) {
  const state = join(homedir(), ".local/state/slk-releases");
  const releases = readdirSync(state, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        /^release-[a-f0-9]{8,40}$/.test(entry.name) &&
        existsSync(join(state, entry.name, "activate.ok")),
    )
    .map((entry) => ({ tag: entry.name, stat: lstatSync(join(state, entry.name, "activate.ok")) }))
    .filter(({ stat }) => stat.isFile() && !stat.isSymbolicLink())
    .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs)
    .slice(0, 2)
    .map(({ tag }) => tag);
  const plan = imageRetentionPlan(JSON.parse(podman(["images", "--all", "--format", "json"])) as Image[], releases);
  console.log(
    JSON.stringify({
      releases: plan.releases,
      imagesBefore: plan.imageCount,
      protectedImages: plan.preserve.map((i) => i.Id),
      applied: apply,
    }),
  );
  if (!apply) return;
  const pins: string[] = [];
  try {
    for (const image of plan.preserve) {
      if (image.Containers) continue;
      const name = `slk-retention-${process.pid}-${image.Id.slice(0, 12)}`;
      podman([
        "create",
        "--pull",
        "never",
        "--name",
        name,
        "--network",
        "none",
        "--image-volume",
        "ignore",
        "--read-only",
        "--cap-drop",
        "ALL",
        "--security-opt",
        "no-new-privileges",
        "--entrypoint",
        "/bin/true",
        image.Id,
      ]);
      pins.push(name);
    }
    podman(["image", "prune", "--all", "--force"], false);
  } finally {
    const failed: string[] = [];
    for (const name of pins) {
      try {
        podman(["rm", name]);
      } catch {
        failed.push(name);
      }
    }
    if (failed.length) throw new Error("Image retention pins need operator cleanup");
  }
  podman(["system", "df"], false);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.platform !== "linux" || process.getuid?.() === 0)
      throw new Error("Run as the rootless deployment user on Linux");
    const { values } = parseArgs({
      options: {
        project: { type: "string" },
        apply: { type: "boolean", default: false },
        locked: { type: "boolean", default: false },
      },
    });
    if (!values.project || !/^[a-z0-9][a-z0-9_-]+$/.test(values.project)) throw new Error("Explicit project required");
    if (!podman(["ps", "-aq", "--filter", `label=io.podman.compose.project=${values.project}`]).trim())
      throw new Error("Unknown Compose project; image maintenance refused");
    if (!values.apply || values.locked) retainImages(values.apply);
    else {
      const runtime = `/run/user/${process.getuid!()}/slk-podman`;
      if (!existsSync(runtime)) throw new Error("Prepare the project's runtime before maintenance");
      const lock = `${runtime}/${values.project}.release.lock`;
      const result = spawnSync(
        "flock",
        [
          "--nonblock",
          "--conflict-exit-code",
          "75",
          lock,
          "flock",
          "--nonblock",
          "--conflict-exit-code",
          "75",
          `${runtime}/${values.project}.lock`,
          process.execPath,
          fileURLToPath(import.meta.url),
          "--project",
          values.project,
          "--apply",
          "--locked",
        ],
        { stdio: "inherit" },
      );
      if (result.status === 75) console.log("Image retention skipped: release or stack operation is active.");
      else if (result.status !== 0) throw new Error("Image retention failed");
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Image retention failed");
    process.exitCode = 1;
  }
}

import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";

/** CSP hashes permit only the exact paint styles in maintained static SVG assets.
 * Include the existing icon color-normalization variant used by all three icon components. */
export function staticIconStyleHashes() {
  const directory = new URL("../assets/icons/", import.meta.url);
  const hashes = new Set<`'sha256-${string}'`>();
  for (const file of readdirSync(directory).filter((file) => file.endsWith(".svg"))) {
    const raw = readFileSync(new URL(file, directory), "utf8");
    for (const match of raw.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)) {
      const style = match[1]!;
      const normalized = style
        .replace(/fill:\s*#[0-9a-fA-F]{3,6}/g, "fill: currentColor")
        .replace(/stroke:\s*#[0-9a-fA-F]{3,6}/g, "stroke: currentColor");
      for (const value of [style, normalized])
        hashes.add(`'sha256-${createHash("sha256").update(value).digest("base64")}'`);
    }
  }
  return [...hashes];
}

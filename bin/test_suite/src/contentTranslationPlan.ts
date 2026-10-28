import { readFileSync, statSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { isRecord } from "../../../src/frontend/shared/editorBlocks.js";
import {
  planContentTranslations,
  collectContentTranslationSegments,
} from "../../../src/frontend/server/utils/contentTranslation.js";
import { prepareTranslationDocument } from "../../../src/frontend/server/utils/contentTranslationFormat.js";
import { contentTranslationPolicy } from "../../../src/frontend/shared/contentTranslation.js";

export function parseContentSnapshots(value: unknown): { path: string; data: unknown }[] {
  if (!Array.isArray(value) || value.length > 1000) throw new Error("Invalid translation snapshots");
  return value.map((snapshot: unknown) => {
    if (!isRecord(snapshot) || typeof snapshot.path !== "string" || !Object.hasOwn(snapshot, "data"))
      throw new Error("Invalid translation snapshot");
    return { path: snapshot.path, data: snapshot.data };
  });
}

export function planDeepLUsage(snapshots: readonly { path: string; data: unknown }[]) {
  const units = new Set<string>();
  let unsupportedFields = 0;
  for (const snapshot of snapshots) {
    const policy = contentTranslationPolicy(snapshot.path);
    if (!policy) throw new Error("Unregistered translation snapshot route");
    for (const segment of collectContentTranslationSegments(snapshot.data, policy, "assessment-v1", "en-GB").values()) {
      try {
        for (const text of prepareTranslationDocument(segment).texts) units.add(text);
      } catch {
        unsupportedFields++;
      }
    }
  }
  const codePointsPerTarget = [...units].reduce((sum, text) => sum + Array.from(text).length, 0);
  return {
    uniqueTextUnitsPerTarget: units.size,
    codePointsPerTarget,
    codePointsBothTargets: codePointsPerTarget * 2,
    unsupportedFields,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const input = process.argv[2];
  const deepL = process.argv[3] === "--deepl";
  if (!input || (process.argv.length !== 3 && !(deepL && process.argv.length === 4))) {
    console.error("Usage: npm run plan:content-translation -- /path/to/public-dto-snapshots.json [--deepl]");
    process.exitCode = 1;
  } else {
    try {
      if (statSync(input).size > 10_000_000) throw new Error("Translation snapshot file too large");
      const snapshots = parseContentSnapshots(JSON.parse(readFileSync(input, "utf8")) as unknown);
      console.log(
        JSON.stringify(
          { ...planContentTranslations(snapshots), ...(deepL ? { deepl: planDeepLUsage(snapshots) } : {}) },
          null,
          2,
        ),
      );
    } catch {
      // Invalid input can contain private text; never echo it or parser/provider messages.
      console.error(
        "Cannot assess snapshots: provide a JSON array of registered public route/data pairs, up to 10 MB.",
      );
      process.exitCode = 1;
    }
  }
}

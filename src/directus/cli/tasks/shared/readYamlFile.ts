import fs from "node:fs";
import { parse } from "yaml";
import type { ZodType } from "zod";

export function substituteEnvVars(content: string): string {
  return content.replace(/\$\{([A-Z0-9_]+)\}/g, (match: string, name: string) => process.env[name] ?? match);
}

// YAML is an administrative input boundary, not an implicit source of trusted types.
export default function readYamlFile<T>(filepath: string, schema: ZodType<T>): T {
  const value: unknown = parse(substituteEnvVars(fs.readFileSync(filepath, "utf8")));
  const result = schema.safeParse(value);
  if (!result.success)
    throw new Error(`Invalid YAML document: ${filepath}`, {
      cause: result.error,
    });
  return result.data;
}

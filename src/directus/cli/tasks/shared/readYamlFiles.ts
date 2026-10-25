import fs from "node:fs";
import path from "node:path";
import type { ZodType } from "zod";
import readYamlFile from "./readYamlFile.ts";

export default function readYamlFiles<T>(dir: string, schema: ZodType<T>): T[] {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory())
    throw new Error(`YAML source directory does not exist: ${dir}`);
  return fs.readdirSync(dir).flatMap((filename) => {
    const fullPath = path.join(dir, filename);
    if (fs.statSync(fullPath).isDirectory()) return readYamlFiles(fullPath, schema);
    return path.extname(filename).toLowerCase() === ".yaml" ? [readYamlFile(fullPath, schema)] : [];
  });
}

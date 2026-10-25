import { z } from "zod";
/** Keep Vega/Vega-Lite's complete JSON vocabulary opaque. Their parser validates the
 * full spec; each component narrows only the fields it reads or modifies. */
export const EditableSpecSchema = z.record(z.string(), z.unknown());
export type EditableSpec = z.infer<typeof EditableSpecSchema>;
export function cloneVisualization(input: unknown): EditableSpec {
  return EditableSpecSchema.parse(JSON.parse(JSON.stringify(input)) as unknown);
}
export function asRecord(input: unknown): Record<string, unknown> | null {
  return input !== null && typeof input === "object" && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : null;
}
export function parseUnknownJson(text: string): unknown {
  return JSON.parse(text) as unknown;
}
export function displayScalar(value: unknown, fallback = ""): string {
  return typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
    ? String(value)
    : fallback;
}
/** Vega-Lite resolves a named data source from the spec's datasets, not embed options. */
export type VisualizationData = unknown[] | Record<string, unknown>;
export function attachVisualizationData(spec: EditableSpec, rows: VisualizationData): void {
  const data = asRecord(spec.data);
  if (typeof data?.name === "string") spec.datasets = { ...asRecord(spec.datasets), [data.name]: rows };
  else spec.data = { values: rows };
}

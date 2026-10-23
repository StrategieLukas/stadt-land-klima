import { z } from "zod";
import { parseCms } from "./parseCms";

/** Dynamic CMS relations remain unknown until their fields are checked. */
export function cmsRecord(value: unknown): Record<string, unknown> {
  return parseCms(z.record(z.string(), z.unknown()), value);
}
export function cmsString(value: unknown): string {
  return parseCms(z.string(), value);
}
export function cmsRows(value: unknown): Record<string, unknown>[] {
  return parseCms(z.array(z.record(z.string(), z.unknown())), value);
}

import { systemLog } from "./securityLogging";
import type { z } from "zod";
import { createError } from "h3";

/** Validate and project external CMS values. Never include failed records in errors. */
export function parseCms<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    systemLog("warn", "app.server.utils.parseCms.parseCms.degraded");
    throw createError({ statusCode: 502, statusMessage: "Invalid content response" });
  }
  return result.data;
}

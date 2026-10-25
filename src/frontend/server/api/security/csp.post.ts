import { requestLog } from "../../utils/securityLogging";
import { createError, defineEventHandler, setResponseStatus } from "h3";
import { readRequestBody } from "../../utils/readRequestBody";
import { rateLimit } from "../../utils/rateLimit";

// Keep bounded aggregate counts only. Reports can contain candidate URLs, tokens,
// script samples and arbitrary attacker text: none of those belong in logs.
const counts = new Map<string, number>();
let nextReport = Date.now() + 60_000;
const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
export default defineEventHandler(async (event) => {
  if (!(await rateLimit(event, "csp-report"))) throw createError({ statusCode: 429 });
  const body = await readRequestBody(event, 16_384);
  const reports = Array.isArray(body) ? body.slice(0, 20) : [body];
  for (const report of reports) {
    const outer = record(report);
    const payload = record(outer["csp-report"] ?? outer.body ?? outer);
    const directive = payload["effective-directive"] ?? payload.effectiveDirective;
    if (typeof directive !== "string" || !/^[a-z-]{1,60}$/.test(directive)) continue;
    if (!counts.has(directive) && counts.size >= 128) continue;
    counts.set(directive, (counts.get(directive) ?? 0) + 1);
  }
  if (Date.now() >= nextReport) {
    requestLog(event, "warn", "nuxt.security.csp_blocked", {
      count: Array.from(counts.values()).reduce((sum, count) => sum + count, 0),
    });
    counts.clear();
    nextReport = Date.now() + 60_000;
  }
  setResponseStatus(event, 204);
  return null;
});

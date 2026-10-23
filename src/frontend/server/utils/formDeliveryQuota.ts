import { createHash } from "node:crypto";
import { createError } from "h3";
import { withProtectionRedis } from "./protectionRedis";
const script = `
for i, key in ipairs(KEYS) do
  if tonumber(redis.call('GET', key) or '0') >= tonumber(ARGV[i]) then return 0 end
end
for _, key in ipairs(KEYS) do
  if redis.call('INCR', key) == 1 then redis.call('EXPIRE', key, 3600) end
end
return 1`;
export async function formDeliveryQuota(form: string, copyRecipient?: string) {
  const hash = (value: string) => createHash("sha256").update(value).digest("hex");
  const prefix = `${process.env.RATE_LIMIT_NAMESPACE || "slk"}:form-delivery:`;
  const keys = [prefix + "global", prefix + hash(form)];
  const limits = ["200", "50"];
  if (copyRecipient) {
    keys.push(prefix + "copy:" + hash(copyRecipient));
    limits.push("5");
  }
  let allowed: unknown;
  try {
    allowed = await withProtectionRedis((redis) => redis.eval(script, { keys, arguments: limits }));
  } catch {
    throw createError({ statusCode: 503, statusMessage: "Delivery protection temporarily unavailable" });
  }
  if (allowed !== 1) throw createError({ statusCode: 429, statusMessage: "Form delivery quota exceeded" });
}

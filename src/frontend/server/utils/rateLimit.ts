import { createHash, randomUUID } from "node:crypto";
import { isIP } from "node:net";
import { createError, setResponseHeader, type H3Event } from "h3";
import { getRateLimitPreset } from "./rateLimitConfig";
import { withProtectionRedis } from "./protectionRedis";

// Redis time and one atomic operation cover concurrent requests and multiple workers.
export const RATE_LIMIT_SCRIPT = `
local time = redis.call('TIME')
local now = tonumber(time[1]) * 1000 + math.floor(tonumber(time[2]) / 1000)
local window = tonumber(ARGV[1])
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now - window)
if redis.call('ZCARD', KEYS[1]) >= tonumber(ARGV[2]) then return 0 end
redis.call('ZADD', KEYS[1], now, ARGV[3])
redis.call('PEXPIRE', KEYS[1], window)
return 1
`;
const fallback = new Map<string, { count: number; expires: number }>();
let nextCleanup = 0;

export function requestPeer(event: H3Event): string {
  const remote = event.node.req.socket.remoteAddress ?? "unknown";
  // Production publishes this listener only on loopback; nginx overwrites X-Real-IP.
  const forwarded =
    process.env.TRUST_PROXY === "true" && process.env.SLK_ENV === "production"
      ? event.node.req.headers["x-real-ip"]
      : undefined;
  const peer = typeof forwarded === "string" && isIP(forwarded) ? forwarded : remote;
  return peer.replace(/^::ffff:/, "");
}

export async function rateLimit(
  event: H3Event,
  key: string,
  options?: { max?: number; windowSeconds?: number },
): Promise<boolean> {
  const preset = getRateLimitPreset(key);
  const max = options?.max ?? preset.max;
  const windowSeconds = options?.windowSeconds ?? preset.windowSeconds;
  if (!Number.isSafeInteger(max) || max <= 0 || !Number.isSafeInteger(windowSeconds) || windowSeconds <= 0) {
    throw createError({ statusCode: 503, statusMessage: "Invalid request protection configuration" });
  }
  const peer = createHash("sha256").update(requestPeer(event)).digest("hex");
  const redisKey = `${process.env.RATE_LIMIT_NAMESPACE || "slk"}:rate:${key}:${peer}`;
  try {
    const result = await withProtectionRedis((redis) =>
      redis.eval(RATE_LIMIT_SCRIPT, {
        keys: [redisKey],
        arguments: [String(windowSeconds * 1000), String(max), randomUUID()],
      }),
    );
    if (result !== 0 && result !== 1) throw new Error("Invalid request protection response");
    if (result === 0) setResponseHeader(event, "Retry-After", windowSeconds);
    return result === 1;
  } catch {
    if (event.method !== "GET" || key.endsWith("-pdf")) {
      throw createError({ statusCode: 503, statusMessage: "Request protection temporarily unavailable" });
    }
    // Reads retain a bounded local budget, rather than becoming unthrottled.
    const now = Date.now();
    if (now >= nextCleanup) {
      for (const [entry, value] of fallback) if (value.expires <= now) fallback.delete(entry);
      nextCleanup = now + 30_000;
    }
    let value = fallback.get(redisKey);
    if (!value || value.expires <= now) {
      if (fallback.size >= 20_000)
        throw createError({ statusCode: 503, statusMessage: "Request protection temporarily unavailable" });
      value = { count: 0, expires: now + windowSeconds * 1000 };
      fallback.set(redisKey, value);
    }
    value.count++;
    if (value.count > max) setResponseHeader(event, "Retry-After", windowSeconds);
    return value.count <= max;
  }
}

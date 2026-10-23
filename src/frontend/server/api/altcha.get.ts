import { abuseProtection } from "../utils/abuseProtection";
import { createHash, createHmac, randomBytes, randomInt } from "node:crypto";
import { queryChoice } from "../utils/publicQuery";
import { rateLimit } from "../utils/rateLimit";

// Challenges expire after 20 minutes
const CHALLENGE_TTL_MS = 20 * 60 * 1000;

export default defineEventHandler(async (event) => {
  // Rate limit: see server/utils/rateLimitConfig.ts
  if (!(await rateLimit(event, "altcha"))) {
    throw createError({ statusCode: 429, statusMessage: "Too many requests" });
  }
  const { hmacKey } = abuseProtection();

  const query = getQuery(event);
  const purpose = queryChoice(query.purpose, ["contact", "register", "form", "article"]);

  const expiresAt = Date.now() + CHALLENGE_TTL_MS;
  // ALTCHA's salt is hashed into the challenge and therefore covered by its HMAC.
  // Custom response properties alone are not signed or necessarily returned by the widget.
  const metadata = new URLSearchParams({ expires: String(expiresAt), purpose: purpose ?? "generic" });
  const salt = `${randomBytes(12).toString("hex")}?${metadata}`;
  const maxNumber = 100_000;
  // The client must brute-force which number produces this SHA-256 hash
  const targetNumber = randomInt(maxNumber);

  const challenge = createHash("SHA-256").update(`${salt}${targetNumber}`).digest("hex");

  const signature = createHmac("SHA-256", hmacKey).update(challenge).digest("hex");

  const result: Record<string, unknown> = {
    algorithm: "SHA-256",
    challenge,
    maxnumber: maxNumber,
    salt,
    signature,
    expires_at: expiresAt,
  };
  if (purpose) {
    result.purpose = purpose;
  }

  return result;
});

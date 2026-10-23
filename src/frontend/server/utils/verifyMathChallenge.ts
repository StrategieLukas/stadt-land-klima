import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { DEVELOPMENT_CAPTCHA_SECRET } from "./abuseProtection";

const Payload = z.strictObject({
  num1: z.number().int().min(10).max(19),
  num2: z.number().int().min(1).max(10),
  purpose: z.enum(["contact", "register", "form", "article"]),
});

/** A signed UX hurdle; bot resistance and single-use enforcement come from ALTCHA and quotas. */
export function verifyMathChallenge(
  token: string,
  answer: string,
  hmacKey: string,
  purpose: string,
  devMode: boolean,
): boolean {
  if (!hmacKey || (!devMode && (hmacKey === DEVELOPMENT_CAPTCHA_SECRET || hmacKey.length < 32))) return false;
  if (typeof token !== "string" || token.length > 4096 || typeof answer !== "string" || !/^\d{1,3}$/.test(answer))
    return false;
  try {
    const decoded = Buffer.from(token, "base64").toString("utf8");
    const signatureAt = decoded.lastIndexOf(":");
    const timestampAt = decoded.lastIndexOf(":", signatureAt - 1);
    const body = decoded.slice(0, timestampAt);
    const timestamp = decoded.slice(timestampAt + 1, signatureAt);
    const signature = decoded.slice(signatureAt + 1);
    if (timestampAt < 1 || !/^\d{13}$/.test(timestamp) || !/^[a-f0-9]{64}$/.test(signature)) return false;
    const now = Date.now(),
      issuedAt = Number(timestamp);
    if (issuedAt > now + 30_000 || issuedAt < now - 20 * 60 * 1000) return false;
    const expected = createHmac("sha256", hmacKey).update(`${body}:${timestamp}`).digest();
    if (!timingSafeEqual(expected, Buffer.from(signature, "hex"))) return false;
    const result = Payload.safeParse(JSON.parse(body) as unknown);
    return result.success && result.data.purpose === purpose && Number(answer) === result.data.num1 + result.data.num2;
  } catch {
    return false;
  }
}

import { createError } from "h3";

export const DEVELOPMENT_CAPTCHA_SECRET = "dev-secret-change-in-production";

export function abuseProtection() {
  const config = useRuntimeConfig();
  const devMode =
    process.env.NODE_ENV !== "production" &&
    process.env.SLK_ENV !== "production" &&
    (process.env.SLK_ENV === "development" || config.public.appEnv === "development");
  const hmacKey = config.altchaSecret || (devMode ? DEVELOPMENT_CAPTCHA_SECRET : "");
  if (!hmacKey || (!devMode && (hmacKey === DEVELOPMENT_CAPTCHA_SECRET || hmacKey.length < 32))) {
    throw createError({ statusCode: 503, statusMessage: "Request protection is not configured" });
  }
  return { hmacKey, devMode };
}

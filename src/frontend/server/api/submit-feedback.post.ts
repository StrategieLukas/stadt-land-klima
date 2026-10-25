import { requestLog, requestFailure } from "../utils/securityLogging";
import { abuseProtection } from "../utils/abuseProtection";
import { FeedbackRequestSchema } from "~/shared/contracts/submissions";
import { createDirectus, rest, staticToken, createItem } from "@directus/sdk";
import { verifyAltcha } from "../utils/verifyAltcha";
import { verifyMathChallenge } from "../utils/verifyMathChallenge";
import { rateLimit } from "../utils/rateLimit";

const ALLOWED_TYPES = ["legal", "bug", "inaccuracy", "suggestion", "cooperation", "other"];
const MAX_TITLE_LENGTH = 200;
const MAX_CONTENT_LENGTH = 5000;
const MAX_NAME_LENGTH = 200;
const MAX_CONTACT_LENGTH = 255;

export default defineEventHandler(async (event) => {
  // Rate limit: see server/utils/rateLimitConfig.ts
  if (!(await rateLimit(event, "feedback"))) {
    throw createError({ statusCode: 429, message: "Zu viele Anfragen. Bitte versuche es später erneut." });
  }
  const config = useRuntimeConfig();
  const { hmacKey, devMode } = abuseProtection();

  const parsedBody = FeedbackRequestSchema.safeParse(await readRequestBody(event));
  if (!parsedBody.success)
    throw createError({ statusCode: 400, message: "Ungültige Eingaben. Bitte prüfe das Formular." });
  const body = parsedBody.data;
  const { title, type, content, name, contact, sendCopy, altcha, mathChallenge } = body ?? {};

  // Validate required fields
  if (!title?.trim() || !type?.trim() || !content?.trim() || !name?.trim() || !contact?.trim()) {
    throw createError({ statusCode: 400, message: "Bitte alle Pflichtfelder ausfüllen." });
  }

  // Allowlist type to prevent arbitrary values reaching the DB
  if (!ALLOWED_TYPES.includes(type)) {
    throw createError({ statusCode: 400, message: "Ungültiger Feedback-Typ." });
  }

  // Basic email check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.trim())) {
    throw createError({ statusCode: 400, message: "Ungültige E-Mail-Adresse." });
  }

  // Enforce field length limits
  if (title.trim().length > MAX_TITLE_LENGTH) {
    throw createError({ statusCode: 400, message: "Titel ist zu lang." });
  }
  if (content.trim().length > MAX_CONTENT_LENGTH) {
    throw createError({ statusCode: 400, message: "Nachricht ist zu lang." });
  }
  if (name.trim().length > MAX_NAME_LENGTH) {
    throw createError({ statusCode: 400, message: "Name ist zu lang." });
  }
  if (contact.trim().length > MAX_CONTACT_LENGTH) {
    throw createError({ statusCode: 400, message: "E-Mail-Adresse ist zu lang." });
  }

  // Verify CAPTCHA
  if (!mathChallenge || !verifyMathChallenge(mathChallenge.token, mathChallenge.answer, hmacKey, "contact", devMode)) {
    throw createError({
      statusCode: 400,
      message: "Rechenprüfung fehlgeschlagen. Bitte Seite neu laden und es erneut versuchen.",
    });
  }

  if (!altcha || !(await verifyAltcha(altcha, hmacKey, { devMode, purpose: "contact" }))) {
    throw createError({
      statusCode: 400,
      message: "CAPTCHA-Überprüfung fehlgeschlagen. Bitte Seite neu laden und es erneut versuchen.",
    });
  }

  if (!(await rateLimit(event, "feedback-delivery"))) {
    throw createError({ statusCode: 429, message: "Zu viele Anfragen. Bitte versuche es später erneut." });
  }
  // Submit to Directus using server-side admin token
  const directusUrl = config.directusServerUrl || "http://directus:8055";
  const adminToken = config.directusAdminToken as string | undefined;

  if (!adminToken) {
    requestLog(event, "error", "app.server.api.submit-feedback.post.failed");
    throw createError({
      statusCode: 503,
      message: "Feedback kann momentan nicht gespeichert werden. Bitte versuche es später erneut.",
    });
  }

  const client = createDirectus(directusUrl).with(rest()).with(staticToken(adminToken));

  try {
    await client.request(
      createItem("feedback", {
        title: title.trim(),
        type: type.trim(),
        content: content.trim(),
        sender_name: name.trim(),
        sender_contact: contact.trim(),
        send_copy: sendCopy,
      }),
    );
  } catch (err) {
    requestFailure(event, "app.server.api.submit-feedback.post.failed", err);
    throw createError({
      statusCode: 502,
      message: "Feedback konnte nicht gespeichert werden. Bitte versuche es später erneut.",
    });
  }

  requestLog(event, "info", "nuxt.feedback.created", { resource: "feedback", outcome: "success" });
  return { success: true };
});

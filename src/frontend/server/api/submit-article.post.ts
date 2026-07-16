import { randomBytes } from "node:crypto";
import type { H3Event } from "h3";
import { createSlug } from "~/shared/slugify.js";
import { verifyAltcha } from "../utils/verifyAltcha";

const ARTICLE_IMAGE_FOLDER_ID = "82d3f1c5-9a8d-4aeb-8335-ca9330a43b90";
const MAX_MULTIPART_BYTES = 7 * 1024 * 1024;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_STATES = new Set([
  "Baden-Württemberg",
  "Bayern",
  "Berlin",
  "Brandenburg",
  "Bremen",
  "Hamburg",
  "Hessen",
  "Mecklenburg-Vorpommern",
  "Niedersachsen",
  "Nordrhein-Westfalen",
  "Rheinland-Pfalz",
  "Saarland",
  "Sachsen",
  "Sachsen-Anhalt",
  "Schleswig-Holstein",
  "Thüringen",
]);
const ALLOWED_SECTORS = new Set([
  "Abfallwirtschaft",
  "Finanzierung",
  "Gebäude",
  "Governance",
  "Industrie",
  "Kraftstoffe",
  "LULUCF",
  "Landwirtschaft",
  "Sonstiges",
  "Strom",
  "Verkehr",
  "Wärme",
]);

type MultipartPart = {
  name?: string;
  filename?: string;
  type?: string;
  data: Buffer;
};

type EventWithWebBody = H3Event & {
  req?: {
    arrayBuffer?: () => Promise<ArrayBuffer>;
  };
  request?: {
    arrayBuffer?: () => Promise<ArrayBuffer>;
  };
};

type ArticlePayload = {
  status: "draft";
  slug: string;
  title: string;
  author: string;
  submitter_email: string;
  municipality_name: string;
  sectors: string[];
  abstract: string;
  article_text: string;
  image: string;
  image_credits: string;
  subtitle?: string;
  state?: string;
  link?: string;
  instagram?: string;
  linkedin?: string;
};

type NotificationValue = string | string[] | null | undefined;

function submissionError(statusCode: number, message: string) {
  return createError({ statusCode, message });
}

function getTextField(parts: MultipartPart[], name: string, maxLength: number, required = false) {
  const part = parts.find((item) => item.name === name && !item.filename);
  const value = part?.data.toString("utf8").replace(/\0/g, "").trim() ?? "";
  if (required && !value) {
    throw submissionError(400, "Bitte alle Pflichtfelder ausfüllen.");
  }
  if (value.length > maxLength) {
    throw submissionError(400, "Ein Feld ist zu lang.");
  }
  return value;
}

function getImagePart(parts: MultipartPart[]) {
  return parts.find((item) => item.name === "image" && item.filename && item.data.length > 0);
}

function parseSectors(rawValue: string) {
  let values: unknown;
  try {
    values = JSON.parse(rawValue);
  } catch {
    throw submissionError(400, "Ungültige Sektoren.");
  }
  if (!Array.isArray(values) || values.length === 0) {
    throw submissionError(400, "Bitte mindestens einen Sektor auswählen.");
  }
  const sectors = values.map((value) => String(value));
  if (sectors.length > 5 || sectors.some((value) => !ALLOWED_SECTORS.has(value))) {
    throw submissionError(400, "Ungültige Sektoren.");
  }
  return sectors;
}

function normalizeOptionalUrl(value: string, fieldLabel: string, hostnamePattern?: RegExp) {
  if (!value) return null;
  const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw submissionError(400, `${fieldLabel} ist keine gültige URL.`);
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw submissionError(400, `${fieldLabel} ist keine gültige URL.`);
  }
  if (hostnamePattern && !hostnamePattern.test(url.hostname)) {
    throw submissionError(400, `${fieldLabel} ist keine gültige URL.`);
  }
  const normalized = url.toString();
  if (normalized.length > 255) {
    throw submissionError(400, `${fieldLabel} ist zu lang.`);
  }
  return normalized;
}

function sanitizeFilename(filename: string) {
  const cleaned = filename.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
  return cleaned.slice(0, 120) || "erfolgsprojekt-bild";
}

function hasValidImageSignature(part: MultipartPart) {
  const bytes = part.data;
  if (part.type === "image/jpeg") {
    return (
      bytes.length > 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[bytes.length - 2] === 0xff &&
      bytes[bytes.length - 1] === 0xd9
    );
  }
  if (part.type === "image/png") {
    return bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  }
  if (part.type === "image/webp") {
    return (
      bytes.length > 12 &&
      bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
      bytes.subarray(8, 12).toString("ascii") === "WEBP"
    );
  }
  return false;
}

function validateImage(part: MultipartPart) {
  if (!part.type || !ALLOWED_IMAGE_TYPES.has(part.type)) {
    throw submissionError(400, "Bitte ein Bild im Format JPG, PNG oder WebP hochladen.");
  }
  if (part.data.length > MAX_IMAGE_BYTES) {
    throw submissionError(413, "Das Bild ist zu groß.");
  }
  if (!hasValidImageSignature(part)) {
    throw submissionError(400, "Die Bilddatei konnte nicht validiert werden.");
  }
}

function buildDraftSlug(title: string) {
  const base = createSlug(title).slice(0, 80) || "erfolgsprojekt";
  return `${base}-${randomBytes(4).toString("hex")}`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeNotificationValue(value: NotificationValue) {
  if (Array.isArray(value)) {
    return value.length ? value.join(", ") : "—";
  }

  return value?.trim() || "—";
}

function formatNotificationRows(fields: Array<{ label: string; value: NotificationValue }>) {
  return fields
    .map(({ label, value }) => {
      const formattedValue = escapeHtml(normalizeNotificationValue(value)).replace(/\r?\n/g, "<br>");
      return `<tr><th align="left">${escapeHtml(label)}</th><td>${formattedValue}</td></tr>`;
    })
    .join("\n");
}

function buildDirectusItemUrl(directusPublicUrl: string, collection: string, id: string) {
  const baseUrl = directusPublicUrl.replace(/\/+$/, "");
  return `${baseUrl}/admin/content/${encodeURIComponent(collection)}/${encodeURIComponent(id)}`;
}

function getContentLength(event: H3Event) {
  const value = event.node.req.headers["content-length"];
  return Number(Array.isArray(value) ? value[0] : (value ?? 0));
}

async function readRequestBuffer(event: H3Event) {
  const maybeWebEvent = event as EventWithWebBody;
  if (typeof maybeWebEvent.req?.arrayBuffer === "function") {
    return Buffer.from(await maybeWebEvent.req.arrayBuffer());
  }
  if (typeof maybeWebEvent.request?.arrayBuffer === "function") {
    return Buffer.from(await maybeWebEvent.request.arrayBuffer());
  }

  return await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    event.node.req.on("data", (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    event.node.req.on("end", () => resolve(Buffer.concat(chunks)));
    event.node.req.on("error", reject);
  });
}

function splitBuffer(buffer: Buffer, delimiter: Buffer) {
  const parts: Buffer[] = [];
  let cursor = 0;
  let index = buffer.indexOf(delimiter, cursor);
  while (index !== -1) {
    parts.push(buffer.subarray(cursor, index));
    cursor = index + delimiter.length;
    index = buffer.indexOf(delimiter, cursor);
  }
  parts.push(buffer.subarray(cursor));
  return parts;
}

function parseContentDisposition(value: string) {
  const name = /(?:^|;\s*)name="([^"]*)"/i.exec(value)?.[1];
  const filename = /(?:^|;\s*)filename="([^"]*)"/i.exec(value)?.[1];
  return { name, filename };
}

async function readMultipartParts(event: H3Event) {
  const contentTypeHeader = event.node.req.headers["content-type"];
  const contentType = Array.isArray(contentTypeHeader) ? contentTypeHeader[0] : (contentTypeHeader ?? "");
  const boundary =
    /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType)?.[1] ??
    /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType)?.[2];
  if (!boundary) {
    throw submissionError(400, "Ungültige Einreichung.");
  }

  const body = await readRequestBuffer(event);
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  const rawParts = splitBuffer(body, boundaryBuffer).slice(1);
  const parts: MultipartPart[] = [];

  for (const rawPart of rawParts) {
    if (rawPart.subarray(0, 2).toString("ascii") === "--") break;

    let part = rawPart;
    if (part.subarray(0, 2).toString("ascii") === "\r\n") {
      part = part.subarray(2);
    }
    if (part.subarray(part.length - 2).toString("ascii") === "\r\n") {
      part = part.subarray(0, part.length - 2);
    }

    const headerEnd = part.indexOf(Buffer.from("\r\n\r\n"));
    if (headerEnd === -1) continue;

    const headersText = part.subarray(0, headerEnd).toString("utf8");
    const data = part.subarray(headerEnd + 4);
    const headers = new Map(
      headersText
        .split("\r\n")
        .map((line) => {
          const separator = line.indexOf(":");
          if (separator === -1) return null;
          return [line.slice(0, separator).trim().toLowerCase(), line.slice(separator + 1).trim()] as const;
        })
        .filter((line): line is readonly [string, string] => Boolean(line)),
    );
    const disposition = headers.get("content-disposition");
    if (!disposition) continue;

    const { name, filename } = parseContentDisposition(disposition);
    if (!name) continue;

    parts.push({
      name,
      ...(filename ? { filename } : {}),
      ...(headers.get("content-type") ? { type: headers.get("content-type") } : {}),
      data,
    });
  }

  return parts;
}

export default defineEventHandler(async (event) => {
  const contentLength = getContentLength(event);
  if (contentLength > MAX_MULTIPART_BYTES) {
    throw submissionError(413, "Die Einreichung ist zu groß.");
  }

  const parts = await readMultipartParts(event);
  if (!parts?.length) {
    throw submissionError(400, "Ungültige Einreichung.");
  }

  const config = useRuntimeConfig();
  const hmacKey = (config.altchaSecret as string) || "dev-secret-change-in-production";
  const altcha = getTextField(parts, "altcha", 4096, true);

  if (!verifyAltcha(altcha, hmacKey)) {
    throw submissionError(400, "CAPTCHA-Überprüfung fehlgeschlagen. Bitte Seite neu laden und es erneut versuchen.");
  }

  const title = getTextField(parts, "title", 180, true);
  const subtitle = getTextField(parts, "subtitle", 255);
  const author = getTextField(parts, "author", 120, true);
  const submitterEmail = getTextField(parts, "submitterEmail", 255, true).toLowerCase();
  const municipalityName = getTextField(parts, "municipalityName", 120, true);
  const state = getTextField(parts, "state", 80);
  const abstract = getTextField(parts, "abstract", 1500, true);
  const articleText = getTextField(parts, "articleText", 10000, true);
  const imageCredits = getTextField(parts, "imageCredits", 255, true);
  const imageRightsConfirmed = getTextField(parts, "imageRightsConfirmed", 10) === "true";
  const sectors = parseSectors(getTextField(parts, "sectors", 1000, true));
  const link = normalizeOptionalUrl(getTextField(parts, "link", 255), "Projektlink");
  const instagram = normalizeOptionalUrl(
    getTextField(parts, "instagram", 255),
    "Instagram-Link",
    /(^|\.)instagram\.com$/i,
  );
  const linkedin = normalizeOptionalUrl(getTextField(parts, "linkedin", 255), "LinkedIn-Link", /(^|\.)linkedin\.com$/i);
  const image = getImagePart(parts);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(submitterEmail)) {
    throw submissionError(400, "Ungültige E-Mail-Adresse.");
  }
  if (state && !ALLOWED_STATES.has(state)) {
    throw submissionError(400, "Ungültiges Bundesland.");
  }
  if (!image) {
    throw submissionError(400, "Bitte ein Bild hochladen.");
  }
  if (!imageRightsConfirmed) {
    throw submissionError(400, "Bitte bestätige die Bildrechte und den Bildnachweis.");
  }
  validateImage(image);

  const directusUrl = (config.directusServerUrl as string) || "http://directus:8055";
  const adminToken = config.directusAdminToken as string | undefined;
  if (!adminToken) {
    console.error("[submit-article] DIRECTUS_ADMIN_TOKEN not configured");
    throw submissionError(503, "Einreichung kann momentan nicht gespeichert werden. Bitte versuche es später erneut.");
  }

  const headers = { Authorization: `Bearer ${adminToken}` };
  let imageId: string | null = null;

  try {
    const imageForm = new FormData();
    imageForm.append("folder", ARTICLE_IMAGE_FOLDER_ID);
    imageForm.append("title", title);
    imageForm.append("image_credits", imageCredits);
    imageForm.append(
      "file",
      new Blob([image.data], { type: image.type }),
      sanitizeFilename(image.filename ?? "erfolgsprojekt-bild"),
    );

    const uploadedImage = await $fetch<{ data: { id: string } }>(`${directusUrl}/files`, {
      method: "POST",
      headers,
      body: imageForm,
    });
    imageId = uploadedImage.data.id;

    const articlePayload: ArticlePayload = {
      status: "draft",
      slug: buildDraftSlug(title),
      title,
      author,
      submitter_email: submitterEmail,
      municipality_name: municipalityName,
      sectors,
      abstract,
      article_text: articleText,
      image: imageId,
      image_credits: imageCredits,
      ...(subtitle ? { subtitle } : {}),
      ...(state ? { state } : {}),
      ...(link ? { link } : {}),
      ...(instagram ? { instagram } : {}),
      ...(linkedin ? { linkedin } : {}),
    };

    const article = await $fetch<{ data: { id: string; status: string } }>(`${directusUrl}/items/articles`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: articlePayload,
    });

    const directusPublicUrl = (config.directusPublicUrl as string) || "https://stadt-land-klima.de/backend";
    const directusItemUrl = buildDirectusItemUrl(directusPublicUrl, "articles", article.data.id);
    const notifyAdminFlowUrl = config.directusFlowNotifyAdmin as string | undefined;
    const notificationEmail = (config.erfolgsprojekteNotificationEmail as string) || "presse@stadt-land-klima.de";
    if (!notifyAdminFlowUrl) {
      console.warn(
        "[submit-article] DIRECTUS_FLOW_NOTIFY_ADMIN not configured - skipping Erfolgsprojekte notification",
      );
    } else {
      await $fetch(notifyAdminFlowUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: {
          to: notificationEmail,
          subject: `Neues Erfolgsprojekt eingereicht: ${title}`,
          body: [
            "<p>Über das öffentliche Formular wurde ein neues Erfolgsprojekt eingereicht.</p>",
            `<p><a href="${escapeHtml(directusItemUrl)}">Entwurf in Directus öffnen</a></p>`,
            "<table>",
            formatNotificationRows([
              { label: "id", value: article.data.id },
              { label: "status", value: article.data.status },
              { label: "slug", value: articlePayload.slug },
              { label: "title", value: articlePayload.title },
              { label: "subtitle", value: subtitle },
              { label: "author", value: articlePayload.author },
              { label: "submitter_email", value: articlePayload.submitter_email },
              { label: "municipality_name", value: articlePayload.municipality_name },
              { label: "state", value: state },
              { label: "sectors", value: articlePayload.sectors },
              { label: "abstract", value: articlePayload.abstract },
              { label: "article_text", value: articlePayload.article_text },
              { label: "image", value: articlePayload.image },
              { label: "image_credits", value: articlePayload.image_credits },
              { label: "image_rights_confirmed", value: "ja" },
              { label: "link", value: link },
              { label: "instagram", value: instagram },
              { label: "linkedin", value: linkedin },
            ]),
            "</table>",
          ].join("\n"),
        },
      }).catch((err) => {
        console.warn("[submit-article] Erfolgsprojekte notification email failed (non-fatal):", err);
      });
    }

    return { success: true, id: article.data.id, status: article.data.status };
  } catch (err) {
    if (imageId) {
      await $fetch(`${directusUrl}/files/${imageId}`, { method: "DELETE", headers }).catch((cleanupErr) => {
        console.warn("[submit-article] Failed to clean up uploaded image after article error:", cleanupErr);
      });
    }
    console.error("[submit-article] Directus error:", err);
    throw submissionError(502, "Einreichung konnte nicht gespeichert werden. Bitte versuche es später erneut.");
  }
});

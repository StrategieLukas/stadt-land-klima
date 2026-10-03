import { readRequestBody } from "../utils/readRequestBody";
import { verifyAltcha } from "../utils/verifyAltcha";

type FieldType = "text" | "email" | "textarea" | "select" | "checkbox";

type SubmittedField = {
  name?: unknown;
  label?: unknown;
  type?: unknown;
  required?: unknown;
};

type SubmittedValues = Record<string, unknown>;

type NormalizedField = {
  name: string;
  label: string;
  type: FieldType;
  required: boolean;
  value: string | boolean;
};

const FIELD_TYPES = new Set<FieldType>(["text", "email", "textarea", "select", "checkbox"]);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_FIELDS = 50;
const MAX_TEXT_LENGTH = 5000;
const MAX_JSON_LENGTH = 65000;

function submissionError(statusCode: number, message: string) {
  return createError({ statusCode, message });
}

function normalizeShortText(value: unknown, maxLength: number, fallback = "") {
  const normalized = typeof value === "string" ? value.replace(/\0/g, "").trim() : fallback;
  if (normalized.length > maxLength) {
    throw submissionError(400, "Ein Feld ist zu lang.");
  }
  return normalized;
}

function normalizeFieldName(value: unknown) {
  return normalizeShortText(value, 80)
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

function normalizeFieldType(value: unknown): FieldType {
  const candidate = String(value || "text") as FieldType;
  return FIELD_TYPES.has(candidate) ? candidate : "text";
}

function normalizeValue(value: unknown, type: FieldType) {
  if (type === "checkbox") {
    return value === true || value === "true" || value === "yes" || value === "on";
  }

  const normalized = Array.isArray(value)
    ? value
        .map((item) => String(item).trim())
        .filter(Boolean)
        .join(", ")
    : String(value ?? "")
        .replace(/\0/g, "")
        .trim();

  if (normalized.length > MAX_TEXT_LENGTH) {
    throw submissionError(400, "Ein Feld ist zu lang.");
  }

  return normalized;
}

function normalizeEmail(value: unknown) {
  const email = normalizeShortText(value, 255).toLowerCase();
  return email && EMAIL_PATTERN.test(email) ? email : "";
}

function normalizeNotificationEmail(value: unknown, fallback: string) {
  const email = normalizeEmail(value);
  return email || fallback;
}

function normalizeFields(fields: unknown, values: SubmittedValues): NormalizedField[] {
  if (!Array.isArray(fields) || fields.length === 0 || fields.length > MAX_FIELDS) {
    throw submissionError(400, "Ungültige Formularfelder.");
  }

  const seenNames = new Set<string>();

  return fields.map((field: SubmittedField, index) => {
    const type = normalizeFieldType(field?.type);
    const fallbackName = `field_${index + 1}`;
    const name = normalizeFieldName(field?.name) || fallbackName;
    if (seenNames.has(name)) {
      throw submissionError(400, "Doppelte Formularfelder.");
    }
    seenNames.add(name);

    const label = normalizeShortText(field?.label, 180, name) || name;
    const value = normalizeValue(values[name], type);

    if (field?.required === true) {
      const isEmpty = type === "checkbox" ? value !== true : !String(value).trim();
      if (isEmpty) {
        throw submissionError(400, "Bitte alle Pflichtfelder ausfüllen.");
      }
    }

    if (type === "email" && String(value).trim() && !EMAIL_PATTERN.test(String(value).trim())) {
      throw submissionError(400, "Ungültige E-Mail-Adresse.");
    }

    return {
      name,
      label,
      type,
      required: field?.required === true,
      value,
    };
  });
}

function valueToSummary(value: string | boolean) {
  if (typeof value === "boolean") {
    return value ? "Ja" : "Nein";
  }
  return value || "—";
}

function buildResponseSummary(fields: NormalizedField[]) {
  return fields.map((field) => `${field.label}: ${valueToSummary(field.value)}`).join("\n");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildDirectusItemUrl(directusPublicUrl: string, collection: string, id: string | number) {
  const baseUrl = directusPublicUrl.replace(/\/+$/, "");
  return `${baseUrl}/admin/content/${encodeURIComponent(collection)}/${encodeURIComponent(String(id))}`;
}

function findSenderEmail(fields: NormalizedField[]) {
  const emailField = fields.find((field) => field.type === "email" && typeof field.value === "string");
  return normalizeEmail(emailField?.value);
}

function findSenderName(fields: NormalizedField[]) {
  const nameField = fields.find((field) => {
    const search = `${field.name} ${field.label}`.toLowerCase();
    return field.type === "text" && (search.includes("name") || search.includes("ansprechperson"));
  });
  return normalizeShortText(nameField?.value, 255);
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const hmacKey = (config.altchaSecret as string) || "dev-secret-change-in-production";
  const body = await readRequestBody(event);

  const { formKey, formTitle, pagePath, notificationEmail, sendCopy, fields, values, altcha } = body ?? {};

  if (!altcha || !verifyAltcha(String(altcha), hmacKey)) {
    throw submissionError(400, "CAPTCHA-Überprüfung fehlgeschlagen. Bitte Seite neu laden und es erneut versuchen.");
  }

  if (!values || typeof values !== "object" || Array.isArray(values)) {
    throw submissionError(400, "Ungültige Formularwerte.");
  }

  const serializedValuesLength = JSON.stringify(values).length;
  if (serializedValuesLength > MAX_JSON_LENGTH) {
    throw submissionError(413, "Die Formularantwort ist zu groß.");
  }

  const normalizedFields = normalizeFields(fields, values as SubmittedValues);
  const responseSummary = buildResponseSummary(normalizedFields);
  const directusUrl = (config.directusServerUrl as string) || "http://directus:8055";
  const adminToken = config.directusAdminToken as string | undefined;

  if (!adminToken) {
    console.error("[submit-form-response] DIRECTUS_ADMIN_TOKEN not configured");
    throw submissionError(503, "Formularantworten können momentan nicht gespeichert werden.");
  }

  const fallbackEmail = String(
    (config.formResponseNotificationEmail as string) ||
      (config.adminNotificationEmail as string) ||
      "info@stadt-land-klima.de",
  );
  const recipientEmail = normalizeNotificationEmail(notificationEmail, fallbackEmail);
  const senderEmail = findSenderEmail(normalizedFields);
  const senderName = findSenderName(normalizedFields);
  const safeFormTitle = normalizeShortText(formTitle, 180, "Formular") || "Formular";
  const safeFormKey = normalizeShortText(formKey, 120, "form") || "form";
  const safePagePath = normalizeShortText(pagePath, 500, "");

  try {
    const result = await $fetch<{ data: { id: number | string; status: string } }>(
      `${directusUrl}/items/form_responses`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "Content-Type": "application/json",
        },
        body: {
          status: "received",
          form_title: safeFormTitle,
          form_key: safeFormKey,
          page_path: safePagePath,
          sender_name: senderName || null,
          sender_email: senderEmail || null,
          notification_email: recipientEmail,
          send_copy: sendCopy === true,
          response_summary: responseSummary,
          response_data: {
            fields: normalizedFields.map((field) => ({
              name: field.name,
              label: field.label,
              type: field.type,
              required: field.required,
              value: field.value,
            })),
            pagePath: safePagePath,
            formKey: safeFormKey,
          },
        },
      },
    );

    const directusPublicUrl = (config.directusPublicUrl as string) || directusUrl;
    const directusItemUrl = buildDirectusItemUrl(directusPublicUrl, "form_responses", result.data.id);
    return {
      success: true,
      id: result.data.id,
      status: result.data.status,
      directusUrl: escapeHtml(directusItemUrl),
    };
  } catch (err) {
    console.error("[submit-form-response] Directus error:", err);
    throw submissionError(502, "Formularantwort konnte nicht gespeichert werden. Bitte versuche es später erneut.");
  }
});

import type { H3Event } from "h3";

type DirectusEventResponse = {
  data?: CalendarEvent[];
};

type CalendarEvent = {
  description: string | null;
  end_date: string | null;
  id: string;
  location: string | null;
  slug: string;
  start_date: string | null;
  title: string;
};

const EVENT_FIELDS = ["id", "title", "slug", "description", "start_date", "end_date", "location"] as const;
const ICS_LINE_ENDING = "\r\n";

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function foldIcsLine(line: string): string {
  const chunks: string[] = [];
  let current = "";
  let currentLength = 0;

  for (const character of line) {
    const characterLength = Buffer.byteLength(character, "utf8");

    if (currentLength + characterLength > 75) {
      chunks.push(current);
      current = ` ${character}`;
      currentLength = 1 + characterLength;
      continue;
    }

    current += character;
    currentLength += characterLength;
  }

  chunks.push(current);
  return chunks.join(ICS_LINE_ENDING);
}

function formatIcsDate(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);

  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function stripHtml(value: string | null): string {
  if (!value) return "";

  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function safeFileName(value: string): string {
  return (
    value
      .normalize("NFKD")
      .replace(/[^\w-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "veranstaltung"
  );
}

function buildEventUrl(eventSlug: string, requestOrigin: string): string {
  const config = useRuntimeConfig();
  const baseUrl = String(config.appPublicUrl || requestOrigin).replace(/\/$/, "");
  return `${baseUrl}/events/${encodeURIComponent(eventSlug)}`;
}

function getRequestPath(event: H3Event): string {
  const requestUrl = event.node.req.url || "";

  if (requestUrl.startsWith("http://") || requestUrl.startsWith("https://")) {
    try {
      return new URL(requestUrl).pathname;
    } catch {
      return "";
    }
  }

  return requestUrl.split("?")[0] || "";
}

function getHeaderValue(event: H3Event, name: string): string | null {
  const value = event.node.req.headers[name.toLowerCase()];
  const normalizedValue = Array.isArray(value) ? value[0] : value;
  return normalizedValue?.split(",")[0]?.trim() || null;
}

function getRequestOriginFallback(event: H3Event): string {
  const protocol = getHeaderValue(event, "x-forwarded-proto") || "http";
  const host = getHeaderValue(event, "x-forwarded-host") || getHeaderValue(event, "host") || "localhost:8080";
  return `${protocol}://${host}`;
}

function decodeSlug(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function getCalendarSlug(event: H3Event): string {
  const routeSlug = getRouterParam(event, "slug");

  if (routeSlug) {
    return routeSlug.replace(/\.ics$/, "");
  }

  const pathSlug = getRequestPath(event).match(/\/api\/events\/([^/]+)\.ics$/)?.[1];
  return pathSlug ? decodeSlug(pathSlug) : "";
}

function buildIcs(eventItem: CalendarEvent, eventUrl: string): string {
  const now = new Date();
  const start = eventItem.start_date ? new Date(eventItem.start_date) : null;
  const end = eventItem.end_date ? new Date(eventItem.end_date) : null;

  if (!start || Number.isNaN(start.getTime())) {
    throw createError({ statusCode: 404, statusMessage: "Event not found" });
  }

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Stadt.Land.Klima//Veranstaltungen//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:event-${eventItem.id}@stadt-land-klima.de`,
    `DTSTAMP:${formatIcsDate(now)}`,
    `DTSTART:${formatIcsDate(start)}`,
  ];

  if (end && !Number.isNaN(end.getTime()) && end.getTime() > start.getTime()) {
    lines.push(`DTEND:${formatIcsDate(end)}`);
  }

  lines.push(
    `SUMMARY:${escapeIcsText(eventItem.title)}`,
    `DESCRIPTION:${escapeIcsText(stripHtml(eventItem.description))}`,
    `URL:${eventUrl}`,
  );

  if (eventItem.location) {
    lines.push(`LOCATION:${escapeIcsText(eventItem.location)}`);
  }

  lines.push("END:VEVENT", "END:VCALENDAR");

  return lines.map(foldIcsLine).join(ICS_LINE_ENDING) + ICS_LINE_ENDING;
}

export default defineEventHandler(async (event) => {
  const slug = getCalendarSlug(event);

  if (!slug) {
    throw createError({ statusCode: 404, statusMessage: "Event not found" });
  }

  const config = useRuntimeConfig();
  const directusUrl =
    (config.directusServerUrl as string) || (config.public.serverDirectusUrl as string) || "http://directus:8055";
  const directusToken = config.public.directusToken as string | undefined;
  let response: DirectusEventResponse;

  try {
    response = await $fetch<DirectusEventResponse>(`${directusUrl}/items/events`, {
      headers: directusToken ? { Authorization: `Bearer ${directusToken}` } : undefined,
      params: {
        filter: JSON.stringify({ slug: { _eq: slug }, status: { _eq: "published" } }),
        limit: 1,
        "fields[]": EVENT_FIELDS,
      },
    });
  } catch (error) {
    console.error("[events.ics] Failed to load event:", error);
    throw createError({ statusCode: 502, statusMessage: "Calendar could not be generated" });
  }

  const eventItem = response.data?.[0];

  if (!eventItem) {
    throw createError({ statusCode: 404, statusMessage: "Event not found" });
  }

  const eventUrl = buildEventUrl(eventItem.slug, getRequestOriginFallback(event));
  const fileName = `${safeFileName(eventItem.slug)}.ics`;

  event.node.res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  event.node.res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  event.node.res.setHeader("Cache-Control", "public, max-age=300");

  return buildIcs(eventItem, eventUrl);
});

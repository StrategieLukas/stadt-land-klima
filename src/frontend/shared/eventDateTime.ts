const EVENT_TIME_ZONE = "Europe/Berlin";

type TranslateFn = (key: string, params?: Record<string, string>) => string;

function parseDate(value?: string | null) {
  if (!value) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function translate(t: TranslateFn | undefined, key: string, params: Record<string, string>, fallback: string) {
  if (!t) return fallback;

  const translated = t(key, params);
  return translated === key ? fallback : translated;
}

function getBerlinDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: EVENT_TIME_ZONE,
    year: "numeric",
  }).formatToParts(date);

  const valueFor = (type: string) => parts.find((part) => part.type === type)?.value ?? "";

  return {
    day: valueFor("day"),
    month: valueFor("month"),
    year: valueFor("year"),
  };
}

function getBerlinDayKey(date: Date) {
  const { day, month, year } = getBerlinDateParts(date);
  return `${year}-${month}-${day}`;
}

function formatDate(date: Date, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "long",
    timeZone: EVENT_TIME_ZONE,
    year: "numeric",
  }).format(date);
}

function formatTime(date: Date, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    timeZone: EVENT_TIME_ZONE,
  }).format(date);
}

function formatEventDateTime(date: Date, locale: string) {
  return `${formatDate(date, locale)}, ${formatTime(date, locale)}`;
}

export function formatEventDateTimeRange(
  startIso?: string | null,
  endIso?: string | null,
  locale = "de-DE",
  t?: TranslateFn,
) {
  const start = parseDate(startIso);
  if (!start) return "";

  const end = parseDate(endIso);
  const startDateTime = formatEventDateTime(start, locale);
  const timezone = translate(t, "events.datetime.timezone.europe_berlin", {}, EVENT_TIME_ZONE);
  let dateTime = startDateTime;

  if (end && end.getTime() > start.getTime()) {
    const sameBerlinDay = getBerlinDayKey(start) === getBerlinDayKey(end);
    dateTime = sameBerlinDay
      ? `${startDateTime} - ${formatTime(end, locale)}`
      : `${startDateTime} - ${formatEventDateTime(end, locale)}`;
  }

  return translate(
    t,
    "events.datetime.with_timezone",
    { ":dateTime": dateTime, ":timezone": timezone },
    `${dateTime} (${timezone})`,
  );
}

export function getEventMonthKey(startIso?: string | null) {
  const start = parseDate(startIso);
  if (!start) return "";

  const { month, year } = getBerlinDateParts(start);
  return `${year}-${month}`;
}

export function formatEventMonth(startIso: string | null | undefined, locale = "de-DE") {
  const start = parseDate(startIso);
  if (!start) return "";

  return new Intl.DateTimeFormat(locale, {
    month: "long",
    timeZone: EVENT_TIME_ZONE,
    year: "numeric",
  }).format(start);
}

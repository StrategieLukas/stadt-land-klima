const EVENT_TIME_ZONE = "Europe/Berlin";

function parseDateOnly(value?: string | null) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "");
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return { day, month, year };
}

function getTimeZoneOffset(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    calendar: "gregory",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    numberingSystem: "latn",
    second: "2-digit",
    timeZone,
    year: "numeric",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const localTimeAsUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  );

  return localTimeAsUtc - (date.getTime() - date.getUTCMilliseconds());
}

function getBerlinMidnight(year: number, month: number, day: number) {
  const utcGuess = new Date(Date.UTC(year, month, day));
  const offset = getTimeZoneOffset(utcGuess, EVENT_TIME_ZONE);
  return new Date(utcGuess.getTime() - offset);
}

export function getBerlinEndOfDay(isoDate?: string | null) {
  const parsed = parseDateOnly(isoDate);
  if (!parsed) return null;

  const nextDay = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + 1));
  const nextDayMidnight = getBerlinMidnight(
    nextDay.getUTCFullYear(),
    nextDay.getUTCMonth(),
    nextDay.getUTCDate(),
  );

  return new Date(nextDayMidnight.getTime() - 1);
}

/** Directus dateTime values without an offset represent Berlin wall-clock time. */
export function parseBerlinDateTime(value?: string | null) {
  if (!value) return null;
  const naive = /^(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/.test(value);
  let date = new Date(naive ? `${value}Z` : value);
  if (naive && !Number.isNaN(date.getTime())) {
    const wallTime = date.getTime();
    // Recheck the offset at the resulting instant across daylight-saving changes.
    for (let attempt = 0; attempt < 2; attempt++) {
      date = new Date(wallTime - getTimeZoneOffset(date, EVENT_TIME_ZONE));
    }
  }
  return Number.isNaN(date.getTime()) ? null : date;
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

export function formatBerlinDate(iso?: string | null, locale = "de-DE") {
  const date = parseBerlinDateTime(iso);
  return date ? formatDate(date, locale) : "";
}

export function formatBerlinDateRange(
  startIso?: string | null,
  endIso?: string | null,
  locale = "de-DE",
) {
  const start = parseBerlinDateTime(startIso);
  if (!start) return "";
  const end = parseBerlinDateTime(endIso);
  if (!end || getBerlinDayKey(start) === getBerlinDayKey(end)) return formatDate(start, locale);
  const startParts = getBerlinDateParts(start);
  const endParts = getBerlinDateParts(end);
  if (startParts.year === endParts.year && startParts.month === endParts.month) {
    return `${Number(startParts.day)}. – ${formatDate(end, locale)}`;
  }
  if (startParts.year === endParts.year) {
    const startLabel = new Intl.DateTimeFormat(locale, {
      day: "2-digit", month: "long", timeZone: EVENT_TIME_ZONE,
    }).format(start);
    return `${startLabel} – ${formatDate(end, locale)}`;
  }
  return `${formatDate(start, locale)} – ${formatDate(end, locale)}`;
}

export function formatEventDateTimeRange(
  startIso?: string | null,
  endIso?: string | null,
  locale = "de-DE",
  dateOnly = false,
) {
  const start = parseBerlinDateTime(startIso);
  if (!start) return "";

  const end = parseBerlinDateTime(endIso);
  if (dateOnly) {
    return end && getBerlinDayKey(end) !== getBerlinDayKey(start)
      ? `${formatDate(start, locale)} - ${formatDate(end, locale)}`
      : formatDate(start, locale);
  }
  const startDateTime = formatEventDateTime(start, locale);
  let dateTime = startDateTime;

  if (end && end.getTime() > start.getTime()) {
    const sameBerlinDay = getBerlinDayKey(start) === getBerlinDayKey(end);
    dateTime = sameBerlinDay
      ? `${startDateTime} - ${formatTime(end, locale)}`
      : `${startDateTime} - ${formatEventDateTime(end, locale)}`;
  }

  return dateTime;
}

export function getEventPhase(
  startIso: string | null | undefined,
  endIso: string | null | undefined,
  dateOnly: boolean,
  now: Date,
): "current" | "future" | "past" | null {
  const start = parseBerlinDateTime(startIso);
  if (!start) return null;
  const end = parseBerlinDateTime(endIso);
  if (dateOnly) {
    const today = getBerlinDayKey(now);
    if (today < getBerlinDayKey(start)) return "future";
    if (today > getBerlinDayKey(end ?? start)) return "past";
    return "current";
  }
  if (start > now) return "future";
  if (end && end >= now) return "current";
  return "past";
}

export function getEventMonthKey(startIso?: string | null) {
  const start = parseBerlinDateTime(startIso);
  if (!start) return "";

  const { month, year } = getBerlinDateParts(start);
  return `${year}-${month}`;
}

export function formatEventMonth(startIso: string | null | undefined, locale = "de-DE") {
  const start = parseBerlinDateTime(startIso);
  if (!start) return "";

  return new Intl.DateTimeFormat(locale, {
    month: "long",
    timeZone: EVENT_TIME_ZONE,
    year: "numeric",
  }).format(start);
}

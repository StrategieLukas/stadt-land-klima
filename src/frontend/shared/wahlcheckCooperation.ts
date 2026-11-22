// Cooperation starts at midnight on 23 November 2026 in Europe/Berlin.
const cooperationStart = Date.parse("2026-11-23T00:00:00+01:00");

export function showsWahlcheckCooperation(dateCreated: string | null | undefined): boolean {
  // Directus timestamps include an offset. Unknown dates must not credit the
  // cooperation, and the result must not depend on the browser's time zone.
  if (!dateCreated || !/T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(dateCreated)) return false;
  const created = Date.parse(dateCreated);
  return Number.isFinite(created) && created >= cooperationStart;
}

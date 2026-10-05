export type RelationId = string | { id: string } | null | undefined;

export type TourPoint = { type: "Point"; coordinates: [number, number] };

export const TOUR_PIN_COLORS = ["#16bae7", "#19a750", "#16bae7", "#f39200", "#afca0b", "#16bae7", "#afca0b", "#ffd400", "#16bae7", "#f39200"] as const;
export const pinColor = (index: number): string => TOUR_PIN_COLORS[index % TOUR_PIN_COLORS.length];

export function relationId(value: RelationId): string | null {
  if (typeof value === "string") return value;
  return value?.id ?? null;
}

export function pointLatLng(point: TourPoint | null | undefined): [number, number] | null {
  if (point?.type !== "Point" || !Array.isArray(point.coordinates)) return null;
  const [longitude, latitude] = point.coordinates.map(Number);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return [latitude, longitude];
}

export function berlinDayNumber(value: string | Date | null | undefined): number | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Berlin",
  }).formatToParts(date);
  const part = (type: string) => Number(parts.find((item) => item.type === type)?.value);
  return Date.UTC(part("year"), part("month") - 1, part("day")) / 86_400_000;
}

export function visitDaysAway(start: string | null | undefined, now: Date): number | null {
  const eventDay = berlinDayNumber(start);
  const currentDay = berlinDayNumber(now);
  return eventDay === null || currentDay === null ? null : eventDay - currentDay;
}

export function visitHasEnded(
  start: string | null | undefined,
  end: string | null | undefined,
  now: Date,
): boolean {
  if (end) {
    const endTime = new Date(end).getTime();
    return Number.isFinite(endTime) && endTime < now.getTime();
  }
  const startDay = berlinDayNumber(start);
  const currentDay = berlinDayNumber(now);
  return startDay !== null && currentDay !== null && startDay < currentDay;
}

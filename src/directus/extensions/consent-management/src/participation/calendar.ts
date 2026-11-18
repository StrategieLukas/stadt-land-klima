import { z } from "zod";
import {
  ParticipationBookingSchema,
  ParticipationError,
  type ParticipationInput,
  type ParticipationBooking,
} from "../../../../../frontend/shared/participation.ts";

type CalendarConfig = { key: string; eventTypeId: number };
export function calendarConfig(env: Record<string, unknown>): CalendarConfig | null {
  const key = env.SLK_PARTICIPATION_CAL_API_KEY;
  const eventTypeId = Number(env.SLK_PARTICIPATION_CAL_EVENT_TYPE_ID);
  return typeof key === "string" && key.length > 10 && Number.isSafeInteger(eventTypeId) && eventTypeId > 0
    ? { key, eventTypeId }
    : null;
}

/** Fixed provider origin and bounded requests. Provider credentials and attendee details never reach URLs. */
export function participationCalendar(config: CalendarConfig | null, transport: typeof fetch = fetch) {
  async function request(path: string, version: string, init?: RequestInit) {
    if (!config) throw new ParticipationError("calendar_unavailable", 503);
    return transport(`https://api.cal.com/v2/${path}`, {
      ...init,
      redirect: "error",
      signal: AbortSignal.timeout(20000),
      headers: {
        Authorization: `Bearer ${config.key}`,
        "cal-api-version": version,
        "Content-Type": "application/json",
      },
    });
  }
  async function slots(start: string, end: string, timeZone: string): Promise<string[]> {
    const query = new URLSearchParams({ eventTypeId: String(config?.eventTypeId), start, end, timeZone });
    try {
      const response = await request(`slots?${query}`, "2024-09-04");
      if (!response.ok) throw new Error("Calendar unavailable");
      const result = z
        .object({
          status: z.literal("success"),
          data: z.record(z.string(), z.array(z.object({ start: z.iso.datetime({ offset: true }) }))),
        })
        .parse(await response.json());
      return [
        ...new Set(
          Object.values(result.data)
            .flat()
            .map((slot) => slot.start),
        ),
      ]
        .filter((slot) => Date.parse(slot) > Date.now())
        .sort((a, b) => Date.parse(a) - Date.parse(b))
        .slice(0, 2000);
    } catch {
      throw new ParticipationError("calendar_unavailable", 503);
    }
  }
  return {
    slots,
    async book(input: ParticipationInput, registrationId: string): Promise<ParticipationBooking> {
      if (input.mode !== "personal") throw new ParticipationError("invalid_request", 400);
      const response = await request("bookings", "2026-02-25", {
        method: "POST",
        body: JSON.stringify({
          eventTypeId: config?.eventTypeId,
          start: new Date(input.start).toISOString(),
          attendee: {
            name: `${input.firstName} ${input.lastName}`,
            email: input.email,
            timeZone: input.timeZone,
            language: input.language.slice(0, 2),
          },
          metadata: { slkRegistrationId: registrationId },
          leadEnrichmentOptOut: true,
        }),
      });
      // Only explicit validation/conflict rejections establish that no booking was created.
      if ([400, 409, 422].includes(response.status)) throw new ParticipationError("slot_unavailable", 409);
      if (!response.ok) throw new ParticipationError("review_required", 503);
      const raw = z
        .object({
          status: z.literal("success"),
          data: z.object({ uid: z.string(), status: z.string(), start: z.string(), end: z.string() }),
        })
        .parse(await response.json());
      const booking = ParticipationBookingSchema.safeParse(raw.data);
      if (!booking.success) throw new ParticipationError("review_required", 503);
      return booking.data;
    },
  };
}

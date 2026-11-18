import {
  ParticipationError,
  type ParticipationInput,
  type ParticipationBooking,
  type ParticipationResult,
} from "../../../../../frontend/shared/participation.ts";

export type RegistrationStatus =
  "reserved" | "booking_started" | "booked" | "email_sending" | "delivery_pending" | "complete" | "needs_review";
export type RegistrationRecord = {
  id: string;
  user_id: string;
  status: RegistrationStatus;
  booking: ParticipationBooking | null;
};
export interface ParticipationWorkflow {
  reserve(input: ParticipationInput): Promise<RegistrationRecord>;
  claim(id: string, from: RegistrationStatus[], to: RegistrationStatus): Promise<boolean>;
  update(id: string, status: RegistrationStatus, booking?: ParticipationBooking): Promise<void>;
  removeUnbooked(record: RegistrationRecord): Promise<void>;
  book(input: ParticipationInput, id: string): Promise<ParticipationBooking>;
  sendAccountConfirmation(input: ParticipationInput, record: RegistrationRecord): Promise<void>;
}

/** Persist each external operation's start before executing it; uncertain bookings are never repeated. */
export async function completeParticipation(
  input: ParticipationInput,
  workflow: ParticipationWorkflow,
): Promise<ParticipationResult> {
  const record = await workflow.reserve(input);
  if (record.status === "needs_review") throw new ParticipationError("review_required", 503);
  if (["booking_started", "email_sending"].includes(record.status)) throw new ParticipationError("processing", 409);
  if (record.status === "reserved" && input.mode === "personal") {
    if (!(await workflow.claim(record.id, ["reserved"], "booking_started")))
      throw new ParticipationError("processing", 409);
    try {
      record.booking = await workflow.book(input, record.id);
    } catch (error) {
      if (error instanceof ParticipationError && error.code === "slot_unavailable") {
        await workflow.removeUnbooked(record);
        throw error;
      }
      await workflow.update(record.id, "needs_review");
      throw new ParticipationError("review_required", 503);
    }
    await workflow.update(record.id, "booked", record.booking);
    record.status = "booked";
  }
  if (record.status !== "complete") {
    if (!(await workflow.claim(record.id, ["reserved", "booked", "delivery_pending"], "email_sending")))
      throw new ParticipationError("processing", 409);
    try {
      await workflow.sendAccountConfirmation(input, record);
    } catch {
      await workflow.update(record.id, "delivery_pending");
      throw new ParticipationError("delivery_pending", 503);
    }
    await workflow.update(record.id, "complete");
  }
  return { success: true, accountCreated: true, accountConfirmationSent: true, booking: record.booking };
}

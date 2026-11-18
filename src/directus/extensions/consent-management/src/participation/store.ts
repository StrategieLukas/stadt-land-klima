import { createHash, randomUUID } from "node:crypto";
import type { Accountability, ApiExtensionContext } from "@directus/types";
import { z } from "zod";
import {
  ParticipationError,
  ParticipationOptionsSchema,
  ParticipationBookingSchema,
  type ParticipationInput,
  type ParticipationAgreement,
} from "../../../../../frontend/shared/participation.ts";
import { calendarConfig, participationCalendar } from "./calendar.ts";
import { completeParticipation } from "./workflow.ts";

export type ParticipationContext = Pick<ApiExtensionContext, "services" | "database" | "getSchema" | "env" | "logger">;
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const table = "participation_registrations";
const AgreementRow = z.object({
  id: z.uuid(),
  type: z.enum(["terms_of_service", "data_protection"]),
  version: z.string().min(1),
  legal_text: z.string().min(1),
});
export function publicAgreements(raw: unknown): ParticipationAgreement[] {
  const parsed = AgreementRow.array().safeParse(raw);
  if (!parsed.success) throw new ParticipationError("unavailable", 503);
  const rows = parsed.data;
  if (rows.length !== 2 || new Set(rows.map((row) => row.type)).size !== 2)
    throw new ParticipationError("unavailable", 503);
  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    version: row.version,
    legalText: row.legal_text,
    digest: digest(JSON.stringify(row)),
  }));
}
const currentFilter = { isCurrentVersion: { _eq: true }, type: { _in: ["terms_of_service", "data_protection"] } };
const agreementFields = ["id", "type", "version", "legal_text"];

export async function participationOptions(context: ParticipationContext, actor: Accountability) {
  const schema = await context.getSchema();
  const items = (name: string) => new context.services.ItemsService(name, { schema, accountability: actor });
  const [rawAreas, rawProjects, rawAgreements] = await Promise.all([
    items("organisation_teams").readByQuery({ fields: ["id", "team_key", "label"], sort: ["sort"], limit: 100 }),
    items("participation_projects").readByQuery({
      fields: ["id", "title", "description", "area"],
      filter: { status: { _eq: "open" } },
      sort: ["sort", "id"],
      limit: 100,
    }),
    items("agreement_versions").readByQuery({ fields: agreementFields, filter: currentFilter, limit: 3 }),
  ]);
  const areas = z.array(z.object({ id: z.uuid(), team_key: z.string(), label: z.string() })).parse(rawAreas);
  let agreements: ParticipationAgreement[] = [];
  try {
    agreements = publicAgreements(rawAgreements);
  } catch (error) {
    if (!(error instanceof ParticipationError)) throw error;
  }
  return ParticipationOptionsSchema.parse({
    areas: areas.map((area) => ({ id: area.id, key: area.team_key, label: area.label })),
    projects: rawProjects,
    agreements,
    personalOnboardingAvailable: !!calendarConfig(context.env),
  });
}

function fingerprint(input: ParticipationInput) {
  const intent =
    input.intent.path === "local"
      ? { ...input.intent, tools: [...input.intent.tools].sort() }
      : { ...input.intent, areas: [...input.intent.areas].sort(), projects: [...input.intent.projects].sort() };
  return digest(
    JSON.stringify({ ...input, intent, agreements: [...input.agreements].sort((a, b) => a.id.localeCompare(b.id)) }),
  );
}
const RecordSchema = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  status: z.enum([
    "reserved",
    "booking_started",
    "booked",
    "email_sending",
    "delivery_pending",
    "complete",
    "needs_review",
  ]),
  booking: ParticipationBookingSchema.nullable(),
  fingerprint: z.string(),
});

/** A website caller may create only a minimal invited account, never grant an interest's editorial role. */
async function minimalRole(
  context: ParticipationContext,
  schema: Awaited<ReturnType<ParticipationContext["getSchema"]>>,
) {
  const service = new context.services.RolesService({ schema, accountability: null });
  const roles = z
    .array(
      z.object({
        id: z.uuid(),
        name: z.string(),
        parent: z.uuid().nullable(),
        policies: z.array(z.object({ policy: z.object({ admin_access: z.boolean() }) })),
      }),
    )
    .parse(await service.readByQuery({ fields: ["id", "name", "parent", "policies.policy.admin_access"], limit: -1 }));
  const matches = roles.filter((role) => role.name === "MinimalUser");
  const role = matches.length === 1 ? matches[0] : undefined;
  let current = role;
  const visited = new Set<string>();
  while (current) {
    if (visited.has(current.id) || current.policies.some((access) => access.policy.admin_access))
      throw new ParticipationError("unavailable", 503);
    visited.add(current.id);
    if (!current.parent) break;
    current = roles.find((candidate) => candidate.id === current?.parent);
    if (!current) throw new ParticipationError("unavailable", 503);
  }
  if (!role) throw new ParticipationError("unavailable", 503);
  return role.id;
}

export async function registerParticipation(
  context: ParticipationContext,
  input: ParticipationInput,
  transport: typeof fetch = fetch,
) {
  const schema = await context.getSchema();
  const system = { schema, accountability: null };
  const items = (name: string) => new context.services.ItemsService(name, system);
  const calendar = participationCalendar(calendarConfig(context.env), transport);
  const requestDigest = digest(input.requestId);
  const inputFingerprint = fingerprint(input);
  return completeParticipation(input, {
    async reserve() {
      return context.database.transaction(async (db) => {
        // Shared namespace with role invitations serializes collisions with that workflow too.
        await db.raw("SELECT pg_advisory_xact_lock(hashtext(?), hashtext(?))", ["role-invitation-user", input.email]);
        const existing = await db(table).where({ request_digest: requestDigest }).first();
        if (existing) {
          const record = RecordSchema.parse(existing);
          if (record.fingerprint !== inputFingerprint) throw new ParticipationError("invalid_request", 409);
          return record;
        }
        const user = await db("directus_users").whereRaw("lower(trim(email)) = ?", [input.email]).select("id").first();
        if (user) throw new ParticipationError("duplicate_email", 409);
        // Lock the exact current documents while recording their acceptance and immutable evidence.
        const versions = publicAgreements(
          await db("agreement_versions")
            .where({ isCurrentVersion: true })
            .whereIn("type", ["terms_of_service", "data_protection"])
            .select(agreementFields)
            .forShare(),
        );
        if (
          versions.some(
            (version) =>
              !input.agreements.some((accepted) => accepted.id === version.id && accepted.digest === version.digest),
          )
        )
          throw new ParticipationError("agreements_changed", 409);
        if (input.intent.path === "build") {
          const areas = z.array(z.object({ id: z.uuid() })).parse(await db("organisation_teams").select("id"));
          const projects = z
            .array(z.object({ id: z.uuid() }))
            .parse(await db("participation_projects").where({ status: "open" }).select("id").forShare());
          if (
            input.intent.areas.some((id) => !areas.some((area) => area.id === id)) ||
            input.intent.projects.some((id) => !projects.some((project) => project.id === id))
          )
            throw new ParticipationError("interests_changed", 409);
        }
        if (input.mode === "personal") {
          if (!calendarConfig(context.env)) throw new ParticipationError("calendar_unavailable", 503);
          const start = Date.parse(input.start);
          if (start <= Date.now() || start > Date.now() + 120 * 86400000)
            throw new ParticipationError("slot_unavailable", 409);
        }
        const role = await minimalRole(context, schema);
        const users = new context.services.UsersService({ ...system, knex: db });
        let userId: string;
        try {
          userId = z.uuid().parse(
            await users.createOne({
              email: input.email,
              first_name: input.firstName,
              last_name: input.lastName,
              role,
              status: "invited",
              language: input.language,
            }),
          );
        } catch (error) {
          const duplicate = z.object({ code: z.string(), constraint: z.string().optional() }).safeParse(error);
          if (
            duplicate.success &&
            (["RECORD_NOT_UNIQUE", "USER_ALREADY_EXISTS"].includes(duplicate.data.code) ||
              (duplicate.data.code === "23505" && duplicate.data.constraint?.includes("email")))
          ) {
            throw new ParticipationError("duplicate_email", 409);
          }
          throw error;
        }
        const consent = new context.services.ItemsService("user_consent", { ...system, knex: db });
        await consent.createMany(versions.map((version) => ({ user_id: userId, consent_target: version.id })));
        const id = randomUUID();
        await new context.services.ItemsService(table, { ...system, knex: db }).createOne({
          id,
          user_id: userId,
          request_digest: requestDigest,
          fingerprint: inputFingerprint,
          status: "reserved",
          mode: input.mode,
          path: input.intent.path,
          intent: input.intent,
          evidence: versions.map((version) => ({ ...version, acceptedAt: new Date().toISOString() })),
          booking: null,
        });
        return { id, user_id: userId, status: "reserved" as const, booking: null };
      });
    },
    async claim(id, from, to) {
      // One atomic status transition elects the only worker allowed to contact the provider/send mail.
      const rows = await context
        .database(table)
        .where({ id })
        .whereIn("status", from)
        .update({ status: to, date_updated: new Date() })
        .returning("id");
      return rows.length === 1;
    },
    async update(id, status, booking) {
      await items(table).updateOne(id, { status, ...(booking ? { booking } : {}) });
    },
    async removeUnbooked(record) {
      await context.database.transaction(async (db) => {
        const saved = await db(table)
          .where({ id: record.id, status: "booking_started", user_id: record.user_id })
          .forUpdate()
          .first();
        if (!saved || saved.booking) throw new ParticipationError("review_required", 503);
        await new context.services.ItemsService(table, { ...system, knex: db }).deleteOne(record.id);
        await new context.services.UsersService({ ...system, knex: db }).deleteOne(record.user_id);
      });
    },
    book: (value, id) => calendar.book(value, id),
    async sendAccountConfirmation(value, record) {
      // Native invitation establishes email ownership and lets the person choose a password.
      const users = new context.services.UsersService(system) as unknown as {
        inviteUrl(email: string, url: null): string;
      };
      const url = users.inviteUrl(value.email, null);
      const mail = new context.services.MailService(system);
      const subjects = {
        "de-DE": "Dein Konto bei Stadt.Land.Klima!",
        "en-GB": "Your Stadt.Land.Klima! account",
        "it-IT": "Il tuo account Stadt.Land.Klima!",
      };
      await mail.send({
        to: value.email,
        subject: subjects[value.language],
        template: {
          name: "email-template-participation-account",
          data: {
            firstName: value.firstName,
            language: value.language,
            url,
            personal: value.mode === "personal",
            bookingStart: record.booking?.start ?? "",
            timeZone: value.timeZone,
          },
        },
      });
    },
  });
}

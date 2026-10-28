import { randomUUID } from "node:crypto";
import type { Request, Response, Router } from "express";
import type { Accountability, ApiExtensionContext } from "@directus/types";
import {
  TRANSLATION_JOB_ID,
  TRANSLATION_WORKER_EMAIL,
  TRANSLATION_WORKER_ROLE,
  TranslationKeySchema,
  TranslationNamespaceSchema,
  TranslationOperationSchema,
  type TranslationOperation,
} from "../../../../frontend/shared/contentTranslationProtocol.ts";
import { RATE_LIMIT_CONFIG } from "../../../../frontend/server/utils/rateLimitConfig.ts";
import { extensionLog } from "../../shared/securityLogger.ts";

type Database = ApiExtensionContext["database"];
type WorkerRequest = Request & { accountability?: Accountability };
const MEMORY = "content_translation_memory";
const JOBS = "content_translation_jobs";
const USAGE = "content_translation_usage";
const REQUESTS = "content_translation_requests";
const leaseMs = 5 * 60_000;
export class TranslationControlError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}
function refuse(status: number, code: string): never {
  throw new TranslationControlError(status, code);
}
export function translationBudgets(env: Record<string, unknown>) {
  function limit(name: string, fallback: number) {
    const value = Number(env[name] ?? fallback);
    if (!Number.isSafeInteger(value) || value < 1 || value > 2_000_000_000) refuse(503, "invalid_budget_configuration");
    return value;
  }
  return { total: limit("DEEPL_MAX_TOTAL_CHARACTERS", 450_000), daily: limit("DEEPL_MAX_DAILY_CHARACTERS", 50_000) };
}
type Budgets = ReturnType<typeof translationBudgets>;
type Job = {
  id: string;
  revision: number;
  namespace: string | null;
  lease_owner: string | null;
  lease_until: Date | null;
  next_run: Date;
  attempts: number;
};
type Memory = {
  id: string;
  namespace: string;
  kind: string;
  locale: string;
  format: string;
  state: string;
  reservation: string | null;
  reserved_characters: number;
  billed_characters: number;
  usage_day: string | null;
  attempts: number;
  retry_at: Date | null;
};

async function databaseTime(db: Database): Promise<Date> {
  const result = (await db.raw("SELECT clock_timestamp() AS now")) as { rows: { now: Date }[] };
  return result.rows[0]!.now;
}
async function ensureJob(db: Database, now: Date) {
  await db(JOBS).insert({ id: TRANSLATION_JOB_ID, revision: 1, next_run: now, attempts: 0 }).onConflict("id").ignore();
}
async function usageRow(db: Database, id: string) {
  await db(USAGE).insert({ id, reserved_characters: 0, billed_characters: 0 }).onConflict("id").ignore();
  return (await db(USAGE).where({ id }).forUpdate().first()) as {
    reserved_characters: number;
    billed_characters: number;
  };
}
function owned(job: Job, owner: string, namespace: string, now: Date) {
  if (job.lease_owner !== owner || !job.lease_until || job.lease_until <= now) refuse(409, "lease_expired");
  if (job.namespace !== namespace) refuse(409, "namespace_changed");
}
async function extend(db: Database, owner: string, now: Date) {
  await db(JOBS)
    .where({ id: TRANSLATION_JOB_ID, lease_owner: owner })
    .update({ lease_until: new Date(now.getTime() + leaseMs) });
}

/** Every operation is idempotent or guarded by a lease. Provider calls occur only after reserve commits. */
export async function executeTranslationOperation(
  database: Database,
  operation: TranslationOperation,
  budgets: Budgets,
) {
  return database.transaction(async (db) => {
    const now = await databaseTime(db);
    await ensureJob(db, now);
    const job = (await db(JOBS).where({ id: TRANSLATION_JOB_ID }).forUpdate().first()) as Job;
    if (operation.op === "enqueue") {
      if (
        operation.namespace &&
        operation.namespace !== job.namespace &&
        job.lease_owner &&
        job.lease_until &&
        job.lease_until > now
      )
        refuse(409, "worker_busy");
      await db(JOBS)
        .where({ id: job.id })
        .update({
          revision: job.revision + 1,
          next_run: new Date(now.getTime() + 30_000),
          ...(operation.namespace ? { namespace: operation.namespace } : {}),
        });
      return { queued: true };
    }
    if (operation.op === "retry") {
      // Previous uncertain reservations remain charged to the conservative local budget.
      const count = await db(MEMORY).whereIn("id", operation.keys).whereIn("state", ["uncertain", "blocked"]).update({
        state: "pending",
        reservation: null,
        reserved_characters: 0,
        retry_at: null,
        attempts: 0,
        updated_at: now,
      });
      await db(JOBS)
        .where({ id: job.id })
        .update({ revision: job.revision + 1, next_run: new Date(now.getTime() + 30_000) });
      return { retried: count };
    }
    if (operation.op === "claim") {
      if (job.namespace && job.namespace !== operation.namespace) refuse(409, "namespace_requires_explicit_enqueue");
      if (job.lease_owner && job.lease_owner !== operation.owner && job.lease_until && job.lease_until > now)
        return { lease: null };
      if (job.lease_owner !== operation.owner && job.next_run > now) return { lease: null };
      // A crashed request may already have been billed. Never regenerate its units automatically.
      if (job.lease_owner !== operation.owner)
        await db(MEMORY).where({ state: "inflight" }).update({ state: "uncertain", updated_at: now });
      await db(JOBS)
        .where({ id: job.id })
        .update({
          namespace: operation.namespace,
          lease_owner: operation.owner,
          lease_until: new Date(now.getTime() + leaseMs),
        });
      return { lease: { owner: operation.owner, revision: job.revision } };
    }
    owned(job, operation.owner, operation.namespace, now);
    if (operation.op === "finish") {
      const changed = job.revision !== operation.revision;
      const failed = !["none", "attention"].includes(operation.error);
      const backoff = Math.min(900_000, 30_000 * 2 ** Math.min(job.attempts, 5));
      const nextRun =
        operation.error === "budget"
          ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
          : new Date(now.getTime() + (failed ? backoff : 900_000));
      await db(JOBS)
        .where({ id: job.id })
        .update({
          lease_owner: null,
          lease_until: null,
          next_run: changed ? job.next_run : nextRun,
          attempts: failed ? job.attempts + 1 : 0,
          last_error: operation.error === "none" ? null : operation.error,
        });
      return { finished: true };
    }
    if (operation.op === "reserve") {
      if (job.revision !== operation.revision) refuse(409, "source_changed");
      if (new Set(operation.units.map((unit) => unit.key)).size !== operation.units.length)
        refuse(400, "duplicate_units");
      const existing = (await db(MEMORY)
        .whereIn(
          "id",
          operation.units.map((unit) => unit.key),
        )
        .forUpdate()
        .select("*")) as Memory[];
      if (
        existing.length === operation.units.length &&
        existing.every((row) => row.state === "inflight" && row.reservation === operation.batch)
      ) {
        await extend(db, operation.owner, now);
        return { reserved: true };
      }
      if (
        existing.some(
          (row) =>
            row.namespace !== operation.namespace || row.state !== "pending" || (row.retry_at && row.retry_at > now),
        )
      )
        refuse(409, "units_unavailable");
      const characters = operation.units.reduce((sum, unit) => sum + unit.characters, 0);
      const day = now.toISOString().slice(0, 10);
      const total = await usageRow(db, "total");
      const daily = await usageRow(db, `day:${day}`);
      if (
        total.reserved_characters + characters > budgets.total ||
        daily.reserved_characters + characters > budgets.daily
      )
        refuse(429, "local_character_budget");
      await db(USAGE)
        .whereIn("id", ["total", `day:${day}`])
        .increment("reserved_characters", characters);
      for (const unit of operation.units) {
        await db(MEMORY)
          .insert({
            id: unit.key,
            namespace: operation.namespace,
            kind: "unit",
            locale: unit.locale,
            format: "text",
            state: "inflight",
            translated_text: null,
            reservation: operation.batch,
            reserved_characters: unit.characters,
            billed_characters: 0,
            usage_day: day,
            retry_at: null,
            attempts: 1,
            updated_at: now,
          })
          .onConflict("id")
          .merge({
            state: "inflight",
            reservation: operation.batch,
            reserved_characters: unit.characters,
            billed_characters: 0,
            usage_day: day,
            retry_at: null,
            attempts: db.raw(`${MEMORY}.attempts + 1`),
            updated_at: now,
          });
      }
      await extend(db, operation.owner, now);
      return { reserved: true };
    }
    const batchRows = operation.batch
      ? ((await db(MEMORY)
          .where({ reservation: operation.batch, namespace: operation.namespace, kind: "unit" })
          .forUpdate()
          .select("*")) as Memory[])
      : [];
    if (operation.op === "failed-batch") {
      const refundable = operation.code !== "uncertain";
      const retry = ["rate", "quota", "cancelled"].includes(operation.code);
      const retryAt =
        operation.code === "quota"
          ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
          : new Date(now.getTime() + 60_000);
      for (const row of batchRows.filter((row) => row.state === "inflight")) {
        if (refundable)
          await db(USAGE)
            .whereIn("id", ["total", `day:${row.usage_day}`])
            .decrement("reserved_characters", row.reserved_characters);
        await db(MEMORY)
          .where({ id: row.id })
          .update({
            state: refundable
              ? retry && (row.attempts < 5 || operation.code === "cancelled")
                ? "pending"
                : "blocked"
              : "uncertain",
            retry_at: operation.code === "cancelled" ? null : retry ? retryAt : null,
            ...(operation.code === "cancelled" ? { attempts: Math.max(0, row.attempts - 1) } : {}),
            updated_at: now,
          });
      }
      await extend(db, operation.owner, now);
      return { recorded: true };
    }
    if (operation.op === "commit") {
      if (
        operation.units.length &&
        (!operation.batch ||
          operation.units.length !== batchRows.length ||
          new Set(operation.units.map((unit) => unit.key)).size !== operation.units.length ||
          batchRows.some(
            (row) => !operation.units.some((unit) => unit.key === row.id) || !["ready", "inflight"].includes(row.state),
          ))
      )
        refuse(400, "reservation_mismatch");
      for (const unit of operation.units) {
        const row = batchRows.find((row) => row.id === unit.key)!;
        if (row.state === "ready") continue;
        await db(MEMORY)
          .where({ id: row.id, state: "inflight" })
          .update({ state: "ready", translated_text: unit.text, billed_characters: unit.billed, updated_at: now });
        await db(USAGE)
          .whereIn("id", ["total", `day:${row.usage_day}`])
          .increment("billed_characters", unit.billed);
      }
      for (const field of operation.fields)
        await db(MEMORY)
          .insert({
            id: field.key,
            namespace: operation.namespace,
            kind: "field",
            locale: field.locale,
            format: field.format,
            state: "ready",
            translated_text: field.text,
            reserved_characters: 0,
            billed_characters: 0,
            attempts: 0,
            updated_at: now,
          })
          .onConflict("id")
          .ignore();
      await extend(db, operation.owner, now);
      return { committed: true };
    }
    return refuse(400, "invalid_operation");
  });
}

async function authorize(req: WorkerRequest, database: Database) {
  if (!req.accountability?.user) refuse(403, "forbidden");
  if (req.accountability.admin) return "admin";
  const user = await database("directus_users as u")
    .join("directus_roles as r", "u.role", "r.id")
    .where({
      "u.id": req.accountability.user,
      "u.status": "active",
      "u.email": TRANSLATION_WORKER_EMAIL,
      "r.name": TRANSLATION_WORKER_ROLE,
    })
    .select("u.id")
    .first();
  if (!user) refuse(403, "forbidden");
  return "worker";
}
export async function controlRateLimit(database: Database, user: string, read = false) {
  const preset = RATE_LIMIT_CONFIG[read ? "content-translation-status" : "content-translation-control"]!;
  const subject = `${read ? "read:" : "write:"}${user}`;
  await database.transaction(async (db) => {
    // Serialise windows across processes; the lock scope never includes provider work.
    await db.raw("SELECT pg_advisory_xact_lock(hashtext(?), hashtext(?))", ["translation-rate", subject]);
    const now = await databaseTime(db);
    await db(REQUESTS)
      .where("created_at", "<", new Date(now.getTime() - preset.windowSeconds * 1000))
      .delete();
    const row = await db(REQUESTS).where({ subject }).count({ count: "id" }).first();
    if (Number(row?.count ?? 0) >= preset.max) refuse(429, "control_rate_limit");
    await db(REQUESTS).insert({ id: randomUUID(), subject, created_at: now });
  });
}

export default (router: Router, context: Pick<ApiExtensionContext, "database" | "env" | "logger">) => {
  const { database, env, logger } = context;
  const handle =
    (run: (req: WorkerRequest, res: Response, identity: string) => Promise<void>) =>
    async (req: WorkerRequest, res: Response) => {
      res.setHeader("Cache-Control", "private, no-store");
      try {
        const identity = await authorize(req, database);
        await run(req, res, identity);
      } catch (error) {
        const controlled = error instanceof TranslationControlError;
        const status = controlled ? error.status : 503;
        if (status === 429) res.setHeader("Retry-After", "60");
        if (!controlled) extensionLog(logger, "warn", "directus.translation.control_unavailable");
        res.status(status).json({ error: controlled ? error.code : "translation_control_unavailable" });
      }
    };
  router.get(
    "/memory",
    handle(async (req, res) => {
      const namespace = TranslationNamespaceSchema.safeParse(req.query.namespace);
      const keys = typeof req.query.keys === "string" ? req.query.keys.split(",") : [];
      if (
        !namespace.success ||
        !keys.length ||
        keys.length > 100 ||
        keys.some((key) => !TranslationKeySchema.safeParse(key).success)
      )
        refuse(400, "invalid_memory_query");
      const rows = await database(MEMORY)
        .where({ namespace: namespace.data })
        .whereIn("id", keys)
        .select("id", "namespace", "kind", "locale", "format", "state", "translated_text", "retry_at");
      res.json({ rows });
    }),
  );
  router.get(
    "/status",
    handle(async (_req, res) => {
      await controlRateLimit(database, _req.accountability!.user!, true);
      const job = await database(JOBS)
        .where({ id: TRANSLATION_JOB_ID })
        .select("revision", "namespace", "lease_until", "next_run", "last_error", "attempts")
        .first();
      const usage = await database(USAGE)
        .select("id", "reserved_characters", "billed_characters")
        .orderBy("id", "desc")
        .limit(40);
      const counts = await database(MEMORY)
        .select("namespace", "kind", "state")
        .count({ count: "id" })
        .groupBy("namespace", "kind", "state");
      const attention = await database(MEMORY)
        .whereIn("state", ["uncertain", "blocked"])
        .select("id", "namespace", "locale", "state", "reserved_characters")
        .limit(50);
      res.json({ job: job ?? null, usage, counts, attention, limits: translationBudgets(env) });
    }),
  );
  router.post(
    "/",
    handle(async (req, res, identity) => {
      if (req.headers.origin) refuse(403, "operator_or_service_only");
      await controlRateLimit(database, req.accountability!.user!);
      if (Buffer.byteLength(JSON.stringify(req.body) ?? "") > 512_000) refuse(413, "translation_payload_limit");
      const parsed = TranslationOperationSchema.safeParse(req.body);
      if (!parsed.success) refuse(400, "invalid_operation");
      if (["enqueue", "retry"].includes(parsed.data.op) && identity !== "admin") refuse(403, "operator_only");
      res.json(await executeTranslationOperation(database, parsed.data, translationBudgets(env)));
    }),
  );
};

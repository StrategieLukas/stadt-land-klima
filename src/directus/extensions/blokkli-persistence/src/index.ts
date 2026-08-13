import { createHash } from "node:crypto";
import type { Request, Response, Router } from "express";
import type { Accountability, Database, ItemsService, Schema } from "@directus/types";

const ALLOWED_ENTITY_TYPES = new Set(["pages", "news_items"]);
const BLOCK_FIELD_NAME = "content";
const MAX_ROOT_BLOCKS = 500;
const MAX_PAYLOAD_BYTES = 5 * 1024 * 1024;
const EDITOR_POLICY = "Blokkli-Editor";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface BlockRow {
  id: number;
  uuid: string;
  bundle: string;
  entity_type: string;
  entity_uuid: string;
  field_name: string;
  sort_order: number;
  status: string;
  props: Record<string, unknown> | null;
  options: Record<string, unknown> | null;
}

interface BlockInput {
  uuid: string;
  bundle: string;
  props?: Record<string, unknown>;
  options?: Record<string, unknown>;
}

interface PublishBody {
  entityType?: unknown;
  entityUuid?: unknown;
  fieldName?: unknown;
  baseRevision?: unknown;
  blocks?: unknown;
}

interface AuthenticatedRequest extends Request {
  accountability?: Accountability;
  body: PublishBody;
}

interface ExtensionContext {
  database: Database;
  emitter: {
    emitAction: (event: string | string[], meta: unknown, context: unknown) => void;
  };
  getSchema: () => Promise<Schema>;
  services: {
    ItemsService: new (
      collection: string,
      options: {
        schema: Schema;
        accountability?: Accountability;
        knex?: Database;
      },
    ) => ItemsService;
  };
  logger: {
    error: (message: string, error?: unknown) => void;
  };
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  if (isPlainObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value) ?? "null";
}

function canonicalBlocks(rows: BlockRow[]) {
  return [...rows]
    .sort((left, right) => {
      const sortDifference = Number(left.sort_order) - Number(right.sort_order);
      return sortDifference || String(left.uuid).localeCompare(String(right.uuid));
    })
    .map((row) => ({
      uuid: String(row.uuid),
      bundle: row.bundle,
      props: row.props ?? {},
      options: row.options ?? {},
    }));
}

function revisionFor(rows: BlockRow[]): string {
  return createHash("sha256")
    .update(stableStringify(canonicalBlocks(rows)))
    .digest("hex");
}

function parseScope(source: Record<string, unknown>) {
  const entityType = source.entity_type ?? source.entityType;
  const entityUuid = source.entity_uuid ?? source.entityUuid;
  const fieldName = source.field_name ?? source.fieldName ?? BLOCK_FIELD_NAME;

  if (typeof entityType !== "string" || !ALLOWED_ENTITY_TYPES.has(entityType)) {
    throw new HttpError(400, "Unsupported Blökkli entity type.");
  }
  if (typeof entityUuid !== "string" || !UUID_PATTERN.test(entityUuid)) {
    throw new HttpError(400, "Blökkli entity UUID must be an immutable Directus UUID.");
  }
  if (fieldName !== BLOCK_FIELD_NAME) {
    throw new HttpError(400, "Unsupported Blökkli field.");
  }

  return { entityType, entityUuid, fieldName };
}

function parseBlocks(value: unknown): BlockInput[] {
  if (!Array.isArray(value)) {
    throw new HttpError(400, 'The "blocks" field must be an array.');
  }
  if (value.length > MAX_ROOT_BLOCKS) {
    throw new HttpError(413, `A page may contain at most ${MAX_ROOT_BLOCKS} root blocks.`);
  }

  const uuids = new Set<string>();
  return value.map((candidate, index) => {
    if (!isPlainObject(candidate)) {
      throw new HttpError(400, `Block ${index + 1} is invalid.`);
    }

    const { uuid, bundle, props = {}, options = {} } = candidate;
    if (typeof uuid !== "string" || !UUID_PATTERN.test(uuid)) {
      throw new HttpError(400, `Block ${index + 1} has an invalid UUID.`);
    }
    if (uuids.has(uuid)) {
      throw new HttpError(400, `Block UUID ${uuid} occurs more than once.`);
    }
    if (typeof bundle !== "string" || bundle.trim() === "") {
      throw new HttpError(400, `Block ${index + 1} has no bundle.`);
    }
    if (!isPlainObject(props) || !isPlainObject(options)) {
      throw new HttpError(400, `Block ${index + 1} has invalid props or options.`);
    }

    uuids.add(uuid);
    return { uuid, bundle, props, options };
  });
}

function sendError(res: Response, error: unknown, logger: ExtensionContext["logger"]) {
  if (error instanceof HttpError) {
    return res.status(error.status).json({ error: error.message });
  }

  const directusError = error as {
    status?: number;
    statusCode?: number;
    code?: string;
    message?: string;
  };
  const status = directusError.status ?? directusError.statusCode;
  if (status && status >= 400 && status < 500) {
    return res.status(status).json({
      error: directusError.message ?? "Blökkli request was rejected.",
      code: directusError.code,
    });
  }

  logger.error("[blokkli-persistence] Request failed", error);
  return res.status(500).json({ error: "Blökkli content could not be persisted." });
}

async function canPublish(
  database: Database,
  accountability?: Accountability,
): Promise<boolean> {
  if (accountability?.admin) return true;
  if (!accountability?.user) return false;

  const role = (accountability as Accountability & { role?: string }).role;
  const rows = await database("directus_access as access")
    .leftJoin("directus_policies as policy", "policy.id", "access.policy")
    .where((builder) => {
      builder.where("access.user", accountability.user);
      if (role) builder.orWhere("access.role", role);
    })
    .select("policy.name");

  return rows.some((row: { name?: string }) => row.name === EDITOR_POLICY);
}

export default {
  id: "blokkli-persistence",
  handler: (
    router: Router,
    { database, emitter, getSchema, services, logger }: ExtensionContext,
  ) => {
    router.get("/state", async (req: AuthenticatedRequest, res: Response) => {
      try {
        const scope = parseScope(req.query as Record<string, unknown>);
        const schema = await getSchema();
        const blocksService = new services.ItemsService("blocks", {
          schema,
          accountability: req.accountability,
        });
        const rows = (await blocksService.readByQuery({
          fields: [
            "id",
            "uuid",
            "bundle",
            "entity_type",
            "entity_uuid",
            "field_name",
            "sort_order",
            "status",
            "props",
            "options",
          ],
          filter: {
            entity_type: { _eq: scope.entityType },
            entity_uuid: { _eq: scope.entityUuid },
            field_name: { _eq: scope.fieldName },
            status: { _neq: "archived" },
          },
          sort: ["sort_order", "uuid"],
          limit: -1,
        })) as BlockRow[];

        return res.json({
          blocks: canonicalBlocks(rows),
          revision: revisionFor(rows),
        });
      } catch (error) {
        return sendError(res, error, logger);
      }
    });

    router.post("/publish", async (req: AuthenticatedRequest, res: Response) => {
      try {
        if (!(await canPublish(database, req.accountability))) {
          throw new HttpError(403, "Blökkli editor permission is required.");
        }

        const serializedSize = Buffer.byteLength(JSON.stringify(req.body ?? {}), "utf8");
        if (serializedSize > MAX_PAYLOAD_BYTES) {
          throw new HttpError(413, "The Blökkli publish payload is too large.");
        }

        const scope = parseScope(req.body as Record<string, unknown>);
        const blocks = parseBlocks(req.body.blocks);
        if (typeof req.body.baseRevision !== "string") {
          throw new HttpError(400, 'The "baseRevision" field is required.');
        }

        const schema = await getSchema();
        const committedBlockChanges: {
          createdUuids: string[];
          updatedIds: number[];
        } = { createdUuids: [], updatedIds: [] };
        const result = await database.transaction(async (trx) => {
          // Serialise publishes for the same entity, including pages without blocks.
          await trx.raw("SELECT pg_advisory_xact_lock(hashtext(?), hashtext(?))", [
            scope.entityType,
            `${scope.entityUuid}:${scope.fieldName}`,
          ]);

          const allRows = (await trx("blocks")
            .select(
              "id",
              "uuid",
              "bundle",
              "entity_type",
              "entity_uuid",
              "field_name",
              "sort_order",
              "status",
              "props",
              "options",
            )
            .where({
              entity_type: scope.entityType,
              entity_uuid: scope.entityUuid,
              field_name: scope.fieldName,
            })
            .orderBy("sort_order")
            .forUpdate()) as BlockRow[];

          const currentRows = allRows.filter((row) => row.status !== "archived");

          const currentRevision = revisionFor(currentRows);
          if (req.body.baseRevision !== currentRevision) {
            throw new HttpError(
              409,
              "The page changed after editing started. Your draft was kept; reload before publishing again.",
            );
          }

          const incomingUuids = blocks.map((block) => block.uuid);
          if (incomingUuids.length > 0) {
            const conflicts = await trx("blocks")
              .select("uuid", "entity_type", "entity_uuid", "field_name")
              .whereIn("uuid", incomingUuids)
              .where((builder) => {
                builder
                  .whereNot("entity_type", scope.entityType)
                  .orWhereNot("entity_uuid", scope.entityUuid)
                  .orWhereNot("field_name", scope.fieldName);
              });
            if (conflicts.length > 0) {
              throw new HttpError(409, "A block UUID already belongs to another page.");
            }
          }

          const currentByUuid = new Map(
            allRows.map((row) => [String(row.uuid), row]),
          );
          const updatePayloads: Array<Record<string, unknown>> = [];
          const createPayloads: Array<Record<string, unknown>> = [];

          blocks.forEach((block, sortOrder) => {
            const payload = {
              uuid: block.uuid,
              bundle: block.bundle,
              entity_type: scope.entityType,
              entity_uuid: scope.entityUuid,
              field_name: scope.fieldName,
              sort_order: sortOrder,
              status: "published",
              props: block.props ?? {},
              options: block.options ?? {},
            };
            const existing = currentByUuid.get(block.uuid);
            if (existing) {
              updatePayloads.push({ id: existing.id, ...payload });
            } else {
              createPayloads.push(payload);
            }
          });

          const staleIds = currentRows
            .filter((row) => !incomingUuids.includes(String(row.uuid)))
            .map((row) => row.id);
          const blocksService = new services.ItemsService("blocks", {
            schema,
            accountability: req.accountability,
            knex: trx,
          });
          const deferActions = {
            // ItemsService is nested inside the larger page transaction. Its
            // default action events would run before the outer commit and could
            // not read the new rows yet.
            bypassEmitAction: () => undefined,
          };

          // Every mutation shares the outer transaction. A single failure rolls all
          // creates, updates and archives back instead of leaving a partial page.
          if (updatePayloads.length > 0) {
            await blocksService.updateBatch(updatePayloads, deferActions);
          }
          if (createPayloads.length > 0) {
            await blocksService.createMany(createPayloads, deferActions);
          }
          if (staleIds.length > 0) {
            // Keep removed content recoverable and let the normal update event
            // remove it from downstream indexes.
            await blocksService.updateMany(
              staleIds,
              { status: "archived" },
              deferActions,
            );
          }

          const persistedRows = (await trx("blocks")
            .select(
              "id",
              "uuid",
              "bundle",
              "entity_type",
              "entity_uuid",
              "field_name",
              "sort_order",
              "status",
              "props",
              "options",
            )
            .where({
              entity_type: scope.entityType,
              entity_uuid: scope.entityUuid,
              field_name: scope.fieldName,
            })
            .whereNot("status", "archived")
            .orderBy("sort_order")) as BlockRow[];

          committedBlockChanges.createdUuids = createPayloads.map((payload) =>
            String(payload.uuid),
          );
          committedBlockChanges.updatedIds = [
            ...updatePayloads.map((payload) => Number(payload.id)),
            ...staleIds,
          ];

          return {
            blocks: canonicalBlocks(persistedRows),
            revision: revisionFor(persistedRows),
          };
        });

        // The extension emitter is intentionally separate from Directus core
        // action hooks. The search hook listens for this post-commit event so it
        // never tries to index rows that are still invisible in the transaction.
        emitter.emitAction(
          "blokkli.blocks.committed",
          committedBlockChanges,
          { database, schema, accountability: req.accountability },
        );

        return res.json(result);
      } catch (error) {
        return sendError(res, error, logger);
      }
    });
  },
};

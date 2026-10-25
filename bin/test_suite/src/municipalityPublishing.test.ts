import assert from "node:assert/strict";
import { test } from "node:test";
import {
  enforcePublication,
  logPublication,
  ensurePreviewToken,
  type PublicationContext,
} from "../../../src/directus/extensions/hook-calc-score-and-ranks/src/publication.ts";

function fixture() {
  const writes: unknown[] = [];
  const logs: { fields: Record<string, unknown>; message: string }[] = [];
  const data = {
    verified: false,
    token: null as string | null,
    measures: [{ id: "m1" }, { id: "m2" }],
    ratings: [{ measure_id: "m1", applicable: true as boolean | null, rating: "1" as string | null }],
  };
  class ItemsService {
    constructor(readonly table: string) {}
    async readOne() {
      if (this.table === "directus_users") return { verified: data.verified, email: "actor@example.org" };
      return { localteam_id: "team", preview_token: data.token };
    }
    async readByQuery(query: { offset?: number; filter?: Record<string, unknown> }) {
      if (this.table === "municipality_scores")
        return [
          {
            id: "score",
            municipality: "town",
            catalog_version: "catalog",
            percentage_rated: 100,
            published: false,
            preview_enabled: true,
          },
        ];
      if (query.offset) return [];
      return this.table === "measures" ? data.measures : data.ratings;
    }
    async updateOne(id: unknown, patch: unknown) {
      writes.push({ id, patch });
    }
  }
  const context: PublicationContext = {
    services: { ItemsService } as unknown as PublicationContext["services"],
    getSchema: async () => ({}) as Awaited<ReturnType<PublicationContext["getSchema"]>>,
    logger: {
      info: (fields: Record<string, unknown>, message: string) => logs.push({ fields, message }),
      warn() {},
    } as unknown as PublicationContext["logger"],
  };
  return { context, data, writes, logs };
}
const meta = { collection: "municipality_scores", keys: ["score"] };
const event = { accountability: { user: "11111111-1111-4111-8111-111111111111", admin: false } };

test("unverified actors cannot change either state; errors explain anti-spam and contact", async () => {
  const f = fixture();
  for (const payload of [
    { published: true },
    { published: false },
    { preview_enabled: true },
    { preview_enabled: false },
  ]) {
    await assert.rejects(enforcePublication(payload, meta, event, f.context), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /anti-spam.*info@stadt-land-klima.de/);
      assert.equal((error as Error & { code: string }).code, "ACCOUNT_NOT_VERIFIED");
      return true;
    });
  }
  assert.deepEqual(f.writes, []);
});

test("verified actors can preview incomplete work; full publication uses real assessments, not cached 100% or submitted fields", async () => {
  const f = fixture();
  f.data.verified = true;
  assert.deepEqual(await enforcePublication({ preview_enabled: true }, meta, event, f.context), {
    preview_enabled: true,
  });
  await assert.rejects(enforcePublication({ published: true, percentage_rated: 100 }, meta, event, f.context), {
    code: "RATINGS_INCOMPLETE",
  });
  f.data.ratings.push({ measure_id: "m2", applicable: false, rating: null });
  assert.deepEqual(await enforcePublication({ published: true }, meta, event, f.context), { published: true });
  f.data.verified = false;
  await assert.rejects(enforcePublication({ published: true }, meta, event, f.context), {
    code: "ACCOUNT_NOT_VERIFIED",
  });
});

test("invalid types, initial publication and missing identities are refused; internal non-public writes remain supported", async () => {
  const f = fixture();
  f.data.verified = true;
  for (const payload of [{ published: "true" }, { preview_enabled: 1 }])
    await assert.rejects(enforcePublication(payload, meta, event, f.context), { code: "INVALID_PUBLICATION_STATE" });
  await assert.rejects(
    enforcePublication({ published: true }, { collection: "municipality_scores" }, event, f.context),
    { code: "INVALID_PUBLICATION_STATE" },
  );
  await assert.rejects(enforcePublication({ preview_enabled: true }, meta, undefined, f.context), {
    code: "ACCOUNT_NOT_VERIFIED",
  });
  assert.deepEqual(
    await enforcePublication({ published: false }, meta, { accountability: { admin: true, user: null } }, f.context),
    { published: false },
  );
  assert.deepEqual(await enforcePublication({ percentage_rated: 50 }, meta, undefined, f.context), {
    percentage_rated: 50,
  });
});

test("publication logs use event-context actor and separate flags without tokens or research", async () => {
  const f = fixture();
  await logPublication({ ...meta, payload: { preview_enabled: true, source: "PRIVATE RESEARCH" } }, event, f.context);
  assert.equal(f.logs.length, 1);
  assert.equal(f.logs[0]!.fields.userId, "11111111-1111-4111-8111-111111111111");
  assert.equal(f.logs[0]!.fields.actorEmail, undefined);
  assert.deepEqual(f.logs[0]!.fields.changedFields, ["preview_enabled"]);
  assert.doesNotMatch(JSON.stringify(f.logs), /PRIVATE RESEARCH|preview_token|actor@example.org/);
});

test("missing preview tokens use cryptographic 64-character hex and existing tokens are preserved", async () => {
  const f = fixture();
  await ensurePreviewToken("town", f.context);
  assert.match(JSON.stringify(f.writes), /[a-f0-9]{64}/);
  f.data.token = "existing";
  await ensurePreviewToken("town", f.context);
  assert.equal(f.writes.length, 1);
});

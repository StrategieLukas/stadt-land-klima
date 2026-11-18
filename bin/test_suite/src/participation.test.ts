import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  ParticipationInputSchema,
  ParticipationError,
  type ParticipationInput,
} from "../../../src/frontend/shared/participation.js";
import {
  publicAgreements,
  participationOptions,
  registerParticipation,
  type ParticipationContext,
} from "../../../src/directus/extensions/consent-management/src/participation/store.js";
import { participationCalendar } from "../../../src/directus/extensions/consent-management/src/participation/calendar.js";
import type { Accountability } from "../../../src/directus/extensions/consent-management/node_modules/@directus/types/dist/index.js";
import endpoint from "../../../src/directus/extensions/consent-management/src/participation/endpoint.js";

type Row = Record<string, unknown>;
function fixture() {
  const terms = randomUUID(),
    privacy = randomUUID(),
    area = randomUUID(),
    project = randomUUID(),
    role = randomUUID();
  const tables: Record<string, Row[]> = {
    agreement_versions: [
      { id: terms, type: "terms_of_service", version: "1", legal_text: "Current terms", isCurrentVersion: true },
      { id: privacy, type: "data_protection", version: "2", legal_text: "Current privacy", isCurrentVersion: true },
    ],
    organisation_teams: [{ id: area, team_key: "technik", label: "Technik" }],
    participation_projects: [{ id: project, title: "Open project", description: "Contribute", area, status: "open" }],
    directus_users: [],
    user_consent: [],
    participation_registrations: [],
  };
  const state = {
    tables,
    mails: [] as Row[],
    providerRequests: [] as { url: string; init?: RequestInit }[],
    failMail: false,
    failConsent: false,
    calendarFailure: "",
    roleAdmin: false,
    duplicateCreate: false,
  };
  const database = Object.assign(
    (table: string) => {
      let predicates: ((row: Row) => boolean)[] = [];
      let updated: Row[] = [];
      const rows = () => tables[table]!.filter((row) => predicates.every((predicate) => predicate(row)));
      const query = {
        where(value: Row) {
          predicates.push((row) => Object.entries(value).every(([key, value]) => row[key] === value));
          return query;
        },
        whereIn(key: string, values: unknown[]) {
          predicates.push((row) => values.includes(row[key]));
          return query;
        },
        whereRaw(sql: string, values: string[]) {
          assert.equal(sql, "lower(trim(email)) = ?");
          predicates.push((row) => String(row.email).trim().toLowerCase() === values[0]);
          return query;
        },
        select() {
          return query;
        },
        forShare() {
          return query;
        },
        forUpdate() {
          return query;
        },
        async first() {
          return structuredClone(rows()[0]);
        },
        update(value: Row) {
          updated = rows();
          updated.forEach((row) => Object.assign(row, value));
          return query;
        },
        async returning() {
          return updated.map((row) => ({ id: row.id }));
        },
        then(resolve: (rows: Row[]) => unknown, reject?: (error: unknown) => unknown) {
          return Promise.resolve(structuredClone(rows())).then(resolve, reject);
        },
      };
      return query;
    },
    {
      raw: async () => ({ rows: [] }),
      async transaction<T>(run: (db: unknown) => Promise<T>): Promise<T> {
        const before = structuredClone(tables);
        try {
          return await run(database);
        } catch (error) {
          for (const key of Object.keys(tables)) tables[key] = before[key]!;
          throw error;
        }
      },
    },
  );
  const context = {
    database,
    getSchema: async () => ({}),
    env: { SLK_PARTICIPATION_CAL_API_KEY: "cal_private_test_key", SLK_PARTICIPATION_CAL_EVENT_TYPE_ID: 123 },
    logger: { info() {}, warn() {}, error() {} },
    services: {
      RolesService: class {
        async readByQuery() {
          return [
            { id: role, name: "MinimalUser", parent: null, policies: [{ policy: { admin_access: state.roleAdmin } }] },
          ];
        }
      },
      ItemsService: class {
        constructor(private collection: string) {}
        async readByQuery() {
          return structuredClone(
            tables[this.collection]!.filter(
              (row) => this.collection !== "participation_projects" || row.status === "open",
            ),
          );
        }
        async createOne(data: Row) {
          const row = { id: randomUUID(), ...structuredClone(data) };
          tables[this.collection]!.push(row);
          return row.id;
        }
        async createMany(data: Row[]) {
          if (state.failConsent) throw new Error("consent failure");
          tables[this.collection]!.push(...data.map((row) => ({ id: randomUUID(), ...row })));
        }
        async updateOne(id: string, data: Row) {
          Object.assign(
            tables[this.collection]!.find((row) => row.id === id)!,
            data,
          );
        }
        async deleteOne(id: string) {
          tables[this.collection] = tables[this.collection]!.filter((row) => row.id !== id);
        }
      },
      UsersService: class {
        async createOne(data: Row) {
          if (state.duplicateCreate)
            throw Object.assign(new Error("Concurrent account creation"), { code: "RECORD_NOT_UNIQUE" });
          const user = { id: randomUUID(), ...data };
          tables.directus_users!.push(user);
          return user.id;
        }
        async deleteOne(id: string) {
          tables.directus_users = tables.directus_users!.filter((row) => row.id !== id);
          tables.user_consent = tables.user_consent!.filter((row) => row.user_id !== id);
        }
        inviteUrl(email: string, url: null) {
          assert.equal(url, null);
          assert.match(email, /@example\.test$/);
          return "https://cms.example.test/admin/accept-invite?token=private";
        }
      },
      MailService: class {
        async send(mail: Row) {
          if (state.failMail) throw new Error("private SMTP failure");
          state.mails.push(mail);
        }
      },
    },
  } as unknown as ParticipationContext;
  const base = {
    requestId: randomUUID(),
    email: "join@example.test",
    firstName: "Erika",
    lastName: "Beispiel",
    language: "de-DE",
    timeZone: "Europe/Berlin",
    agreements: publicAgreements(tables.agreement_versions).map((version) => ({
      id: version.id,
      digest: version.digest,
      accepted: true,
    })),
    intent: { path: "build", areas: [area], projects: [], undecided: false },
    mode: "account",
  };
  const input = ParticipationInputSchema.parse(base);
  const transport: typeof fetch = async (url, init) => {
    state.providerRequests.push({ url: String(url), ...(init ? { init } : {}) });
    if (state.calendarFailure === "timeout") throw new Error("unknown remote outcome");
    if (state.calendarFailure === "conflict") return Response.json({ error: "conflict" }, { status: 409 });
    return Response.json({
      status: "success",
      data: {
        uid: "test-booking",
        status: "accepted",
        start: new Date(Date.now() + 86400000).toISOString(),
        end: new Date(Date.now() + 87600000).toISOString(),
      },
    });
  };
  return { state, context, input, transport, area, project, terms, privacy, role };
}
const fails = (code: string) => (error: unknown) => error instanceof ParticipationError && error.code === code;

test("participation payloads normalize email and forbid forged roles, missing agreements, empty interests and invalid timezones", () => {
  const { input } = fixture();
  assert.equal(ParticipationInputSchema.parse({ ...input, email: " Join@Example.test " }).email, input.email);
  for (const data of [
    { ...input, role: randomUUID() },
    { ...input, agreements: input.agreements.slice(1) },
    { ...input, agreements: input.agreements.map((value) => ({ ...value, accepted: false })) },
    { ...input, intent: { path: "build", areas: [], projects: [], undecided: false } },
    { ...input, timeZone: "not-a-timezone" },
    { ...input, intent: { path: "local", tools: [], municipality: "Freiburg" } },
  ])
    assert.equal(ParticipationInputSchema.safeParse(data).success, false);
  assert.equal(
    ParticipationInputSchema.safeParse({
      ...input,
      intent: { path: "build", areas: [], projects: [], undecided: true },
    }).success,
    true,
  );
});

test("account-only creates one invited minimal account and both native consent records; retries send no duplicate mail", async () => {
  const { context, state, input, transport, role, terms, privacy } = fixture();
  const result = await registerParticipation(context, input, transport);
  assert.equal(result.accountCreated, true);
  assert.equal(result.booking, null);
  assert.equal(state.tables.directus_users!.length, 1);
  assert.equal(state.tables.directus_users![0]!.role, role);
  assert.equal(state.tables.directus_users![0]!.status, "invited");
  assert.equal("password" in state.tables.directus_users![0]!, false);
  assert.deepEqual(
    state.tables.user_consent!.map((row) => row.consent_target),
    [terms, privacy],
  );
  const evidence = state.tables.participation_registrations![0]!.evidence as Row[];
  assert.equal(evidence.length, 2);
  assert.equal(evidence[0]!.legalText, "Current terms");
  assert.ok(evidence[0]!.acceptedAt);
  assert.equal(state.mails.length, 1);
  assert.equal(state.providerRequests.length, 0);
  assert.ok(!JSON.stringify(result).includes("private"));
  await registerParticipation(context, input, transport);
  assert.equal(state.mails.length, 1);
  assert.equal(state.tables.user_consent!.length, 2);
});

test("all existing account states, including mixed-case email, are rejected without account, consent, mail or booking changes", async () => {
  for (const status of ["invited", "active", "suspended", "archived", "unverified"]) {
    const { context, state, input, transport } = fixture();
    state.tables.directus_users!.push({ id: randomUUID(), email: "JOIN@example.test", status, role: randomUUID() });
    const before = structuredClone(state.tables);
    const personal = ParticipationInputSchema.parse({
      ...input,
      mode: "personal",
      start: new Date(Date.now() + 86400000).toISOString(),
    });
    await assert.rejects(registerParticipation(context, personal, transport), fails("duplicate_email"));
    assert.deepEqual(state.tables, before);
    assert.equal(state.mails.length, 0);
    assert.equal(state.providerRequests.length, 0);
  }
});

test("stale agreement IDs or edited-in-place legal text fail before creating anything", async () => {
  for (const edit of ["id", "text"]) {
    const { context, state, input, transport } = fixture();
    if (edit === "id") state.tables.agreement_versions![0]!.id = randomUUID();
    else state.tables.agreement_versions![0]!.legal_text = "Updated in place";
    await assert.rejects(registerParticipation(context, input, transport), fails("agreements_changed"));
    assert.equal(state.tables.directus_users!.length, 0);
    assert.equal(state.mails.length, 0);
  }
  assert.throws(() => publicAgreements([]), fails("unavailable"));
  const { state } = fixture();
  assert.throws(
    () => publicAgreements([state.tables.agreement_versions![0], state.tables.agreement_versions![0]]),
    fails("unavailable"),
  );
});

test("closed projects, elevated minimal roles and consent-write failures cannot leave a partial account", async () => {
  const first = fixture();
  first.state.tables.participation_projects![0]!.status = "closed";
  const selected = ParticipationInputSchema.parse({
    ...first.input,
    intent: { path: "build", areas: [], projects: [first.project], undecided: false },
  });
  await assert.rejects(registerParticipation(first.context, selected, first.transport), fails("interests_changed"));
  assert.equal(first.state.tables.directus_users!.length, 0);
  const elevated = fixture();
  elevated.state.roleAdmin = true;
  await assert.rejects(
    registerParticipation(elevated.context, elevated.input, elevated.transport),
    fails("unavailable"),
  );
  const failed = fixture();
  failed.state.failConsent = true;
  await assert.rejects(registerParticipation(failed.context, failed.input, failed.transport));
  assert.equal(failed.state.tables.directus_users!.length, 0);
  assert.equal(failed.state.tables.user_consent!.length, 0);
});

test("personal onboarding shares attendee email, pins the API version and sends separate account confirmation", async () => {
  const { context, state, input, transport } = fixture();
  const personal = ParticipationInputSchema.parse({
    ...input,
    mode: "personal",
    start: new Date(Date.now() + 86400000).toISOString(),
  });
  const result = await registerParticipation(context, personal, transport);
  assert.ok(result.booking);
  assert.equal(state.providerRequests.length, 1);
  assert.equal(state.mails.length, 1);
  const request = state.providerRequests[0]!;
  assert.equal(request.url, "https://api.cal.com/v2/bookings");
  const body = JSON.parse(String(request.init?.body)) as {
    attendee: { email: string };
    metadata: Row;
    leadEnrichmentOptOut: boolean;
  };
  assert.equal(body.attendee.email, input.email);
  assert.equal(body.leadEnrichmentOptOut, true);
  assert.equal("requestId" in body.metadata, false);
  assert.ok(!JSON.stringify(body).includes(input.agreements[0]!.digest));
  assert.equal((request.init?.headers as Record<string, string>)["cal-api-version"], "2026-02-25");
});

test("confirmed provider conflicts remove only the new reservation so another slot can be selected", async () => {
  const { context, state, input, transport } = fixture();
  state.calendarFailure = "conflict";
  const personal = ParticipationInputSchema.parse({
    ...input,
    mode: "personal",
    start: new Date(Date.now() + 86400000).toISOString(),
  });
  await assert.rejects(registerParticipation(context, personal, transport), fails("slot_unavailable"));
  for (const table of ["directus_users", "user_consent", "participation_registrations"])
    assert.equal(state.tables[table]!.length, 0);
  assert.equal(state.mails.length, 0);
  state.calendarFailure = "";
  await registerParticipation(context, personal, transport);
  assert.equal(state.tables.directus_users!.length, 1);
});

test("ambiguous booking failures retain recovery evidence and are never automatically booked again", async () => {
  const { context, state, input, transport } = fixture();
  state.calendarFailure = "timeout";
  const personal = ParticipationInputSchema.parse({
    ...input,
    mode: "personal",
    start: new Date(Date.now() + 86400000).toISOString(),
  });
  await assert.rejects(registerParticipation(context, personal, transport), fails("review_required"));
  assert.equal(state.tables.participation_registrations![0]!.status, "needs_review");
  await assert.rejects(registerParticipation(context, personal, transport), fails("review_required"));
  assert.equal(state.providerRequests.length, 1);
  assert.equal(state.mails.length, 0);
});

test("account-mail retry reuses the booked appointment and original agreement evidence", async () => {
  const { context, state, input, transport } = fixture();
  state.failMail = true;
  const personal = ParticipationInputSchema.parse({
    ...input,
    mode: "personal",
    start: new Date(Date.now() + 86400000).toISOString(),
  });
  await assert.rejects(registerParticipation(context, personal, transport), fails("delivery_pending"));
  assert.equal(state.tables.participation_registrations![0]!.status, "delivery_pending");
  state.failMail = false;
  await registerParticipation(context, personal, transport);
  assert.equal(state.providerRequests.length, 1);
  assert.equal(state.tables.directus_users!.length, 1);
  assert.equal(state.tables.user_consent!.length, 2);
  assert.equal(state.mails.length, 1);
  await assert.rejects(
    registerParticipation(context, { ...personal, firstName: "Different" }, transport),
    fails("invalid_request"),
  );
});

test("public options expose only recruiting content/current agreements and availability uses fixed provider origin", async () => {
  const { context, state } = fixture();
  state.tables.participation_projects!.push({
    ...state.tables.participation_projects![0]!,
    id: randomUUID(),
    status: "closed",
  });
  const options = await participationOptions(context, {} as Accountability);
  assert.equal(options.projects.length, 1);
  assert.equal(options.agreements.length, 2);
  let url = "";
  let version = "";
  const calendar = participationCalendar({ key: "secret", eventTypeId: 123 }, async (target, init) => {
    url = String(target);
    version = (init?.headers as Record<string, string>)["cal-api-version"]!;
    return Response.json({ status: "success", data: { "2099-01-01": [{ start: "2099-01-01T10:00:00Z" }] } });
  });
  assert.equal((await calendar.slots("2099-01-01T00:00:00Z", "2099-01-02T00:00:00Z", "Europe/Berlin")).length, 1);
  assert.equal(new URL(url).origin, "https://api.cal.com");
  assert.equal(version, "2024-09-04");
  assert.ok(!url.includes("secret"));
});

test("private participation endpoint rejects anonymous, other roles and forged registration bodies before writes", async () => {
  const { context, state, input } = fixture();
  const routes = new Map<string, (req: unknown, res: unknown) => Promise<unknown>>();
  const router = {
    get(path: string, handler: unknown) {
      routes.set(path, handler as (req: unknown, res: unknown) => Promise<unknown>);
    },
    post(path: string, handler: unknown) {
      routes.set(path, handler as (req: unknown, res: unknown) => Promise<unknown>);
    },
  } as unknown as Parameters<typeof endpoint.handler>[0];
  endpoint.handler(router, context);
  const actor = randomUUID(),
    role = randomUUID();
  state.tables.directus_roles = [{ id: role, name: "Other role" }];
  for (const accountability of [undefined, { user: actor, role }]) {
    let status = 200;
    const reply = {
      setHeader() {},
      status(value: number) {
        status = value;
        return reply;
      },
      json(value: unknown) {
        return value;
      },
    };
    await routes.get("/register")!({ accountability, body: input }, reply);
    assert.equal(status, accountability ? 403 : 401);
  }
  state.tables.directus_roles[0]!.name = "Frontend-Server";
  let status = 200;
  const reply = {
    setHeader() {},
    status(value: number) {
      status = value;
      return reply;
    },
    json(value: unknown) {
      return value;
    },
  };
  await routes.get("/register")!(
    { accountability: { user: actor, role }, body: { ...input, role: "Administrator" } },
    reply,
  );
  assert.equal(status, 400);
  assert.equal(state.tables.directus_users!.length, 0);
  assert.equal(state.mails.length, 0);
});

test("a concurrent native email uniqueness rejection stays a meaningful duplicate without partial records", async () => {
  const { context, state, input, transport } = fixture();
  state.duplicateCreate = true;
  await assert.rejects(registerParticipation(context, input, transport), fails("duplicate_email"));
  assert.equal(state.tables.directus_users!.length, 0);
  assert.equal(state.tables.user_consent!.length, 0);
  assert.equal(state.tables.participation_registrations!.length, 0);
  assert.equal(state.mails.length, 0);
});

test("missing legal content keeps public interests available but blocks account creation", async () => {
  const { context, state, input, transport } = fixture();
  state.tables.agreement_versions![0]!.legal_text = null;
  const options = await participationOptions(context, {} as Accountability);
  assert.equal(options.areas.length, 1);
  assert.equal(options.projects.length, 1);
  assert.deepEqual(options.agreements, []);
  await assert.rejects(registerParticipation(context, input, transport), fails("unavailable"));
  assert.equal(state.tables.directus_users!.length, 0);
  assert.equal(state.mails.length, 0);
});

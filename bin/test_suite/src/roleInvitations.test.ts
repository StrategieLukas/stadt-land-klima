import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import type { Accountability } from "../../../src/directus/extensions/erfolgsprojekte-user-manager/node_modules/@directus/types/dist/index.js";
import {
  AdminInvitationBodySchema,
  InvitationBodySchema,
  InvitationError,
  listInvitationRoles,
  sendRoleInvitation,
  type InvitationContext,
} from "../../../src/directus/extensions/erfolgsprojekte-user-manager/src/shared/invitations.js";
import { INVITABLE_ROLES } from "../../../src/directus/extensions/erfolgsprojekte-user-manager/src/shared/roles.js";

const admin = { user: randomUUID(), admin: true } as Accountability;
const role = { ...INVITABLE_ROLES[0], id: randomUUID() };
const person = { email: "editor@example.test", first_name: "Erika", last_name: "Redaktion", action: "invite" as const };
type User = { id: string; email: string; first_name: string; last_name: string; role: string; status: string };
function fixture() {
  const state = {
    users: [] as User[],
    mails: [] as Record<string, any>[],
    inviteArguments: [] as unknown[][],
    failMail: false,
    creates: 0,
    directAdminPolicy: false,
    invalidEmail: false,
  };
  const database = Object.assign(
    (table: string) => {
      let criteria: Record<string, unknown> = {};
      const query = {
        where(value: Record<string, unknown>) {
          criteria = value;
          return query;
        },
        select() {
          return query;
        },
        join() {
          return query;
        },
        async first() {
          if (table.startsWith("directus_access")) return state.directAdminPolicy ? { id: "policy" } : undefined;
          return criteria.id === admin.user
            ? { first_name: "Admin", last_name: "Team" }
            : state.users.find((user) => user.id === criteria.id);
        },
      };
      return query;
    },
    {
      transaction: async (run: (db: unknown) => Promise<unknown>) => {
        const before = structuredClone(state.users);
        const db = Object.assign(database, { raw: async () => ({ rows: [] }) });
        try {
          return await run(db);
        } catch (error) {
          state.users = before;
          throw error;
        }
      },
    },
  );
  const context = {
    database,
    getSchema: async () => ({}),
    env: {},
    logger: { info() {}, warn() {}, error() {} },
    services: {
      UsersService: class {
        async getUserByEmail(email: string) {
          const row = state.users.find((user) => user.email === email);
          return row ? { id: row.id, role: row.role, status: row.status } : undefined;
        }
        validateEmail() {
          if (state.invalidEmail) throw new Error("private invalid email input");
        }
        async createOne(data: Omit<User, "id">) {
          const user = { ...data, id: randomUUID() };
          state.users.push(user);
          state.creates++;
          return user.id;
        }
        inviteUrl(...args: unknown[]) {
          state.inviteArguments.push(args);
          return "https://cms.example.test/backend/admin/accept-invite?token=private-invite";
        }
      },
      MailService: class {
        async send(mail: Record<string, any>) {
          if (state.failMail) throw new Error("smtp-secret-response");
          state.mails.push(mail);
        }
      },
    },
  } as unknown as InvitationContext;
  return { state, context };
}

test("invitation payloads normalize email and reject arbitrary privileges, custom URLs, malformed names and header injection", () => {
  assert.equal(InvitationBodySchema.parse({ ...person, email: "  Editor@Example.test " }).email, person.email);
  for (const input of [
    { ...person, email: "a@example.test\r\nBcc:other@example.test" },
    { ...person, first_name: "x".repeat(101) },
    { ...person, token: "secret" },
    { ...person, status: "active" },
    { ...person, url: "https://evil.example" },
  ])
    assert.equal(InvitationBodySchema.safeParse(input).success, false);
  assert.equal(AdminInvitationBodySchema.safeParse({ ...person, role: role.id }).success, true);
  assert.equal(AdminInvitationBodySchema.safeParse({ ...person, role: "Administrator" }).success, false);
});

test("eligible roles exclude service/localteam roles and administrator policies inherited through parent roles", async () => {
  const parent = randomUUID();
  const roles = INVITABLE_ROLES.map((entry) => ({
    id: randomUUID(),
    name: entry.name,
    parent: null as string | null,
    policies: [{ policy: { admin_access: false } }],
  }));
  roles[1]!.parent = parent;
  roles[2]!.policies[0]!.policy.admin_access = true;
  const context = {
    getSchema: async () => ({}),
    services: {
      RolesService: class {
        async readByQuery() {
          return [
            ...roles,
            { id: parent, name: "Admin", parent: null, policies: [{ policy: { admin_access: true } }] },
            { id: randomUUID(), name: "Frontend-Server", parent: null, policies: [] },
            { id: randomUUID(), name: "LokalteamMitglied", parent: null, policies: [] },
          ];
        }
      },
    },
  } as unknown as InvitationContext;
  const allowed = await listInvitationRoles(context, admin);
  assert.ok(allowed.some((entry) => entry.name === "ErfolgsprojekteRedaktion"));
  assert.ok(
    !allowed.some((entry) =>
      ["Maßnahmenteam", "Planungsteam", "Frontend-Server", "LokalteamMitglied", "Admin"].includes(entry.name),
    ),
  );
});

test("a new invitation persists only an invited user and uses the native URL's null second argument", async () => {
  const { context, state } = fixture();
  const result = await sendRoleInvitation(context, admin, role, person);
  assert.equal(result.mailSent, true);
  assert.equal(result.user.status, "invited");
  assert.equal(state.users[0]?.role, role.id);
  assert.deepEqual(state.inviteArguments, [[person.email, null]]);
  assert.equal(state.mails[0]?.template.name, "email-template-role-invite");
  assert.equal(state.mails[0]?.template.data.roleLabel, role.label);
  assert.match(state.mails[0]?.subject, /Erfolgsprojekte-Redaktion/);
  assert.ok(!JSON.stringify(result).includes("private-invite"));
});

test("SMTP failures roll back new users, propagate failure and allow a clean retry", async () => {
  const { context, state } = fixture();
  state.failMail = true;
  await assert.rejects(sendRoleInvitation(context, admin, role, person));
  assert.equal(state.users.length, 0);
  state.failMail = false;
  assert.equal((await sendRoleInvitation(context, admin, role, person)).mailSent, true);
});

test("resending requires explicit intent, an invited account and the identical role without modifying the user", async () => {
  const { context, state } = fixture();
  await sendRoleInvitation(context, admin, role, person);
  await assert.rejects(
    sendRoleInvitation(context, admin, role, person),
    (error: unknown) => error instanceof InvitationError && error.status === 409,
  );
  const before = structuredClone(state.users);
  const result = await sendRoleInvitation(context, admin, role, { email: person.email, action: "resend" });
  assert.equal(result.resent, true);
  assert.equal(state.creates, 1);
  assert.deepEqual(state.users, before);
  for (const status of ["active", "suspended", "archived", "unverified"]) {
    state.users[0]!.status = status;
    await assert.rejects(
      sendRoleInvitation(context, admin, role, { email: person.email, action: "resend" }),
      (error: unknown) => error instanceof InvitationError && error.status === 409,
    );
  }
  state.users[0]!.status = "invited";
  state.users[0]!.role = randomUUID();
  await assert.rejects(sendRoleInvitation(context, admin, role, { email: person.email, action: "resend" }));
  assert.equal(state.mails.length, 2);
});

test("missing names and resending an unknown account perform no user creation", async () => {
  const { context, state } = fixture();
  for (const action of ["invite", "resend"] as const)
    await assert.rejects(sendRoleInvitation(context, admin, role, { email: person.email, action }));
  assert.equal(state.creates, 0);
});

test("the separate admin endpoint rejects anonymous and non-admin callers before database or mail operations", async () => {
  const file = new URL(
    "../../../src/directus/extensions/erfolgsprojekte-user-manager/src/admin-endpoint/index.ts",
    import.meta.url,
  );
  const require = createRequire(file);
  const module = { exports: {} as { default: { handler(router: unknown, context: unknown): void } } };
  runInNewContext(
    ts.transpileModule(readFileSync(file, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    { module, exports: module.exports, require },
  );
  type Handler = (req: unknown, res: unknown) => Promise<unknown>;
  const routes: Handler[] = [];
  module.exports.default.handler(
    {
      get: (_: string, handler: Handler) => routes.push(handler),
      post: (_: string, handler: Handler) => routes.push(handler),
    },
    {},
  );
  for (const handler of routes)
    for (const actor of [undefined, { user: randomUUID(), admin: false }, { admin: true }]) {
      let status = 0;
      const res = {
        setHeader() {},
        status(value: number) {
          status = value;
          return this;
        },
        json() {},
      };
      await handler({ accountability: actor, body: person }, res);
      assert.equal(status, actor?.user ? 403 : 401);
    }
});

test("the module registers only for effective Directus administrators", () => {
  const file = new URL(
    "../../../src/directus/extensions/erfolgsprojekte-user-manager/src/module/index.ts",
    import.meta.url,
  );
  const module = { exports: {} as { default: { preRegisterCheck(user: unknown): boolean } } };
  runInNewContext(
    ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText,
    {
      module,
      exports: module.exports,
      require: (id: string) => (id === "@directus/extensions-sdk" ? { defineModule: (config: unknown) => config } : {}),
    },
  );
  assert.equal(module.exports.default.preRegisterCheck({ admin_access: true }), true);
  for (const user of [{ admin_access: false }, { role: { admin_access: true } }, {}])
    assert.equal(module.exports.default.preRegisterCheck(user), false);
});

test("native email validation and direct administrator policy assignments fail closed", async () => {
  const { context, state } = fixture();
  state.invalidEmail = true;
  await assert.rejects(
    sendRoleInvitation(context, admin, role, person),
    (error: unknown) => error instanceof InvitationError && error.status === 400,
  );
  state.invalidEmail = false;
  await sendRoleInvitation(context, admin, role, person);
  state.directAdminPolicy = true;
  await assert.rejects(
    sendRoleInvitation(context, admin, role, { email: person.email, action: "resend" }),
    (error: unknown) => error instanceof InvitationError && error.status === 409,
  );
  assert.equal(state.mails.length, 1);
});

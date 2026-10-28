import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { createAdminClient, DirectusClient } from "./lib/directus.js";
import { parseEnvFile } from "./lib/config.js";
import { waitFor } from "./lib/wait.js";
import { launchBrowser, loginDirectus } from "./lib/browser.js";

/** Opt-in: reserved example.org recipients and a local Mailpit capture server; never sends external mail. */
const base = new URL(process.argv[2] ?? "http://localhost:8084").origin;
const mailpit = new URL(process.argv[3] ?? "http://localhost:18025").origin;
const env = parseEnvFile(process.argv[4] ?? "../../src/directus/.env");
assert.ok(
  [base, mailpit].every((url) => ["localhost", "127.0.0.1"].includes(new URL(url).hostname)),
  "Live invitation tests require local CMS and mail capture origins",
);
await waitFor(
  "local invitation CMS",
  async () => (await fetch(`${base}/server/health`, { signal: AbortSignal.timeout(2000) })).ok,
);
const admin = await createAdminClient(base, env);
const suffix = randomBytes(6).toString("hex");
const prefix = `invite-${suffix}-`;
const password = `Aa1!${randomBytes(24).toString("base64url")}`;
type Role = { id: string; name: string; label: string };
type User = { id: string; email: string; role: string; status: string; first_name: string };
type Result = { user: User; mailSent: boolean; resent: boolean };
const roles = (await admin.request<{ roles: Role[] }>("GET", "/role-invitations/roles")).roles;
const editor = roles.find((role) => role.name === "ErfolgsprojekteRedaktion")!;
const recruiter = roles.find((role) => role.name === "Recruiter")!;
const planning = roles.find((role) => role.name === "Planungsteam")!;
assert.ok(editor && recruiter && planning);
const me = await admin.request<{ role: { id: string } }>("GET", "/users/me", { query: { fields: "role.id" } });
const actorIds: string[] = [];
async function actor(name: string, roleId: string) {
  const email = `${prefix}${name}@example.org`;
  const user = await admin.createUser<User>({
    email,
    password,
    first_name: "Test",
    last_name: name,
    language: "de-DE",
    role: roleId,
    status: "active",
  });
  actorIds.push(user.id);
  const client = new DirectusClient(base);
  await client.login(email, password);
  return { client, email };
}
async function expectStatus(client: DirectusClient, method: string, path: string, status: number, body?: unknown) {
  let accepted = false;
  try {
    await client.request(method, path, { body });
    accepted = true;
  } catch (error) {
    assert.ok(
      error instanceof Error && error.message.includes(`failed with ${status}:`),
      `Expected HTTP ${status} from ${method} ${path}`,
    );
  }
  assert.equal(accepted, false, `Expected rejection from ${path}`);
}
async function captured(email: string) {
  const messages = (await (await fetch(`${mailpit}/api/v1/messages`)).json()) as {
    messages: { ID: string; To: { Address: string }[] }[];
  };
  const message = messages.messages.find((item) => item.To.some((recipient) => recipient.Address === email));
  assert.ok(message, "Invitation must reach local mail capture");
  return (await (await fetch(`${mailpit}/api/v1/message/${message.ID}`)).json()) as { HTML: string; Subject: string };
}
const browser = await launchBrowser(true);
try {
  const operator = await actor("operator", me.role.id);
  const second = await actor("second", me.role.id);
  const planner = await actor("planner", planning.id);
  const anon = new DirectusClient(base);
  for (const client of [anon, planner.client]) {
    await expectStatus(client, "GET", "/role-invitations/roles", client === anon ? 401 : 403);
    await expectStatus(client, "POST", "/role-invitations/invite", client === anon ? 401 : 403, {
      email: `${prefix}forbidden@example.org`,
      role: editor.id,
      first_name: "Test",
      last_name: "Person",
    });
  }
  console.log("PASS anonymous/planning-team denial of admin-only role invitations");

  const page = await browser.newPage({ locale: "de-DE" });
  await loginDirectus(page, base, operator.email, password);
  await page.goto(`${base}/admin/role-invitations`);
  await page.getByRole("heading", { name: "Person für eine Rolle einladen" }).waitFor();
  assert.ok(
    await page.locator('a[href="/admin/role-invitations"]').count(),
    "Administrators must see the module in the configured sidebar",
  );
  const email = `${prefix}editor@example.org`;
  await page.locator(".invite-form .v-select").first().click();
  await page.locator(".v-menu-content .v-list-item").filter({ hasText: "Erfolgsprojekte-Redaktion" }).click();
  assert.equal(await page.getByPlaceholder("Rolle auswählen").inputValue(), "Erfolgsprojekte-Redaktion");
  await page.getByPlaceholder("name@beispiel.de").fill(email);
  await page.locator('input[autocomplete="given-name"]').fill("<b>Erika</b>");
  await page.locator('input[autocomplete="family-name"]').fill("Redaktion");
  const submit = page.getByRole("button", { name: /Einladung senden/ });
  assert.equal(
    await submit.isEnabled(),
    true,
    `Invitation form must be ready: ${await page.locator(".invite-form").innerText()}`,
  );
  const [sent] = await Promise.all([
    page.waitForResponse(
      (response) => response.url().endsWith("/role-invitations/invite") && response.request().method() === "POST",
    ),
    submit.click(),
  ]);
  assert.equal(sent.status(), 201);
  await page.getByText(`Die Einladung für Erfolgsprojekte-Redaktion wurde an ${email} versendet.`).waitFor();
  const mail = await captured(email);
  assert.ok(mail.Subject.includes("Erfolgsprojekte-Redaktion"));
  assert.ok(mail.HTML.includes("&lt;b&gt;Erika&lt;/b&gt;"), "Names must be escaped in HTML mail");
  assert.ok(mail.HTML.includes("kommunale Klimaschutzprojekte"), "Mail must describe the assigned role");
  const link = mail.HTML.match(/href="([^"]*accept-invite[^\"]*)"/)?.[1]?.replaceAll("&amp;", "&");
  assert.ok(link, "Mail must contain a native acceptance link");
  const invitation = new URL(link);
  assert.ok(
    invitation.origin === base && invitation.pathname === "/admin/accept-invite",
    "Native invitation URL must point to the CMS acceptance screen",
  );
  const token = invitation.searchParams.get("token");
  assert.ok(token);
  const claims = JSON.parse(Buffer.from(token.split(".")[1]!, "base64url").toString()) as {
    scope: string;
    exp: number;
    iat: number;
  };
  assert.ok(claims.scope === "invite" && claims.exp > claims.iat, "Native token must have invitation scope and expiry");
  assert.equal((await fetch(link)).status, 200);
  console.log("PASS admin module, escaped role-specific captured email and native acceptance URL");

  const body = { email, role: editor.id, first_name: "Other", last_name: "Name" };
  await expectStatus(operator.client, "POST", "/role-invitations/invite", 409, body);
  const resent = await operator.client.request<Result>("POST", "/role-invitations/invite", {
    body: { email, role: editor.id, action: "resend" },
  });
  assert.equal(resent.resent, true);
  const pending = await admin.readUsers<User>({
    filter: { email: { _eq: email } },
    fields: ["id", "email", "first_name", "status", "role"],
  });
  assert.equal(pending[0]?.first_name, "<b>Erika</b>");
  await expectStatus(operator.client, "POST", "/role-invitations/invite", 409, {
    ...body,
    role: recruiter.id,
    action: "resend",
  });
  await expectStatus(operator.client, "POST", "/role-invitations/invite", 400, { ...body, role: me.role.id });
  await expectStatus(operator.client, "POST", "/role-invitations/invite", 429, {
    ...body,
    email: `${prefix}limited@example.org`,
  });
  assert.equal((await admin.readUsers<User>({ filter: { email: { _eq: `${prefix}limited@example.org` } } })).length, 0);
  console.log("PASS duplicate and role-change refusal, explicit resend and persistent five-per-minute limit");

  await anon.request("POST", "/users/invite/accept", { body: { token, password } });
  await expectStatus(anon, "POST", "/users/invite/accept", 400, { token, password });
  const active = (
    await admin.readUsers<User>({ filter: { email: { _eq: email } }, fields: ["id", "status", "role"] })
  )[0]!;
  assert.equal(active.status, "active");
  assert.equal(active.role, editor.id);
  await expectStatus(second.client, "POST", "/role-invitations/invite", 409, {
    email,
    role: editor.id,
    action: "resend",
  });
  const personal = new DirectusClient(base);
  await personal.login(email, password);
  await expectStatus(personal, "GET", "/role-invitations/roles", 403);
  console.log("PASS native password acceptance, one-time use, retained role and editor admin denial");

  const otherEmail = `${prefix}recruiter@example.org`;
  const invitations = await Promise.allSettled(
    Array.from({ length: 2 }, () =>
      second.client.request<Result>("POST", "/role-invitations/invite", {
        body: { email: otherEmail, role: recruiter.id, first_name: "Alex", last_name: "Recruiting" },
      }),
    ),
  );
  assert.equal(invitations.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal((await admin.readUsers<User>({ filter: { email: { _eq: otherEmail } } })).length, 1);
  const recruitingMail = await captured(otherEmail);
  assert.ok(
    recruitingMail.Subject.includes("Recruiting") && recruitingMail.HTML.includes("Stellenangebote und Bewerbungen"),
  );
  console.log("PASS concurrent duplicate serialization and a second role's fitting invitation email");

  const legacyEmail = `${prefix}legacy@example.org`;
  const legacy = await planner.client.request<Result>("POST", "/erfolgsprojekte-users/invite", {
    body: { email: legacyEmail, first_name: "Erika", last_name: "Redaktion" },
  });
  assert.equal(legacy.user.role, "ErfolgsprojekteRedaktion");
  const legacyMail = await captured(legacyEmail);
  assert.equal(legacyMail.Subject, "Einladung zur Erfolgsprojekte-Redaktion");
  assert.ok(legacyMail.HTML.includes("/admin/accept-invite?token="));
  await expectStatus(planner.client, "POST", "/erfolgsprojekte-users/invite", 400, {
    email: legacyEmail,
    role: recruiter.id,
    action: "resend",
  });
  const restrictedPage = await browser.newPage({ locale: "de-DE" });
  await loginDirectus(restrictedPage, base, planner.email, password);
  assert.equal(await restrictedPage.locator('a[href="/admin/role-invitations"]').count(), 0);
  console.log("PASS preserved planning-team editorial invitations and hidden admin module");
  if (process.argv[5]) {
    const failureOrigin = new URL(process.argv[5]).origin;
    assert.ok(["localhost", "127.0.0.1"].includes(new URL(failureOrigin).hostname));
    await waitFor(
      "local SMTP failure test CMS",
      async () => (await fetch(`${failureOrigin}/server/ping`, { signal: AbortSignal.timeout(2000) })).ok,
    );
    const failing = new DirectusClient(failureOrigin, env.CLI_DIRECTUS_STATIC_TOKEN || env.DIRECTUS_ADMIN_TOKEN);
    const failedEmail = `${prefix}smtp-failure@example.org`;
    await expectStatus(failing, "POST", "/role-invitations/invite", 503, {
      email: failedEmail,
      role: editor.id,
      first_name: "Failed",
      last_name: "Mail",
    });
    assert.equal((await admin.readUsers<User>({ filter: { email: { _eq: failedEmail } } })).length, 0);
    console.log("PASS actual SMTP connection failure rolls back native user creation");
  }
} finally {
  await browser.close();
  const users = await admin.readUsers<User>({ filter: { email: { _starts_with: prefix } }, fields: ["id"], limit: -1 });
  for (const user of users) await admin.deleteUser(user.id);
  for (const actorId of actorIds) {
    const entries = await admin.readItems<{ id: string }>("role_invitation_requests", {
      filter: { subject: { _ends_with: actorId } },
      fields: ["id"],
      limit: -1,
    });
    for (const entry of entries) await admin.request("DELETE", `/items/role_invitation_requests/${entry.id}`);
  }
}

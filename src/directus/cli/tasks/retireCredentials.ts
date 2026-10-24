/** Explicit operator-only credential retirement. Planning never writes to Directus. */
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { parse } from "yaml";

const Scope = z.strictObject({ legacyFrontend: z.boolean(), candidates: z.boolean(), previews: z.boolean() });
export type RetirementScope = z.output<typeof Scope>;
const RotationPolicy = z.strictObject({
  version: z.literal(1),
  credentials: z.record(
    z.string(),
    z.strictObject({
      action: z.enum(["review", "retain", "rotate", "revoke"]),
      sensitivity: z.enum(["critical", "high", "medium", "low", "public"]),
      references: z.array(z.string()),
      rotation_interval_days: z.number().int().positive().nullable(),
      owner: z.string().nullable(),
      last_rotated_on: z.iso.date().nullable(),
      next_review_on: z.iso.date().nullable(),
      notes: z.string(),
    }),
  ),
});
/** Only these three credential families are handled by the retirement tool. Other entries are operator policy. */
export function retirementScopeFromPolicy(input: unknown): RetirementScope {
  const policy = RotationPolicy.parse(input);
  const managed = [
    ["legacy_frontend", "revoke"],
    ["candidate_links", "rotate"],
    ["municipality_previews", "rotate"],
  ] as const;
  const actions = managed.map(([name, supported]) => {
    const entry = policy.credentials[name];
    if (!entry) throw Error(`Missing credential policy: ${name}`);
    if (!["review", "retain", supported].includes(entry.action))
      throw Error(`Unsupported retirement action for ${name}`);
    return entry.action === supported;
  });
  return { legacyFrontend: actions[0]!, candidates: actions[1]!, previews: actions[2]! };
}
export function readRetirementScope(file: string): RetirementScope {
  return retirementScopeFromPolicy(parse(readFileSync(file, "utf8")) as unknown);
}

const Id = z.union([z.string().min(1), z.number().int()]);
const Credential = z
  .object({
    id: Id,
    collection: z.enum(["candidate", "municipalities", "users"]),
    field: z.enum(["access_token", "preview_token", "token"]),
    previousHash: z.string().regex(/^[a-f0-9]{64}$/),
    replacement: z.string().nullable(),
    role: z.string().nullable(),
    status: z.string().nullable(),
    slug: z.string().nullable(),
  })
  .refine(
    (row) =>
      row.collection === "candidate"
        ? row.field === "access_token" && z.uuid().safeParse(row.replacement).success
        : row.collection === "municipalities"
          ? row.field === "preview_token" && /^[a-f0-9]{64}$/.test(row.replacement || "")
          : row.field === "token" && row.replacement === null,
    "Invalid replacement credential for collection",
  );
const Plan = z.strictObject({
  version: z.literal(2),
  scope: Scope,
  directusUrl: z.url(),
  websiteOrigin: z.url(),
  credentials: z.array(Credential),
});
export type RetirementPlan = z.output<typeof Plan>;
export type RetirementRequest = (path: string, method?: string, body?: unknown) => Promise<unknown>;
const hash = (value: unknown) =>
  createHash("sha256")
    .update(JSON.stringify(value ?? null))
    .digest("hex");
const Rows = z.object({ data: z.array(z.record(z.string(), z.unknown())) });
async function all(request: RetirementRequest, path: string): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  for (let offset = 0; ; offset += 100) {
    const page = Rows.parse(await request(path + `&limit=100&offset=${offset}`)).data;
    rows.push(...page);
    if (page.length < 100) return rows;
    if (offset >= 100000) throw Error("Retirement inventory exceeds safety limit");
  }
}
async function inventory(request: RetirementRequest, scope: RetirementScope) {
  const records: z.output<typeof Credential>[] = [];
  for (const [enabled, collection, field] of [
    [scope.candidates, "candidate", "access_token"],
    [scope.previews, "municipalities", "preview_token"],
  ] as const) {
    if (!enabled) continue;
    const rows = await all(
      request,
      `/items/${collection}?fields=id,${field}${collection === "municipalities" ? ",slug" : ""}`,
    );
    for (const row of rows)
      if (typeof row[field] === "string" && row[field])
        records.push({
          id: Id.parse(row.id),
          collection,
          field,
          previousHash: hash(row[field]),
          replacement: collection === "candidate" ? randomUUID() : randomBytes(32).toString("hex"),
          role: null,
          status: null,
          slug: typeof row.slug === "string" ? row.slug : null,
        });
  }
  if (scope.legacyFrontend) {
    const roles = await all(request, "/roles?fields=id,name");
    const legacy = roles.filter((role) => typeof role.name === "string" && /^frontend$/i.test(role.name));
    if (legacy.length !== 1) throw Error("Legacy Frontend role must resolve uniquely");
    const role = z.string().parse(legacy[0]?.id);
    const users = await all(
      request,
      "/users?fields=id,role,status,token&filter=" + encodeURIComponent(JSON.stringify({ role: { _eq: role } })),
    );
    for (const row of users) {
      if (row.role !== role) throw Error("Retirement user is outside legacy role");
      records.push({
        id: Id.parse(row.id),
        collection: "users",
        field: "token",
        previousHash: hash(row.token),
        replacement: null,
        role,
        status: z.string().parse(row.status),
        slug: null,
      });
    }
  }
  return records.sort((a, b) => `${a.collection}:${a.id}`.localeCompare(`${b.collection}:${b.id}`));
}
export async function planRetirement(
  request: RetirementRequest,
  directusUrl: string,
  websiteOrigin: string,
  selection: RetirementScope,
): Promise<RetirementPlan> {
  const website = new URL(websiteOrigin);
  if (!["http:", "https:"].includes(website.protocol) || website.username || website.password)
    throw Error("Invalid website origin");
  return Plan.parse({
    version: 2,
    scope: Scope.parse(selection),
    directusUrl: new URL(directusUrl).href,
    websiteOrigin: website.origin,
    credentials: await inventory(request, Scope.parse(selection)),
  });
}
export async function applyRetirement(
  request: RetirementRequest,
  input: unknown,
  directusUrl: string,
  websiteOrigin: string,
  selection: RetirementScope,
) {
  if (input && typeof input === "object" && "version" in input && input.version === 1)
    throw Error("Legacy retirement plans are not policy-bound; generate a new version 2 plan");
  const plan = Plan.parse(input);
  if (JSON.stringify(plan.scope) !== JSON.stringify(Scope.parse(selection)))
    throw Error("Retirement policy changed since planning; generate a new plan");
  if (new URL(directusUrl).href !== plan.directusUrl) throw Error("Plan belongs to a different Directus instance");
  if (new URL(websiteOrigin).origin !== plan.websiteOrigin) throw Error("Plan belongs to a different website");
  const current = await inventory(request, plan.scope);
  if (current.length !== plan.credentials.length) throw Error("Credential inventory changed; generate a new plan");
  const pending: z.output<typeof Credential>[] = [];
  // Validate EVERY record before writing anything. Replays resume completed rows.
  for (const [index, planned] of plan.credentials.entries()) {
    const actual = current[index];
    if (
      !actual ||
      actual.id !== planned.id ||
      actual.collection !== planned.collection ||
      actual.field !== planned.field ||
      actual.role !== planned.role ||
      actual.slug !== planned.slug
    )
      throw Error("Credential scope changed");
    const done =
      planned.collection === "users"
        ? actual.previousHash === hash(null) && actual.status === "suspended"
        : actual.previousHash === hash(planned.replacement);
    if (done) continue;
    if (actual.previousHash !== planned.previousHash || actual.status !== planned.status)
      throw Error("Credential changed since planning");
    if (planned.collection !== "users" && !planned.replacement) throw Error("Missing replacement credential");
    pending.push(planned);
  }
  for (const credential of pending) {
    const path = credential.collection === "users" ? "/users/" : `/items/${credential.collection}/`;
    // Update only the one credential (and legacy account status), never YAML config.
    await request(
      path + encodeURIComponent(String(credential.id)),
      "PATCH",
      credential.collection === "users"
        ? { token: null, status: "suspended" }
        : { [credential.field]: credential.replacement },
    );
  }
  if (plan.credentials.length) await request("/utils/cache/clear", "POST");
  return { updated: pending.length, alreadyApplied: plan.credentials.length - pending.length };
}
export function replacementLinks(input: unknown) {
  const plan = Plan.parse(input);
  return plan.credentials
    .filter((row) => row.collection !== "users")
    .map((row) => ({
      id: row.id,
      collection: row.collection,
      url:
        row.collection === "candidate"
          ? `${plan.websiteOrigin}/elections/thesen#token=${row.replacement}`
          : row.slug
            ? `${plan.websiteOrigin}/municipalities/${encodeURIComponent(row.slug)}?preview=${row.replacement}`
            : null,
    }));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [action, file, policyOption, policyFile] = process.argv.slice(2);
  if (
    !file ||
    !["plan", "apply"].includes(action ?? "") ||
    policyOption !== "--policy" ||
    !policyFile ||
    process.argv.length !== 6
  )
    throw Error(
      "Usage: retireCredentials.ts plan|apply /private/plan.json --policy /directus/cli/credential-rotation.yaml",
    );
  const scope = readRetirementScope(policyFile);
  const token = process.env.CLI_DIRECTUS_STATIC_TOKEN,
    base = process.env.DIRECTUS_URL;
  if (!token || !base) throw Error("DIRECTUS_URL and CLI_DIRECTUS_STATIC_TOKEN are required");
  const request: RetirementRequest = async (path, method = "GET", body) => {
    const response = await fetch(base.replace(/\/$/, "") + path, {
      method,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw Error(`Retirement request failed: HTTP ${response.status}`);
    return response.status === 204 ? null : response.json();
  };
  if (action === "plan") {
    const plan = await planRetirement(request, base, process.env.PUBLIC_URL || "", scope);
    writeFileSync(file, JSON.stringify(plan, null, 2) + "\n", { mode: 0o600, flag: "wx" });
    writeFileSync(file + ".links.json", JSON.stringify(replacementLinks(plan), null, 2) + "\n", {
      mode: 0o600,
      flag: "wx",
    });
    console.info(
      `Private plan created: ${plan.credentials.length} credentials. No server writes. Review before apply.`,
    );
  } else {
    if (statSync(file).mode & 0o077) throw Error("Plan permissions must be 0600");
    console.info(
      await applyRetirement(
        request,
        JSON.parse(readFileSync(file, "utf8")) as unknown,
        base,
        process.env.PUBLIC_URL || "",
        scope,
      ),
    );
  }
}

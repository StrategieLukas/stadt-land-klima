import process from "node:process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import dotenv from "dotenv";
import pg from "pg";

const { Pool } = pg;
const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: "/directus/.env", quiet: true });
dotenv.config({ path: path.resolve(currentDirectory, "../../.env"), quiet: true });
dotenv.config({ quiet: true });

type PermissionRow = {
  action: string;
  collection: string;
  fields: unknown;
  id: number;
  permissions: unknown;
  policy_name: string;
};

type EffectivePermissionRow = PermissionRow & {
  accessor_name: string;
};

const TRUE_VALUES = new Set(["1", "true", "yes"]);
const securityChecksEnabled = TRUE_VALUES.has((process.env.SLK_STARTUP_SECURITY_CHECKS ?? "").trim().toLowerCase());
const skipEnvironmentChecks = process.argv.includes("--skip-env");
const skipDatabaseChecks = process.argv.includes("--skip-db");

const defaultValuePatterns: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /^some-random-key$/i, reason: "uses the example random key" },
  { pattern: /^directus$/i, reason: "uses the Directus example password" },
  { pattern: /^secret$/i, reason: "uses the example secret" },
  { pattern: /^password$/i, reason: "uses a placeholder password" },
  { pattern: /^change-me/i, reason: "uses a change-me placeholder" },
  { pattern: /^replace-with-/i, reason: "uses a replace-with placeholder" },
  { pattern: /^access_token_of_admin_user$/i, reason: "uses the example static token" },
  { pattern: /^your-.+-here$/i, reason: "uses an example API key placeholder" },
  { pattern: /check-my-dms/i, reason: "uses a local placeholder secret note" },
];

const envChecks: Array<{ name: string; required: boolean }> = [
  { name: "SECRET", required: true },
  { name: "DB_PASSWORD", required: true },
  { name: "CLI_DIRECTUS_STATIC_TOKEN", required: false },
  { name: "MEILI_MASTER_KEY", required: false },
  { name: "EMAIL_SMTP_PASSWORD", required: false },
  { name: "UNSPLASH_ACCESS_KEY", required: false },
  { name: "DIRECTUS_MAPBOX_KEY", required: false },
  { name: "DIRECTUS_AI_OPENAI_API_KEY", required: false },
  { name: "DIRECTUS_AI_ANTHROPIC_API_KEY", required: false },
  { name: "DIRECTUS_AI_GOOGLE_API_KEY", required: false },
  { name: "DIRECTUS_AI_OPENAI_COMPATIBLE_API_KEY", required: false },
];

const publicFileFields = new Set([
  "$thumbnail",
  "charset",
  "created_on",
  "description",
  "duration",
  "filename_download",
  "filesize",
  "folder",
  "height",
  "id",
  "metadata",
  "modified_on",
  "storage_divider",
  "tags",
  "title",
  "type",
  "uploaded_on",
  "width",
]);

const publicUserReadFields = new Set([
  "avatar",
  "description",
  "email",
  "first_name",
  "id",
  "language",
  "last_name",
  "last_page",
  "location",
  "show_on_team_page",
  "tags",
  "theme",
  "title",
]);

const publicUserUpdateFields = new Set([
  "avatar",
  "description",
  "email",
  "first_name",
  "language",
  "last_name",
  "last_page",
  "location",
  "tags",
  "theme",
  "title",
]);

const publicFileFilter = {
  _and: [
    {
      folder: {
        name: {
          _eq: "public",
        },
      },
    },
  ],
};

const publicFolderFilter = {
  _and: [
    {
      name: {
        _eq: "public",
      },
    },
  ],
};

const sensitiveCollections = [
  "answers",
  "candidate",
  "directus_access",
  "directus_dashboards",
  "directus_flows",
  "directus_panels",
  "directus_permissions",
  "directus_policies",
  "directus_roles",
  "directus_sessions",
  "directus_shares",
  "directus_users",
  "editors",
  "elections",
  "feedback",
  "localteams",
  "questions",
  "user_consent",
];

const sensitiveAccessWhitelist: Record<string, string[]> = {
  "answers:create": ["Frontend", "Frontend-Server"],
  "answers:delete": ["Frontend", "Frontend-Server"],
  "answers:read": ["Frontend", "Frontend-Server", "LokalteamMitglied", "Planungsteam", "WahlcheckAdmin"],
  "answers:update": ["Frontend", "Frontend-Server"],
  "candidate:create": ["LokalteamMitglied", "WahlcheckAdmin"],
  "candidate:delete": ["LokalteamMitglied", "WahlcheckAdmin"],
  "candidate:read": ["Frontend", "Frontend-Server", "LokalteamMitglied", "Planungsteam", "WahlcheckAdmin"],
  "candidate:update": ["Frontend", "Frontend-Server", "LokalteamMitglied", "WahlcheckAdmin"],
  "directus_dashboards:create": ["Planungsteam"],
  "directus_dashboards:delete": ["Planungsteam"],
  "directus_dashboards:read": ["Maßnahmenteam", "Massnahmenteam", "Planungsteam"],
  "directus_dashboards:update": ["Planungsteam"],
  "directus_flows:read": ["Planungsteam"],
  "directus_panels:create": ["Planungsteam"],
  "directus_panels:delete": ["Planungsteam"],
  "directus_panels:read": ["Planungsteam"],
  "directus_panels:update": ["Planungsteam"],
  "directus_roles:read": ["Planungsteam", "ErfolgsprojekteRedaktion"],
  "directus_shares:read": ["Planungsteam"],
  "directus_users:read": [
    "Frontend",
    "Frontend-Server",
    "LokalteamMitglied",
    "Maßnahmenteam",
    "Massnahmenteam",
    "MinimalUser",
    "Planungsteam",
  ],
  "directus_users:update": ["LokalteamMitglied", "Maßnahmenteam", "Massnahmenteam", "MinimalUser"],
  "editors:create": ["LokalteamAdmin", "LokalteamMitglied"],
  "editors:read": ["LokalteamMitglied", "Planungsteam"],
  "editors:update": ["LokalteamAdmin", "LokalteamMitglied"],
  "elections:create": ["LokalteamMitglied", "WahlcheckAdmin"],
  "elections:delete": ["LokalteamMitglied"],
  "elections:read": ["Frontend", "Frontend-Server", "LokalteamMitglied", "Planungsteam", "WahlcheckAdmin"],
  "elections:update": ["LokalteamMitglied", "WahlcheckAdmin", "Frontend-Server"],
  "feedback:create": ["Frontend", "Frontend-Server"],
  "feedback:read": ["Planungsteam"],
  "feedback:update": ["Planungsteam"],
  "localteams:read": [
    "Frontend",
    "Frontend-Server",
    "LokalteamMitglied",
    "Maßnahmenteam",
    "Massnahmenteam",
    "Planungsteam",
    "WahlcheckAdmin",
  ],
  "localteams:update": ["LokalteamMitglied"],
  "questions:create": ["LokalteamMitglied", "WahlcheckAdmin"],
  "questions:delete": ["LokalteamMitglied", "WahlcheckAdmin"],
  "questions:read": ["Frontend", "Frontend-Server", "LokalteamMitglied", "Planungsteam", "WahlcheckAdmin"],
  "questions:update": ["LokalteamMitglied", "WahlcheckAdmin"],
  "user_consent:create": ["LokalteamMitglied", "Maßnahmenteam", "Massnahmenteam", "MinimalUser", "WahlcheckAdmin"],
  "user_consent:read": [
    "LokalteamMitglied",
    "Maßnahmenteam",
    "Massnahmenteam",
    "MinimalUser",
    "Planungsteam",
    "WahlcheckAdmin",
  ],
};

function cleanEnvValue(value: string): string {
  return value.trim().replace(/^['"]|['"]$/g, "");
}

export function checkEnvironment(env: NodeJS.ProcessEnv, failures: string[]): Set<string> {
  const missingRequiredKeys = new Set<string>();

  for (const check of envChecks) {
    const rawValue = env[check.name];
    const value = rawValue === undefined ? "" : cleanEnvValue(rawValue);

    if (!value) {
      if (check.required) {
        failures.push(`${check.name} is missing; configure it before enabling startup checks`);
        missingRequiredKeys.add(check.name);
      }
      continue;
    }

    if (check.name === "SECRET" && value.length < 32) failures.push(`${check.name} must have at least 32 characters`);
    const defaultMatch = defaultValuePatterns.find(({ pattern }) => pattern.test(value));
    if (defaultMatch) {
      failures.push(`${check.name} ${defaultMatch.reason}`);
    }
  }

  return missingRequiredKeys;
}

function normalizeDatabaseValue(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (!trimmed.startsWith("{") && !trimmed.startsWith("[") && !trimmed.startsWith('"')) {
    return value;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortJson);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, nestedValue]) => [key, sortJson(nestedValue)]),
    );
  }

  return value;
}

function jsonEquals(left: unknown, right: unknown): boolean {
  return JSON.stringify(sortJson(normalizeDatabaseValue(left))) === JSON.stringify(sortJson(right));
}

function fieldsToArray(value: unknown): string[] {
  const normalized = normalizeDatabaseValue(value);

  if (Array.isArray(normalized)) {
    return normalized.map(String);
  }

  if (typeof normalized === "string") {
    return normalized
      .split(",")
      .map((field) => field.trim())
      .filter(Boolean);
  }

  return [];
}

function fieldsAreSubset(value: unknown, allowedFields: Set<string>, allowWildcard = false): boolean {
  const fields = fieldsToArray(value);

  if (fields.length === 0) {
    return true;
  }

  return fields.every((field) => {
    if (field === "*") {
      return allowWildcard;
    }

    return allowedFields.has(field);
  });
}

function containsCurrentUserFilter(value: unknown): boolean {
  const normalized = normalizeDatabaseValue(value);

  if (typeof normalized === "string") {
    return normalized.includes("$CURRENT_USER");
  }

  if (Array.isArray(normalized)) {
    return normalized.some(containsCurrentUserFilter);
  }

  if (normalized && typeof normalized === "object") {
    return Object.values(normalized as Record<string, unknown>).some(containsCurrentUserFilter);
  }

  return false;
}

export function isAllowedPublicPermission(row: PermissionRow): boolean {
  if (row.collection === "directus_files" && row.action === "read") {
    return jsonEquals(row.permissions, publicFileFilter) && fieldsAreSubset(row.fields, publicFileFields);
  }

  if (row.collection === "directus_folders" && row.action === "read") {
    return jsonEquals(row.permissions, publicFolderFilter) && fieldsAreSubset(row.fields, new Set(), true);
  }

  if (row.collection === "directus_users" && row.action === "read") {
    return containsCurrentUserFilter(row.permissions) && fieldsAreSubset(row.fields, publicUserReadFields);
  }

  if (row.collection === "directus_users" && row.action === "update") {
    return containsCurrentUserFilter(row.permissions) && fieldsAreSubset(row.fields, publicUserUpdateFields);
  }

  return false;
}

export function isAllowedSensitiveAccessor(collection: string, action: string, accessor: string): boolean {
  return (sensitiveAccessWhitelist[`${collection}:${action}`] ?? []).includes(accessor);
}

type DatabaseRoleState = {
  rolsuper: boolean;
  rolcreaterole: boolean;
  rolcreatedb: boolean;
  rolreplication: boolean;
  rolbypassrls: boolean;
  privileged_memberships?: string[];
};

export function databaseRoleFailures(role: DatabaseRoleState): string[] {
  const flags = ["rolsuper", "rolcreaterole", "rolcreatedb", "rolreplication", "rolbypassrls"] as const;
  return [
    ...flags.filter((flag) => role[flag]).map((flag) => `Database application role has forbidden privilege: ${flag}`),
    ...(role.privileged_memberships ?? []).map(
      (name) => `Database application role belongs to privileged role: ${name}`,
    ),
  ];
}

/** Role attributes alone miss file/program access and privileges gained through nested groups. */
export async function checkDatabaseRole(
  pool: Pick<InstanceType<typeof Pool>, "query">,
  failures: string[],
): Promise<void> {
  const result = await pool.query<DatabaseRoleState>(
    `
    SELECT app.rolsuper, app.rolcreaterole, app.rolcreatedb, app.rolreplication, app.rolbypassrls,
      ARRAY(
        SELECT inherited.rolname::text
        FROM pg_roles inherited
        WHERE inherited.oid <> app.oid
          AND (inherited.rolsuper OR inherited.rolcreaterole OR inherited.rolcreatedb
            OR inherited.rolreplication OR inherited.rolbypassrls
            OR inherited.rolname = ANY($1::name[]))
          AND pg_has_role(current_user, inherited.oid, 'MEMBER')
        ORDER BY inherited.rolname
      ) AS privileged_memberships
    FROM pg_roles app WHERE app.rolname = current_user
  `,
    [
      [
        "pg_execute_server_program",
        "pg_read_server_files",
        "pg_write_server_files",
        "pg_read_all_data",
        "pg_write_all_data",
        "pg_signal_backend",
        "pg_checkpoint",
        "pg_create_subscription",
        "pg_maintain",
        "pg_database_owner",
      ],
    ],
  );
  if (!result.rows[0]) failures.push("Cannot verify database application role");
  else failures.push(...databaseRoleFailures(result.rows[0]));
}

function describePermission(row: PermissionRow): string {
  return `${row.collection}:${row.action} via policy "${row.policy_name}"`;
}

function createPool(): InstanceType<typeof Pool> {
  return new Pool({
    database: process.env.DB_DATABASE,
    host: process.env.DB_HOST,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USER,
  });
}

async function checkPublicPermissions(pool: InstanceType<typeof Pool>, failures: string[]): Promise<void> {
  const result = await pool.query<PermissionRow>(`
    SELECT
      p.id,
      p.collection,
      p.action,
      p.permissions,
      p.fields,
      pol.name AS policy_name
    FROM directus_permissions p
    INNER JOIN directus_policies pol ON pol.id = p.policy
    INNER JOIN directus_access a ON a.policy = pol.id
    WHERE a.role IS NULL
      AND a."user" IS NULL
    ORDER BY p.collection, p.action, pol.name, p.id
  `);

  for (const row of result.rows) {
    if (!isAllowedPublicPermission(row)) {
      failures.push(`Public role has unexpected permission: ${describePermission(row)}`);
    }
  }
}

async function checkSensitiveAccess(pool: InstanceType<typeof Pool>, failures: string[]): Promise<void> {
  const result = await pool.query<EffectivePermissionRow>(
    `
      SELECT
        p.id,
        p.collection,
        p.action,
        p.permissions,
        p.fields,
        pol.name AS policy_name,
        CASE
          WHEN a."user" IS NOT NULL THEN CONCAT('User:', a."user"::text)
          WHEN a.role IS NULL THEN 'Public'
          ELSE r.name
        END AS accessor_name
      FROM directus_permissions p
      INNER JOIN directus_policies pol ON pol.id = p.policy
      INNER JOIN directus_access a ON a.policy = pol.id
      LEFT JOIN directus_roles r ON r.id = a.role
      WHERE p.collection = ANY($1)
      ORDER BY p.collection, p.action, accessor_name, pol.name, p.id
    `,
    [sensitiveCollections],
  );

  for (const row of result.rows) {
    const key = `${row.collection}:${row.action}`;
    const allowedAccessors = sensitiveAccessWhitelist[key] ?? [];

    if (!isAllowedSensitiveAccessor(row.collection, row.action, row.accessor_name)) {
      const allowed = allowedAccessors.length ? allowedAccessors.join(", ") : "no roles";
      failures.push(
        `${row.accessor_name} has non-whitelisted sensitive access ${describePermission(row)}; allowed: ${allowed}`,
      );
    }
  }
}

async function main(): Promise<void> {
  if (!securityChecksEnabled) {
    console.info("Custom SLK-Directus startup security checks skipped; SLK_STARTUP_SECURITY_CHECKS is not enabled.");
    return;
  }
  console.info("Running custom SLK-Directus startup security checks");

  const failures: string[] = [];
  const warnings: string[] = [];
  let missingRequiredKeys = new Set<string>();

  if (!skipEnvironmentChecks) {
    missingRequiredKeys = checkEnvironment(process.env, failures);
  }

  const missingDatabaseKeys = ["DB_PASSWORD"].filter((key) => missingRequiredKeys.has(key));
  if (failures.length === 0 && !skipDatabaseChecks && missingDatabaseKeys.length === 0) {
    const pool = createPool();
    try {
      if (process.env.SLK_ENV === "production") {
        await checkDatabaseRole(pool, failures);
      }
      await checkPublicPermissions(pool, failures);
      await checkSensitiveAccess(pool, failures);
    } finally {
      await pool.end();
    }
  } else if (!skipDatabaseChecks && missingDatabaseKeys.length > 0) {
    warnings.push(
      `Database security checks skipped because required database configuration is missing: ${missingDatabaseKeys.join(", ")}`,
    );
  }

  if (warnings.length > 0) {
    console.warn("Custom SLK-Directus startup security check warnings:");
    for (const warning of warnings) {
      console.warn(`- ${warning}`);
    }
  }

  if (failures.length > 0) {
    console.error("Custom SLK-Directus startup security checks failed:");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.info("Custom SLK-Directus startup security checks passed.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  main().catch((error: unknown) => {
    console.error("Custom SLK-Directus startup security checks failed unexpectedly:");
    console.error(error);
    process.exit(1);
  });

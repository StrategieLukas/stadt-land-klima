import process from 'node:process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';

const { Pool } = pg;
const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: '/directus/.env', quiet: true });
dotenv.config({ path: path.resolve(currentDirectory, '../../.env'), quiet: true });
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

const TRUE_VALUES = new Set(['1', 'true', 'yes']);
const securityChecksEnabled = TRUE_VALUES.has(
  (process.env.SLK_STARTUP_SECURITY_CHECKS ?? '').trim().toLowerCase(),
);
const skipEnvironmentChecks = process.argv.includes('--skip-env');
const skipDatabaseChecks = process.argv.includes('--skip-db');

const defaultValuePatterns: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /^some-random-key$/i, reason: 'uses the example random key' },
  { pattern: /^directus$/i, reason: 'uses the Directus example password' },
  { pattern: /^secret$/i, reason: 'uses the example secret' },
  { pattern: /^password$/i, reason: 'uses a placeholder password' },
  { pattern: /^change-me/i, reason: 'uses a change-me placeholder' },
  { pattern: /^access_token_of_admin_user$/i, reason: 'uses the example static token' },
  { pattern: /^your-.+-here$/i, reason: 'uses an example API key placeholder' },
  { pattern: /check-my-dms/i, reason: 'uses a local placeholder secret note' },
];

const envChecks: Array<{ name: string; required: boolean }> = [
  { name: 'KEY', required: true },
  { name: 'SECRET', required: true },
  { name: 'DB_PASSWORD', required: true },
  { name: 'CLI_DIRECTUS_STATIC_TOKEN', required: false },
  { name: 'MEILI_MASTER_KEY', required: false },
  { name: 'EMAIL_SMTP_PASSWORD', required: false },
  { name: 'UNSPLASH_ACCESS_KEY', required: false },
  { name: 'DIRECTUS_MAPBOX_KEY', required: false },
  { name: 'DIRECTUS_AI_OPENAI_API_KEY', required: false },
  { name: 'DIRECTUS_AI_ANTHROPIC_API_KEY', required: false },
  { name: 'DIRECTUS_AI_GOOGLE_API_KEY', required: false },
  { name: 'DIRECTUS_AI_OPENAI_COMPATIBLE_API_KEY', required: false },
];

const publicFileFields = new Set([
  '$thumbnail',
  'charset',
  'created_on',
  'description',
  'duration',
  'filename_download',
  'filesize',
  'folder',
  'height',
  'id',
  'metadata',
  'modified_on',
  'storage_divider',
  'tags',
  'title',
  'type',
  'uploaded_on',
  'width',
]);

const publicUserReadFields = new Set([
  'avatar',
  'description',
  'email',
  'first_name',
  'id',
  'language',
  'last_name',
  'last_page',
  'location',
  'show_on_team_page',
  'tags',
  'theme',
  'title',
]);

const publicUserUpdateFields = new Set([
  'avatar',
  'description',
  'email',
  'first_name',
  'language',
  'last_name',
  'last_page',
  'location',
  'tags',
  'theme',
  'title',
]);

const publicFileFilter = {
  _and: [
    {
      folder: {
        name: {
          _eq: 'public',
        },
      },
    },
  ],
};

const publicFolderFilter = {
  _and: [
    {
      name: {
        _eq: 'public',
      },
    },
  ],
};

const sensitiveCollections = [
  'answers',
  'candidate',
  'directus_access',
  'directus_dashboards',
  'directus_flows',
  'directus_panels',
  'directus_permissions',
  'directus_policies',
  'directus_roles',
  'directus_sessions',
  'directus_shares',
  'directus_users',
  'editors',
  'elections',
  'feedback',
  'localteams',
  'questions',
  'user_consent',
];

const sensitiveAccessWhitelist: Record<string, string[]> = {
  'answers:create': ['Frontend'],
  'answers:delete': ['Frontend'],
  'answers:read': ['Frontend', 'LokalteamMitglied', 'Planungsteam', 'WahlcheckAdmin'],
  'answers:update': ['Frontend'],
  'candidate:create': ['LokalteamMitglied', 'WahlcheckAdmin'],
  'candidate:delete': ['LokalteamMitglied', 'WahlcheckAdmin'],
  'candidate:read': ['Frontend', 'LokalteamMitglied', 'Planungsteam', 'WahlcheckAdmin'],
  'candidate:update': ['Frontend', 'LokalteamMitglied', 'WahlcheckAdmin'],
  'directus_dashboards:create': ['Planungsteam'],
  'directus_dashboards:delete': ['Planungsteam'],
  'directus_dashboards:read': ['Maßnahmenteam', 'Massnahmenteam', 'Planungsteam'],
  'directus_dashboards:update': ['Planungsteam'],
  'directus_flows:read': ['Planungsteam'],
  'directus_panels:create': ['Planungsteam'],
  'directus_panels:delete': ['Planungsteam'],
  'directus_panels:read': ['Planungsteam'],
  'directus_panels:update': ['Planungsteam'],
  'directus_roles:read': ['Planungsteam'],
  'directus_shares:read': ['Planungsteam'],
  'directus_users:read': [
    'Frontend',
    'LokalteamMitglied',
    'Maßnahmenteam',
    'Massnahmenteam',
    'MinimalUser',
    'Planungsteam',
  ],
  'directus_users:update': ['LokalteamMitglied', 'Maßnahmenteam', 'Massnahmenteam', 'MinimalUser'],
  'editors:create': ['LokalteamAdmin'],
  'editors:read': ['LokalteamMitglied', 'Planungsteam'],
  'editors:update': ['LokalteamAdmin'],
  'elections:create': ['LokalteamMitglied', 'WahlcheckAdmin'],
  'elections:delete': ['LokalteamMitglied'],
  'elections:read': ['Frontend', 'LokalteamMitglied', 'Planungsteam', 'WahlcheckAdmin'],
  'elections:update': ['LokalteamMitglied', 'WahlcheckAdmin'],
  'feedback:create': ['Frontend'],
  'feedback:read': ['Planungsteam'],
  'feedback:update': ['Planungsteam'],
  'localteams:read': [
    'Frontend',
    'LokalteamMitglied',
    'Maßnahmenteam',
    'Massnahmenteam',
    'Planungsteam',
    'WahlcheckAdmin',
  ],
  'localteams:update': ['LokalteamMitglied'],
  'questions:create': ['LokalteamMitglied', 'WahlcheckAdmin'],
  'questions:delete': ['LokalteamMitglied', 'WahlcheckAdmin'],
  'questions:read': ['Frontend', 'LokalteamMitglied', 'Planungsteam', 'WahlcheckAdmin'],
  'questions:update': ['LokalteamMitglied', 'WahlcheckAdmin'],
  'user_consent:create': [
    'LokalteamMitglied',
    'Maßnahmenteam',
    'Massnahmenteam',
    'MinimalUser',
    'WahlcheckAdmin',
  ],
  'user_consent:read': [
    'LokalteamMitglied',
    'Maßnahmenteam',
    'Massnahmenteam',
    'MinimalUser',
    'Planungsteam',
    'WahlcheckAdmin',
  ],
};

function cleanEnvValue(value: string): string {
  return value.trim().replace(/^['"]|['"]$/g, '');
}

function checkEnvironment(failures: string[], warnings: string[]): Set<string> {
  const missingRequiredKeys = new Set<string>();

  for (const check of envChecks) {
    const rawValue = process.env[check.name];
    const value = rawValue === undefined ? '' : cleanEnvValue(rawValue);

    if (!value) {
      if (check.required) {
        warnings.push(`${check.name} is missing; configure it for production Directus startup`);
        missingRequiredKeys.add(check.name);
      }
      continue;
    }

    const defaultMatch = defaultValuePatterns.find(({ pattern }) => pattern.test(value));
    if (defaultMatch) {
      failures.push(`${check.name} ${defaultMatch.reason}`);
    }
  }

  return missingRequiredKeys;
}

function normalizeDatabaseValue(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (!trimmed.startsWith('{') && !trimmed.startsWith('[') && !trimmed.startsWith('"')) {
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

  if (value && typeof value === 'object') {
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

  if (typeof normalized === 'string') {
    return normalized
      .split(',')
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
    if (field === '*') {
      return allowWildcard;
    }

    return allowedFields.has(field);
  });
}

function containsCurrentUserFilter(value: unknown): boolean {
  const normalized = normalizeDatabaseValue(value);

  if (typeof normalized === 'string') {
    return normalized.includes('$CURRENT_USER');
  }

  if (Array.isArray(normalized)) {
    return normalized.some(containsCurrentUserFilter);
  }

  if (normalized && typeof normalized === 'object') {
    return Object.values(normalized as Record<string, unknown>).some(containsCurrentUserFilter);
  }

  return false;
}

function isAllowedPublicPermission(row: PermissionRow): boolean {
  if (row.collection === 'directus_files' && row.action === 'read') {
    return jsonEquals(row.permissions, publicFileFilter) && fieldsAreSubset(row.fields, publicFileFields);
  }

  if (row.collection === 'directus_folders' && row.action === 'read') {
    return jsonEquals(row.permissions, publicFolderFilter) && fieldsAreSubset(row.fields, new Set(), true);
  }

  if (row.collection === 'directus_users' && row.action === 'read') {
    return containsCurrentUserFilter(row.permissions) && fieldsAreSubset(row.fields, publicUserReadFields);
  }

  if (row.collection === 'directus_users' && row.action === 'update') {
    return containsCurrentUserFilter(row.permissions) && fieldsAreSubset(row.fields, publicUserUpdateFields);
  }

  return false;
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

    if (!allowedAccessors.includes(row.accessor_name)) {
      const allowed = allowedAccessors.length ? allowedAccessors.join(', ') : 'no roles';
      failures.push(
        `${row.accessor_name} has non-whitelisted sensitive access ${describePermission(row)}; allowed: ${allowed}`,
      );
    }
  }
}

async function main(): Promise<void> {
  if (!securityChecksEnabled) {
    console.info('Directus startup security checks skipped; SLK_STARTUP_SECURITY_CHECKS is not enabled.');
    return;
  }

  const failures: string[] = [];
  const warnings: string[] = [];
  let missingRequiredKeys = new Set<string>();

  if (!skipEnvironmentChecks) {
    missingRequiredKeys = checkEnvironment(failures, warnings);
  }

  const missingDatabaseKeys = ['DB_PASSWORD'].filter((key) => missingRequiredKeys.has(key));
  if (failures.length === 0 && !skipDatabaseChecks && missingDatabaseKeys.length === 0) {
    const pool = createPool();
    try {
      await checkPublicPermissions(pool, failures);
      await checkSensitiveAccess(pool, failures);
    } finally {
      await pool.end();
    }
  } else if (!skipDatabaseChecks && missingDatabaseKeys.length > 0) {
    warnings.push(
      `Database security checks skipped because required database configuration is missing: ${missingDatabaseKeys.join(', ')}`,
    );
  }

  if (warnings.length > 0) {
    console.warn('Directus startup security check warnings:');
    for (const warning of warnings) {
      console.warn(`- ${warning}`);
    }
  }

  if (failures.length > 0) {
    console.error('Directus startup security checks failed:');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.info('Directus startup security checks passed.');
}

main().catch((error: unknown) => {
  console.error('Directus startup security checks failed unexpectedly:');
  console.error(error);
  process.exit(1);
});

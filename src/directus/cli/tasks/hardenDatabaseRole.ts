/** Explicit PostgreSQL application-role cutover. Never demotes the bootstrap operator.
 * Plan/apply run through bin/harden_database_role.sh with the application stopped.
 * This changes database roles/ownership only; Directus configuration remains YAML-first.
 */
import { randomBytes } from "node:crypto";
import { lstatSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import pg from "pg";
import { z } from "zod";

const RoleName = z.string().regex(/^[a-z][a-z0-9_]{0,62}$/);
const ObjectSchema = z.strictObject({
  kind: z.enum(["TABLE", "VIEW", "MATERIALIZED VIEW", "SEQUENCE", "TYPE", "DOMAIN", "FUNCTION", "PROCEDURE"]),
  identity: z.string(),
  oid: z.string(),
  owner: z.string(),
  signature: z.string(),
});
const SnapshotSchema = z.strictObject({
  system: z.string(),
  database: z.string(),
  databaseOid: z.string(),
  operator: z.string(),
  objects: z.array(ObjectSchema),
});
const PlanSchema = z.strictObject({
  version: z.literal(1),
  role: RoleName,
  password: z.string().regex(/^[a-f0-9]{64}$/),
  snapshot: SnapshotSchema,
});
export type DatabaseRolePlan = z.infer<typeof PlanSchema>;
const identifier = (value: string) => `"${value.replaceAll('"', '""')}"`;

async function snapshot(client: pg.PoolClient, role: string) {
  RoleName.parse(role);
  const result = await client.query<{
    system: string;
    database: string;
    databaseOid: string;
    operator: string;
    superuser: boolean;
  }>(`SELECT (pg_control_system()).system_identifier::text AS system,
    current_database() AS database, (SELECT oid::text FROM pg_database WHERE datname=current_database()) AS "databaseOid",
    current_user AS operator, (SELECT rolsuper FROM pg_roles WHERE rolname=current_user) AS superuser`);
  const current = result.rows[0];
  if (!current?.superuser) throw new Error("Run with the existing bootstrap superuser; it will be preserved");
  if (current.operator === role) throw new Error("Application and operator identities must differ");
  if ((await client.query("SELECT 1 FROM pg_roles WHERE rolname=$1", [role])).rowCount) {
    throw new Error("Target role already exists; this tool never overwrites an existing identity");
  }
  const schemas = await client.query(`SELECT nspname FROM pg_namespace WHERE nspname !~ '^pg_'
    AND nspname NOT IN ('public','information_schema')
    AND (EXISTS (SELECT 1 FROM pg_class c WHERE c.relnamespace=pg_namespace.oid AND c.relkind IN ('r','p','v','m','S','f')
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid='pg_class'::regclass AND d.objid=c.oid AND d.deptype IN ('e','i')))
    OR EXISTS (SELECT 1 FROM pg_proc p WHERE p.pronamespace=pg_namespace.oid
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e'))
    OR EXISTS (SELECT 1 FROM pg_type t WHERE t.typnamespace=pg_namespace.oid AND t.typtype IN ('e','d','r')
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid='pg_type'::regclass AND d.objid=t.oid AND d.deptype IN ('e','i'))))`);
  if (schemas.rowCount) throw new Error("Non-public application schemas require a separately reviewed migration");
  if (!(await client.query("SELECT to_regclass('public.directus_users') AS relation")).rows[0]?.relation) {
    throw new Error("No Directus users table found; refusing empty/wrong database");
  }
  // Extension members remain with the bootstrap owner. Indexes, row/array types and
  // identity sequences follow their owning object automatically and must not be reassigned separately.
  const relations = await client.query(`SELECT
      CASE c.relkind WHEN 'r' THEN 'TABLE' WHEN 'p' THEN 'TABLE' WHEN 'v' THEN 'VIEW'
        WHEN 'm' THEN 'MATERIALIZED VIEW' WHEN 'S' THEN 'SEQUENCE' ELSE 'UNSUPPORTED' END AS kind,
      format('%I.%I',n.nspname,c.relname) AS identity, c.oid::text AS oid, pg_get_userbyid(c.relowner) AS owner,
      md5(c::text || COALESCE((SELECT string_agg(a::text,',' ORDER BY attnum) FROM pg_attribute a WHERE attrelid=c.oid),'')
        || COALESCE((SELECT string_agg(k::text,',' ORDER BY k.oid) FROM pg_constraint k WHERE conrelid=c.oid),'')
        || COALESCE((SELECT string_agg(t::text,',' ORDER BY t.oid) FROM pg_trigger t WHERE tgrelid=c.oid),'')) AS signature
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
      AND c.relkind NOT IN ('i','I','t','c')
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid='pg_class'::regclass AND d.objid=c.oid AND d.deptype IN ('e','i'))
    ORDER BY c.oid`);
  const types = await client.query(`SELECT CASE WHEN t.typtype='d' THEN 'DOMAIN' ELSE 'TYPE' END AS kind,
      format('%I.%I',n.nspname,t.typname) AS identity, t.oid::text AS oid, pg_get_userbyid(t.typowner) AS owner,
      md5(t::text || COALESCE((SELECT string_agg(e::text,',' ORDER BY e.oid) FROM pg_enum e WHERE enumtypid=t.oid),'')) AS signature
    FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public'
      AND (t.typtype IN ('e','d','r') OR (t.typtype='c' AND EXISTS (SELECT 1 FROM pg_class c WHERE c.oid=t.typrelid AND c.relkind='c')))
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid='pg_type'::regclass AND d.objid=t.oid AND d.deptype IN ('e','i'))
    ORDER BY t.oid`);
  const unsafe = await client.query(`SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND (p.prosecdef OR p.prokind NOT IN ('f','p'))
    AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e')`);
  if (unsafe.rowCount) throw new Error("Custom SECURITY DEFINER/aggregate/window routines require manual review");
  const routines = await client.query(`SELECT CASE WHEN p.prokind='p' THEN 'PROCEDURE' ELSE 'FUNCTION' END AS kind,
      format('%I.%I(%s)',n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)) AS identity,
      p.oid::text AS oid, pg_get_userbyid(p.proowner) AS owner, md5(p::text) AS signature
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e')
    ORDER BY p.oid`);
  const objects = z.array(ObjectSchema).parse([...relations.rows, ...types.rows, ...routines.rows]);
  if (!objects.some((object) => object.kind === "TABLE"))
    throw new Error("No application tables found; refusing empty/wrong database");
  if (objects.some((object) => object.owner !== current.operator)) {
    throw new Error("Application objects have mixed owners; review them before cutover");
  }
  const { superuser: _superuser, ...identity } = current;
  return SnapshotSchema.parse({ ...identity, objects });
}

export async function planDatabaseRole(client: pg.PoolClient, role: string): Promise<DatabaseRolePlan> {
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  try {
    const inventory = await snapshot(client, role);
    await client.query("COMMIT");
    return { version: 1, role, password: randomBytes(32).toString("hex"), snapshot: inventory };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

export async function applyDatabaseRole(client: pg.PoolClient, input: unknown) {
  const plan = PlanSchema.parse(input);
  await client.query("BEGIN");
  try {
    await client.query("SET LOCAL lock_timeout='5s'");
    await client.query("SET LOCAL statement_timeout='60s'");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('slk-database-role-cutover'))");
    const sessions = await client.query(`SELECT 1 FROM pg_stat_activity
      WHERE datname=current_database() AND pid<>pg_backend_pid() AND backend_type='client backend'`);
    if (sessions.rowCount)
      throw new Error("Other database sessions remain; stop Directus/frontend and close SQL clients first");
    const current = await snapshot(client, plan.role);
    if (JSON.stringify(current) !== JSON.stringify(plan.snapshot))
      throw new Error("Database inventory changed; generate a new plan");
    // Prevent table DDL between the last snapshot and ownership transfer. This is
    // deliberately a maintenance-only operation; the operator must exclude other writers.
    for (const object of current.objects.filter((object) => object.kind === "TABLE")) {
      await client.query(`LOCK TABLE ${object.identity} IN ACCESS EXCLUSIVE MODE`);
    }
    const role = identifier(plan.role);
    // Do not expose the generated password in normal PostgreSQL statement/duration logs.
    await client.query("SET LOCAL log_statement='none'");
    await client.query("SET LOCAL log_min_duration_statement=-1");
    await client.query("SET LOCAL log_min_duration_sample=-1");
    await client.query(
      `CREATE ROLE ${role} LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD '${plan.password}'`,
    );
    await client.query(`GRANT CONNECT ON DATABASE ${identifier(current.database)} TO ${role}`);
    await client.query("REVOKE CREATE ON SCHEMA public FROM PUBLIC");
    await client.query(`GRANT USAGE, CREATE ON SCHEMA public TO ${role}`);
    // Names/argument lists come from the live catalog, never executable text from the plan.
    // Serial sequences can precede their table in OID order. The owning table
    // must move first; its attached sequences follow automatically.
    const ordered = [...current.objects].sort((a, b) => Number(a.kind === "SEQUENCE") - Number(b.kind === "SEQUENCE"));
    for (const object of ordered) {
      await client.query(`ALTER ${object.kind} ${object.identity} OWNER TO ${role}`);
    }
    if ((await client.query("SELECT to_regclass('public.spatial_ref_sys') AS relation")).rows[0]?.relation) {
      await client.query(`GRANT SELECT ON public.spatial_ref_sys TO ${role}`);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [action, file, role] = process.argv.slice(2);
  if (!file || !["plan", "apply"].includes(action ?? "") || (action === "plan" ? !role : role !== undefined)) {
    throw new Error("Usage: hardenDatabaseRole.ts plan <private-plan.json> <new-role> | apply <private-plan.json>");
  }
  const pool = new pg.Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_DATABASE,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectionTimeoutMillis: 10_000,
  });
  const client = await pool.connect();
  try {
    if (action === "plan") {
      const plan = await planDatabaseRole(client, role!);
      writeFileSync(file, `${JSON.stringify(plan, null, 2)}\n`, { mode: 0o600, flag: "wx" });
      writeFileSync(`${file}.env`, `DB_USER=${plan.role}\nDB_PASSWORD=${plan.password}\n`, { mode: 0o600, flag: "wx" });
      console.info(
        `Private plan and .env snippet saved; ${plan.snapshot.objects.length} application objects. No database changes.`,
      );
    } else {
      const info = lstatSync(file);
      if (!info.isFile() || info.isSymbolicLink() || (info.mode & 0o077) !== 0)
        throw new Error("Plan must be a private regular file (0600)");
      await applyDatabaseRole(client, JSON.parse(readFileSync(file, "utf8")));
      console.info(
        "Application role created; bootstrap operator and extension ownership preserved. Update Directus DB_USER/DB_PASSWORD before restart.",
      );
    }
  } finally {
    client.release();
    await pool.end();
  }
}

import pg from 'pg';
import find from 'lodash/find.js';
import { readRoles } from '@directus/sdk';

const { Pool } = pg;

function hasDatabaseConfig() {
  return Boolean(
    process.env.DB_DATABASE &&
    process.env.DB_HOST &&
    process.env.DB_PASSWORD &&
    process.env.DB_USER
  );
}

function createPool() {
  return new Pool({
    database: process.env.DB_DATABASE,
    host: process.env.DB_HOST,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USER,
  });
}

async function readRoleByNameFromDatabase(roleName, verbose = false) {
  if (!hasDatabaseConfig()) return null;

  const pool = createPool();

  try {
    const result = await pool.query(
      'SELECT id, name FROM directus_roles WHERE name = $1',
      [roleName]
    );

    if (result.rows.length > 1) {
      const ids = result.rows.map((row) => row.id).join(', ');
      throw new Error(`Duplicate Directus role names found in database: "${roleName}" (${ids})`);
    }

    return result.rows[0] || null;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    if (message.startsWith('Duplicate Directus role names')) {
      throw err;
    }

    if (verbose) {
      console.warn(`Could not resolve role ${roleName} directly from the database: ${message}`);
    }
    return null;
  } finally {
    await pool.end();
  }
}

async function readRoleByNameFromApi(client, roleName, roles = []) {
  const availableRoles = roles.length
    ? roles
    : await client.request(readRoles({ limit: -1, fields: ['id', 'name'] }));

  return find(availableRoles, ['name', roleName]) || null;
}

async function resolveRoleByName(client, roleName, roles = [], options = { verbose: false }) {
  if (roleName === 'Public') {
    return { id: null, name: 'Public' };
  }

  const apiRole = await readRoleByNameFromApi(client, roleName, roles);
  const databaseRole = await readRoleByNameFromDatabase(roleName, options.verbose);

  if (databaseRole) {
    if (apiRole?.id && apiRole.id !== databaseRole.id) {
      console.warn(
        `Role ${roleName} resolved to ${apiRole.id} via Directus API, but ${databaseRole.id} exists in directus_roles; using database ID.`
      );
    }

    return databaseRole;
  }

  return apiRole;
}

export default resolveRoleByName;

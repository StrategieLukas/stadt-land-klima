import pg from 'pg';
import find from 'lodash/find.js';
import { readPolicies } from '@directus/sdk';

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

async function readPolicyByNameFromDatabase(policyName, verbose = false) {
  if (!hasDatabaseConfig()) return null;

  const pool = createPool();

  try {
    const result = await pool.query(
      'SELECT id, name FROM directus_policies WHERE name = $1',
      [policyName]
    );

    if (result.rows.length > 1) {
      const ids = result.rows.map((row) => row.id).join(', ');
      throw new Error(`Duplicate Directus policy names found in database: "${policyName}" (${ids})`);
    }

    return result.rows[0] || null;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    if (message.startsWith('Duplicate Directus policy names')) {
      throw err;
    }

    if (verbose) {
      console.warn(`Could not resolve policy ${policyName} directly from the database: ${message}`);
    }
    return null;
  } finally {
    await pool.end();
  }
}

async function readPolicyByNameFromApi(client, policyName, policies = []) {
  const availablePolicies = policies.length
    ? policies
    : await client.request(readPolicies({ limit: -1 }));

  return find(availablePolicies, ['name', policyName]) || null;
}

async function resolvePolicyByName(client, policyName, policies = [], options = { verbose: false }) {
  const apiPolicy = await readPolicyByNameFromApi(client, policyName, policies);
  const databasePolicy = await readPolicyByNameFromDatabase(policyName, options.verbose);

  if (databasePolicy) {
    if (apiPolicy?.id && apiPolicy.id !== databasePolicy.id) {
      console.warn(
        `Policy ${policyName} resolved to ${apiPolicy.id} via Directus API, but ${databasePolicy.id} exists in directus_policies; using database ID.`
      );
    }

    return databasePolicy;
  }

  return apiPolicy;
}

export default resolvePolicyByName;

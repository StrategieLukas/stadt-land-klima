/** Provisions the configured service roles without changing role/policy configuration.
 * Run inside Directus with CLI_DIRECTUS_STATIC_TOKEN. Printed tokens are intended for private .env files.
 */
import {
  createDirectus,
  createUser,
  readRoles,
  rest,
  staticToken,
} from '@directus/sdk';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function provisionServiceUsers(url: string, adminToken: string) {
  const client = createDirectus<{}>(url)
    .with(staticToken(adminToken))
    .with(rest());
  const definitions = [
    {
      role: 'Frontend-Server',
      email: 'frontend-server@stadt-land-klima.local',
      lastName: 'Server',
      variable: 'DIRECTUS_FRONTEND_SERVER_TOKEN',
    },
    {
      role: 'Frontend-Public',
      email: 'frontend-public@stadt-land-klima.local',
      lastName: 'Public',
      variable: 'DIRECTUS_FRONTEND_PUBLIC_TOKEN',
    },
  ];
  // Resolve both roles before creating any users. Ambiguous/missing roles must stop provisioning.
  const roles = await Promise.all(
    definitions.map(async (definition) => {
      const matches = await client.request(
        readRoles({
          filter: { name: { _eq: definition.role } },
          fields: ['id'],
          limit: 2,
        }),
      );
      if (matches.length !== 1 || !matches[0])
        throw new Error(`Role "${definition.role}" was not uniquely found`);
      return matches[0].id;
    }),
  );
  const assignments: Record<string, string> = {};
  for (const [index, definition] of definitions.entries()) {
    const role = roles[index];
    if (!role) throw new Error('Missing service role');
    const token = randomBytes(32).toString('hex');
    await client.request(
      createUser({
        email: definition.email,
        first_name: 'Frontend',
        last_name: definition.lastName,
        password: randomBytes(32).toString('base64'),
        token,
        role,
        status: 'active',
        provider: 'default',
      }),
    );
    assignments[definition.variable] = token;
  }
  return assignments;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const token = process.env.CLI_DIRECTUS_STATIC_TOKEN;
  if (!token) throw new Error('CLI_DIRECTUS_STATIC_TOKEN is required');
  const values = await provisionServiceUsers(
    process.env.DIRECTUS_URL || 'http://localhost:8081',
    token,
  );
  console.info(
    Object.entries(values)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n'),
  );
}

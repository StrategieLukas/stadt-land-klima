/**
 * Provisions the Frontend-Server and Frontend-Public Directus service users.
 * Run from the repo root:
 *   docker compose -f docker-compose.yaml exec directus node /directus/cli/tasks/provisionServiceUsers.ts
 *
 * Creates users, generates static tokens, and prints the tokens for .env configuration.
 */

import { randomBytes } from 'node:crypto'
import { createDirectus, rest, staticToken, customEndpoint } from '@directus/sdk'

const directusUrl = process.env.DIRECTUS_URL || 'http://localhost:8081'
const adminToken = process.env.CLI_DIRECTUS_STATIC_TOKEN

if (!adminToken) {
  console.error('CLI_DIRECTUS_STATIC_TOKEN is required')
  process.exit(1)
}

const client = createDirectus(directusUrl).with(staticToken(adminToken)).with(rest())

async function findRole(name: string): Promise<string> {
  const roles = await client.request(customEndpoint<{ data: Array<{ id: string }> }>({
    path: '/items/directus_roles',
    method: 'GET',
    params: {
      filter: JSON.stringify({ name: { _eq: name } }),
      fields: 'id',
      limit: '1',
    },
  }))

  if (!roles.data || !roles.data.length) {
    throw new Error(`Role "${name}" not found`)
  }
  return roles.data[0].id
}

async function createUserWithToken(roleName: string, email: string, firstName: string, lastName: string) {
  const roleId = await findRole(roleName)
  const password = randomBytes(32).toString('base64')

  console.info(`\n=== Creating ${roleName} user ===`)

  // Create user via custom endpoint
  const userId = await client.request({
    path: '/users',
    method: 'POST',
    data: {
      email,
      first_name: firstName,
      last_name: lastName,
      password,
      role: roleId,
      status: 'active',
      provider: 'default',
    },
  } as any)

  console.info(`User created: ${email} (ID: ${userId})`)

  // Generate static token
  const tokenResult: any = await client.request({
    path: `/users/${userId}/token`,
    method: 'POST',
  } as any)

  const tokenValue = typeof tokenResult === 'string' ? tokenResult : tokenResult?.token
  console.info(`Static token for ${roleName}: ${tokenValue}`)

  return { email, token: tokenValue }
}

async function main() {
  const results: { name: string; token: string }[] = []

  const serverResult = await createUserWithToken(
    'Frontend-Server',
    'frontend-server@stadt-land-klima.local',
    'Frontend',
    'Server'
  )
  results.push({ name: 'DIRECTUS_FRONTEND_SERVER_TOKEN', token: serverResult.token })

  const publicResult = await createUserWithToken(
    'Frontend-Public',
    'frontend-public@stadt-land-klima.local',
    'Frontend',
    'Public'
  )
  results.push({ name: 'DIRECTUS_FRONTEND_PUBLIC_TOKEN', token: publicResult.token })

  console.info('\n=== Add to .env ===')
  console.info(results.map(r => `${r.name}=${r.token}`).join('\n'))
}

void main().catch(error => {
  console.error('Provisioning failed:', error?.message || error)
  process.exitCode = 1
})

/**
 * Run after import-all, from src/directus/cli:
 *   npx tsx provisionPreviewVerifier.ts
 * Reads ../.env for CLI authentication and updates ../../frontend/.env (0600).
 * Existing token/user are reused. No credential or upstream error is printed.
 */
import { randomBytes } from 'node:crypto'
import { chmodSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'dotenv'

const directory = dirname(fileURLToPath(import.meta.url))
const backendEnv = parse(readFileSync(resolve(directory, '../.env')))
const frontendPath = resolve(process.env.PREVIEW_FRONTEND_ENV_FILE || resolve(directory, '../../frontend/.env'))
const frontendText = readFileSync(frontendPath, 'utf8')
const frontendEnv = parse(frontendText)
const url = process.env.PREVIEW_DIRECTUS_URL || 'http://localhost:8081'
const adminToken = process.env.CLI_DIRECTUS_STATIC_TOKEN || backendEnv.CLI_DIRECTUS_STATIC_TOKEN

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  if (!adminToken) throw new Error('CLI_DIRECTUS_STATIC_TOKEN is required')
  const response = await fetch(new URL(path, url), {
    method,
    headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!response.ok) {
    const errors = await response.json().catch(() => ({}))
    const codes = (errors.errors || []).map((error: { extensions?: { code?: string; field?: string } }) =>
      `${error.extensions?.code || 'UNKNOWN'} (${error.extensions?.field || 'request'})`).join(', ')
    throw new Error(`Provisioning ${method} ${path.split('?')[0]} failed with HTTP ${response.status}: ${codes}`)
  }
  return (await response.json()).data as T
}

async function main() {
  const roleName = 'Frontend-Preview'
  const roles = await request<{ id: string; parent: string | null; policies: { policy: { name: string; admin_access: boolean; app_access: boolean } }[] }[]>(
    'GET', `/roles?filter=${encodeURIComponent(JSON.stringify({ name: { _eq: roleName } }))}&fields=id,parent,policies.policy.name,policies.policy.admin_access,policies.policy.app_access`,
  )
  const role = roles[0]
  if (roles.length !== 1 || !role || role.parent || role.policies.length !== 1
    || role.policies[0].policy.name !== roleName || role.policies[0].policy.admin_access || role.policies[0].policy.app_access) {
    throw new Error('Import the isolated Frontend-Preview role/policy first')
  }
  const email = 'frontend-preview@stadt-land-klima.de'
  const users = await request<{ id: string; role: string; policies: unknown[]; token: string | null }[]>(
    'GET', `/users?filter=${encodeURIComponent(JSON.stringify({ email: { _eq: email } }))}&fields=id,role,policies,token`,
  )
  if (users.length > 1 || users.some(user => user.role !== role.id || user.policies.length)) {
    throw new Error('Existing preview user has unexpected permissions; inspect its assignment')
  }
  const token = users[0]?.token || frontendEnv.DIRECTUS_PREVIEW_TOKEN || randomBytes(32).toString('hex')
  if (!/^[A-Za-z0-9_-]{32,256}$/.test(token)) throw new Error('Preview service credential must have a strong supported format')
  if (users[0]) {
    await request('PATCH', `/users/${users[0].id}`, { token, status: 'active' })
  } else {
    await request('POST', '/users', {
      email, first_name: 'Frontend', last_name: 'Preview verifier', role: role.id,
      status: 'active', provider: 'default', token, password: randomBytes(32).toString('hex'),
    })
  }
  const assignment = `DIRECTUS_PREVIEW_TOKEN=${token}`
  const updated = /^DIRECTUS_PREVIEW_TOKEN=.*$/m.test(frontendText)
    ? frontendText.replace(/^DIRECTUS_PREVIEW_TOKEN=.*$/m, assignment)
    : `${frontendText.trimEnd()}\n\n# Private municipality preview verifier\n${assignment}\n`
  const temporary = `${frontendPath}.preview-${process.pid}`
  writeFileSync(temporary, updated, { mode: 0o600, flag: 'wx' })
  renameSync(temporary, frontendPath)
  chmodSync(frontendPath, 0o600)
  process.stdout.write('Preview verifier provisioned; private frontend env updated (credential redacted).\n')
}

main().catch(error => {
  // Only our fixed operational messages reach stdout/stderr, never raw SDK errors.
  process.stderr.write(`${error instanceof Error ? error.message : 'Preview provisioning failed'}\n`)
  process.exitCode = 1
})

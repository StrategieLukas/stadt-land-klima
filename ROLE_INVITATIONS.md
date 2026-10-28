# Role invitations (#349)

Directus administrators can open **Personen einladen** in the Studio navigation (`/admin/role-invitations`, or `/backend/admin/role-invitations` when the CMS uses the `/backend` prefix). Select a role, enter an email address and name, and send the invitation. **Einladung erneut senden** works only for an existing, unaccepted invitation in the same role. Active, suspended, archived and differently assigned accounts are never changed by this flow.

Supported roles are ErfolgsprojekteRedaktion, Maßnahmenteam, Planungsteam, Recruiter, WahlcheckAdmin and BlokkliEditor. Pending accounts with directly assigned administrator policies are also excluded. The server resolves their IDs from the maintained names and excludes roles with administrator policies, including inherited policies. Service identities and localteam roles are not offered. Localteam membership still uses its existing flow. The planning team's existing **Erfolgsprojekte-Redaktion** dashboard remains limited to article editors and keeps its existing email subject/template.

## Native Directus integration

The implementation uses the pinned Directus **11.17.4** UsersService invitation URL and native `/users/invite/accept` password-setting/activation flow. It does not create a second token or password system. The native generic `inviteUser` sender does not await mail delivery in this version; the shared helper therefore uses the same native URL builder with an awaited MailService send and role-specific templates. The second `inviteUrl` argument is a custom URL, so it must be `null`, not a role ID. See the [pinned native implementation](https://github.com/directus/directus/blob/v11.17.4/api/src/services/users.ts).

Set the CMS `PUBLIC_URL` to its public origin and path prefix, configure SMTP and retain `USER_INVITE_TOKEN_TTL` as the native expiration setting. Native Studio handles password policy and activation. Accepted invitations cannot be reused. Resending does not invalidate an earlier unexpired native link; accepting any valid link activates the account and makes all invitation links unusable.

Mail failure is reported rather than returning success, including in development. New account creation and delivery are enclosed in a database transaction; a failed send rolls the new account back so the operator can retry. Resends retain existing account data. As with synchronous mail delivery generally, an SMTP acceptance followed by a database commit failure can require a fresh invitation. No token, password or full invitation URL is returned by these endpoints or written to application logs.

## Installation

Build the existing extension bundle:

```sh
cd src/directus/extensions/erfolgsprojekte-user-manager
npm ci
npm run build
```

Apply the YAML with the normal `import-all.sh` workflow and restart Directus to load the rebuilt bundle. The new hidden `role_invitation_requests` collection implements a transactional sliding window: five send attempts per authenticated user per minute, shared across the admin and article-editor interfaces. The role-list endpoint allows ten reads per minute. Presets live in `src/frontend/server/utils/rateLimitConfig.ts`; no public-role permission changes are needed. PostgreSQL advisory locks serialize concurrent invitations to the same email address. The existing Podman extension build now copies the shared rate-limit configuration it needs.

## Verification

- `npm run test:role-invitations` in `bin/test_suite`: payload/auth checks, role/ancestor exclusions, native URL arguments, mail failure/rollback, duplicate handling and resends.
- `npm run test:role-invitations:live -- http://localhost:8084 http://localhost:18025 /absolute/path/to/directus/.env`: opt-in local CMS and Mailpit only, reserved example.org recipients, disposable users with cleanup. This exercises the actual admin module, role-specific captured emails, HTML escaping, native acceptance/login/reuse rejection, concurrent duplicate requests, persistent rate limiting and the planning-team invitation path. An optional fifth argument selects a second local test CMS with SMTP deliberately pointed at an unused local port; this verifies actual mail-failure rollback. Configure that test CMS's SMTP host to the local capture server; never point this profile at production SMTP.
- `bin/test_dev.sh`: required ordinary regressions. Real external inbox delivery and visual appearance in email clients remain manual checks.

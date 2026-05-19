# Directus Upgrade: 10.13.4 → 11.17.4 — Breaking Changes Analysis Prompt

You are an expert Directus engineer assisting with an upgrade from **Directus 10.13.4 to 11.17.4**.

Your task is to audit this specific project and determine the impact of every breaking change listed below. For each change, you must:

1. Determine if it **affects this project** (yes / no / unknown — needs inspection)
2. Identify whether it has **automatic migration** (handled by `npx directus database migrate:latest`) or requires **manual action**
3. Describe the **exact fix** needed for this project

Work through each section methodically. Do not skip any item. After reviewing all items, produce a prioritized action plan.

---

## UPGRADE SCOPE

**From:** 10.13.4
**To:** 11.17.4
**Breaking changes span:** v10.13.4 → v10 final → v11.0.0 → v11.17.4

> ⚠️ Always run `npx directus database migrate:latest` after updating the package. Always take a full database backup before upgrading.

---

## PART 1 — Version 10.x Breaking Changes (10.13.4 → end of v10)

These changes occurred after 10.13.4 and must be addressed before or alongside the v11 upgrade.

---

### [v10.13.2] Updated Date Fields for Files
**Auto-migrated:** ✅ Yes (schema migration adds `created_on`)
**What changed:** A new `created_on` field was added to `directus_files`. The existing `uploaded_on` field now updates on every file replacement, not just initial upload.

**Check for this project:**
- Does this project rely on `uploaded_on` as a stable "original upload date"? If so, logic must be updated to use `created_on` instead.
- Are there any API consumers, flows, or frontend components that read `uploaded_on` expecting it to never change after initial upload?

---

### [v10.12.2] Disallowed Mutation of System Collections via Relations
**Auto-migrated:** ✅ N/A (no migration needed; requests will now fail)
**What changed:** Mutations of `directus_collections`, `directus_fields`, `directus_relations`, `directus_sessions`, and `directus_extensions` via relational writes are now blocked.

**Check for this project:**
- Are there any Flows, custom endpoints, or frontend calls that mutate these system collections through a relation on another collection?
- Search codebase for any writes targeting these collections indirectly.

---

### [v10.10.0] Extension Folder Structure Changed (Typed Extension Folders Deprecated)
**Auto-migrated:** ❌ Manual
**What changed:** The legacy folder structure (`/extensions/interfaces/`, `/extensions/hooks/`, etc.) is no longer supported. Extensions must now be in the root of the extensions directory, named with the `directus-extension-` prefix, and have a `directus:extension` block in their `package.json`.

**Check for this project:**
- List all custom extensions and their current folder structure.
- For each extension: does it use the legacy subfolder pattern (`interfaces/`, `hooks/`, `modules/`, etc.)? If so, it must be restructured.
- Ensure every extension has a valid `package.json` with `directus:extension.type`, `directus:extension.path`, `directus:extension.source`, and `directus:extension.host`.

**Fix:**
Move each extension from `./extensions/<type>/<name>/` to `./extensions/<name>/` and update their `package.json` accordingly.

---

### [v10.10.0] Migrations Moved Out of Extensions
**Auto-migrated:** ❌ Manual
**What changed:** Custom database migrations are no longer an extension type. They must be placed in `./migrations/` or at the path set by `MIGRATIONS_PATH`.

**Check for this project:**
- Is there a `./extensions/migrations/` directory with migration files?
- If yes, move those files to `./migrations/` (or configure `MIGRATIONS_PATH`).

---

### [v10.10.0] Email Templates Moved Out of Extensions
**Auto-migrated:** ❌ Manual
**What changed:** Email templates are no longer an extension type. They must be placed in `./templates/` or at the path set by `EMAIL_TEMPLATES_PATH`.

**Check for this project:**
- Is there a `./extensions/templates/` directory?
- If yes, move templates to `./templates/` (or configure `EMAIL_TEMPLATES_PATH`).

---

### [v10.10.0] Content Versioning Output Changed
**Auto-migrated:** ✅ N/A (behavior change, no migration)
**What changed:** Requesting item content versions via the API now returns resolved nested relational one-to-many changes instead of raw diff objects. Use `?versionRaw=true` for the old behavior.

**Check for this project:**
- Are content versions used in this project?
- Does any code process the raw version diff format? If so, it must be updated or `?versionRaw=true` appended to those specific requests.

---

### [v10.10.0] Session Cookie Authentication (SSO Impact)
**Auto-migrated:** ✅ Partial (App switches automatically; SSO config needs review)
**What changed:** The app now uses session-based authentication instead of token-based. SSO providers (OAuth2, OpenID, SAML) now default to session cookie mode.

**Check for this project:**
- Does this project use SSO (OAuth2 / OpenID Connect / SAML)?
- If yes: does any external app rely on `AUTH_<PROVIDER>_MODE` behavior? Review and set `AUTH_<PROVIDER>_MODE=cookie` or `json` explicitly.
- Are there any app extensions that extract the auth token from `axios.defaults.headers`? These must be removed — token is no longer available there.
- Is `AuthenticationService.login()` called with a third positional argument (OTP string)? Must be updated to `{ otp: 'code', session: true }`.

---

### [v10.10.0] OAuth2/OpenID/SAML Redirect Allow List Required
**Auto-migrated:** ❌ Manual (env config change)
**What changed:** External redirects after SSO login now require an allow list.

**Check for this project:**
- Does any SSO flow redirect to an external domain using `?redirect=https://...`?
- If yes, add `AUTH_<PROVIDER>_REDIRECT_ALLOW_LIST` with those URLs to the environment config.

---

### [v10.10.0] Email Flow Operation No Longer Awaits Send
**Auto-migrated:** ✅ N/A (behavior change)
**What changed:** The "Send Email" flow operation no longer waits for the email to be sent before proceeding.

**Check for this project:**
- Are there any Flows that use the Email operation and then check its output or depend on sequential execution post-send?
- If so, these flows must be refactored to use a custom operation with `MailService` if send confirmation is required.

---

### [v10.9.0] Exif Tag Names Changed
**Auto-migrated:** ✅ N/A (only affects newly uploaded files)
**What changed:** The `exif-reader` library updated tag names to align with the Exif standard. Only applies to images uploaded after upgrade.

**Check for this project:**
- Is there a custom `FILE_METADATA_ALLOW_LIST` in environment config?
- Does any code reference specific Exif tag names from `directus_files` metadata? Those names may have changed.

---

### [v10.9.0] SDK Scoped Entrypoints Dropped
**Auto-migrated:** ❌ Manual (code change)
**What changed:** `import { rest } from '@directus/sdk/rest'` (scoped imports) no longer work.

**Check for this project:**
- Search codebase for any `@directus/sdk/<scope>` imports.
- Update all to root imports: `import { createDirectus, rest, ... } from '@directus/sdk'`.

---

### [v10.9.0] Async Logic in JS Config Files Dropped
**Auto-migrated:** ❌ Manual
**What changed:** Async code in `.js` Directus config files is no longer supported.

**Check for this project:**
- Does the project use a `directus.config.js` file with async logic (e.g., `async function`, `await`)?
- If yes, refactor to synchronous config or use environment variables.

---

### [v10.8.3] GraphQL Content Versioning Query Changed
**Auto-migrated:** ❌ Manual (code change)
**What changed:** Accessing content versions via GraphQL now uses `<collection>_by_version(id, version)` instead of passing a `version` parameter on regular collection queries.

**Check for this project:**
- Are there any GraphQL queries that use the `version` parameter on standard collection queries or `<collection>_by_id`?
- If yes, update them to use `<collection>_by_version`.

---

### [v10.7.0] Extensions List Endpoint Changed
**Auto-migrated:** ❌ Manual (code change)
**What changed:** `GET /extensions/:type` no longer works. Use `GET /extensions` and filter by type client-side.

**Check for this project:**
- Does any frontend, script, or integration call `GET /extensions/:type`?

---

### [v10.6.2] SDK `refresh()` Parameter Order Swapped
**Auto-migrated:** ❌ Manual (code change)
**What changed:** The `refresh(token, mode)` signature is now `refresh(mode, token)`.

**Check for this project:**
- Search for `refresh(` in SDK usage code. Update any calls accordingly.
- Note: `sdk.request(refresh())` or `sdk.request(refresh('cookie'))` for cookie mode is the new default.

---

### [v10.6.2] SDK `asSearch` Renamed to `withSearch`
**Auto-migrated:** ❌ Manual
**What changed:** The SDK helper `asSearch` is now `withSearch`.

**Check for this project:**
- Search for `asSearch` in codebase and replace with `withSearch`.

---

### [v10.6.0] Custom NPM Modules in Flow "Run Script" Dropped
**Auto-migrated:** ❌ Manual
**What changed:** Flow "Run Script" operations no longer support arbitrary npm modules (previously via `vm2`). Now uses `isolated-vm`. `axios`, `node-fetch`, etc. are not available.

**Check for this project:**
- Review all "Run Script" flow operations. Do any `require()` or `import` npm packages?
- Replace HTTP calls with the "Webhook / Request URL" flow operation.
- For other packages, create a custom operation extension.

---

### [v10.4.0] Redis Environment Variables Consolidated
**Auto-migrated:** ❌ Manual (env config change)
**What changed:** Separate `CACHE_REDIS_*`, `RATE_LIMITER_REDIS_*`, `SYNCHRONIZATION_REDIS_*`, `MESSENGER_REDIS_*` variables are replaced by a single `REDIS_HOST` / `REDIS_PORT` / `REDIS_*` set.

**Check for this project:**
- Does this project use Redis (for caching, rate limiting, realtime, or flows)?
- If yes, update environment variables to the unified `REDIS_*` pattern and remove the old per-feature vars.

---

### [v10.4.0] Memcached Support Dropped
**Auto-migrated:** ❌ Manual (env config change)
**What changed:** Memcached is no longer supported for caching or rate limiting.

**Check for this project:**
- Is `CACHE_STORE=memcache` or `RATE_LIMITER_STORE=memcache` set? If so, migrate to Redis or in-memory.

---

### [v10.4.0] Extension Error Structure Changed
**Auto-migrated:** ❌ Manual (code change)
**What changed:** Extensions can no longer import system exceptions from the `exceptions` context argument. Must use `createError` from `@directus/errors` instead.

**Check for this project:**
- Search all custom extensions for `exceptions` in the router/hook arguments.
- Replace with `import { createError } from '@directus/errors'` and define errors locally.

---

## PART 2 — Version 11.x Breaking Changes (11.0.0 → 11.17.4)

---

### [v11.0.0] ⭐ New Permissions System: Policies (MAJOR)
**Auto-migrated:** ✅ Yes — existing roles are automatically migrated to the new policies structure
**What changed:** Permissions are no longer stored on roles. A new `directus_policies` collection exists. Policies can be attached to roles and directly to users. Roles can be nested. A user's effective permissions are an aggregate of all attached policies.

**Role object changes:**
- `admin_access`, `app_access`, `enforce_tfa`, `ip_access` removed from roles → now on policies
- Roles gain a `children` (o2m to roles) property

**User object changes:**
- Users gain a `policies` (m2m to policies) property

**Permission object changes:**
- `role` field on permissions replaced with `policy`

**Check for this project:**
- Does any code call `/users`, `/roles`, or `/permissions` endpoints and access `role.admin_access`, `role.app_access`, or `role.enforce_tfa`? These must be read from the policy now.
- Does any code filter permissions by `role`? Must be updated to filter by `policy`.
- App extensions using `usersStore`: `user.role.admin_access` is now `user.admin_access` directly on the user object.
- Module extensions using `preRegisterCheck`: it now receives the data from the "Get Current User Permissions" endpoint, not a raw permissions array.
- After auto-migration, manually review role/policy structure to take advantage of the new system.

> ⚠️ Take a database backup before upgrading. The auto-migration is one-way.

---

### [v11.0.0] Requests for Missing Fields Now Return Errors
**Auto-migrated:** ✅ N/A (behavior change — previously silently ignored)
**What changed:** Requesting fields that do not exist in the schema will now throw an error instead of being silently ignored.

**Check for this project:**
- Are there any API calls (REST or GraphQL), SDK queries, or Flows that request fields that may have been removed or renamed at any point?
- Run requests in a test environment post-upgrade and check for new field-not-found errors.

---

### [v11.0.0] M2A Fields Now Require Collection Name
**Auto-migrated:** ❌ Manual (code change)
**What changed:** Many-to-Any (M2A) field requests without a collection name specifier will throw an error.

**Before:** `fields=items.item:m2a_collection.m2a_field` — worked inconsistently
**After:** Must always specify the target collection explicitly in M2A field paths.

**Check for this project:**
- Search codebase and Flows for any M2A field queries (fields containing `:` collection type hints).
- Verify all M2A field paths include the collection name at every level.

---

### [v11.0.0] MySQL Client Replaced: `mysql` → `mysql2`
**Auto-migrated:** ✅ Automatic (library swap)
**What changed:** The MySQL/MariaDB driver is now `mysql2`.

**Check for this project:**
- Is this project using MySQL or MariaDB?
- If yes: verify `DB_CHARSET` / `DB_CHARSET_NUMBER` env vars match your table/column charsets (stricter comparison now).
- Note: `Decimal` type values are now returned as `string` instead of `number`. Update any code that performs arithmetic directly on Decimal fields from the API.

---

### [v11.1.1] SendGrid Email Transport Dropped
**Auto-migrated:** ❌ Manual (env config change)
**What changed:** The native SendGrid transport for nodemailer is removed.

**Check for this project:**
- Is `EMAIL_TRANSPORT=sendgrid` or similar SendGrid-specific config set?
- If yes, switch to SendGrid's SMTP Relay: set `EMAIL_TRANSPORT=smtp` and use the SMTP credentials from your SendGrid account settings.

---

### [v11.1.2] Comments Moved to `directus_comments` Collection
**Auto-migrated:** ✅ Yes (new collection and endpoints added; old endpoints still work temporarily)
**What changed:** Comments are no longer part of `directus_activity`. A new `directus_comments` collection exists. Comment primary keys are now UUIDs instead of integers.

**Check for this project:**
- Does any code, extension, or integration use the `ActivityService` to read/write comments? Must migrate to `CommentsService`.
- Does any code assume comment IDs are numeric? Update type checks to handle UUIDs.
- Is the Directus SDK used for comments? Ensure SDK version is compatible with v11 (uses new comment endpoints).

---

### [v11.5.0] Flow Condition Operation Error Type Changed
**Auto-migrated:** ❌ Manual (Flow config change)
**What changed:** When a Flow condition operation fails, it now throws `FailedValidationError` instead of the previous error type.

**Check for this project:**
- Are there any Flows that catch or branch on the error from a condition operation failure?
- Update error handling/branching logic in those flows to match `FailedValidationError`.

---

### [v11.6.0] GraphQL Primary Key Type Changed: `String` → `ID`
**Auto-migrated:** ❌ Manual (code change)
**What changed:** GraphQL primary key fields are now typed as `ID` instead of `String`.

**Check for this project:**
- Does this project use GraphQL?
- Search for any GraphQL queries/mutations that pass primary keys as typed variables using `String`. Update to `ID`.

---

### [v11.6.0] `items.create` Action Hook Receives Final Payload
**Auto-migrated:** ✅ N/A (behavior change)
**What changed:** The `items.create` action hook now receives the post-filter, post-preset payload rather than the original raw payload.

**Check for this project:**
- Are there any custom hooks listening to `items.create`?
- Does the hook logic depend on receiving the *original* unmodified payload? If so, logic may need adjustment since it now receives the filtered/preset-applied payload.

---

### [v11.7.0] MySQL 5.7 No Longer Supported
**Auto-migrated:** ✅ N/A
**What changed:** MySQL 5.7 (EOL Oct 2023) is officially unsupported.

**Check for this project:**
- What MySQL version is in use? If 5.7, upgrade to 8.0+ before proceeding.

---

### [v11.9.0] SDK `login()` Signature Changed
**Auto-migrated:** ❌ Manual (code change)
**What changed:**
- Before: `sdk.login(email, password)`
- After: `sdk.login({ email, password })` or `sdk.login({ identifier, password })` for LDAP

**Check for this project:**
- Search codebase for `sdk.login(` or `authentication.login(`.
- Update all calls to use the payload object form.

---

### [v11.9.0] SDK `refresh()` and `logout()` Now Use Options Object
**Auto-migrated:** ❌ Manual (code change)
**What changed:**
- `refresh('json', token)` is now `sdk.request(refresh({ mode: 'json', refresh_token: token }))`
- `logout` similarly uses an options object

**Check for this project:**
- Search for `sdk.request(refresh(` and `sdk.request(logout(` calls.
- Update to use the options object form.

---

### [v11.9.0] Manual Trigger Flows Now Require Authentication
**Auto-migrated:** ✅ N/A (behavior change)
**What changed:** Flows with a "Manual" trigger now require the caller to be authenticated. Previously they could be called anonymously.

**Check for this project:**
- Are there any flows using the Manual trigger that are intended to be publicly accessible (e.g., called from a frontend without auth)?
- If yes, convert those flows to use a Webhook trigger instead.

---

### [v11.10.0] Database-Only Tables Excluded from Snapshots
**Auto-migrated:** ✅ N/A (snapshot behavior change)
**What changed:** Tables not tracked in `directus_collections` (raw DB-only tables) are now excluded from schema snapshots.

**Check for this project:**
- Does this project use raw database tables not managed by Directus (e.g., tables created via custom migrations)?
- If yes, review snapshot/promote workflows — these tables will no longer appear in snapshots, which prevents accidental drops when promoting schemas. Verify this is the intended behavior.

**⚠️ Data loss risk:** Downgrading from ≥11.10.0 to <11.10.0 will cause these tables to be dropped from the target.

---

### [v11.10.0] `NODE_ENV` No Longer Hardcoded to `production` in API Extensions
**Auto-migrated:** ✅ N/A
**What changed:** API extensions now receive the actual `NODE_ENV` value instead of a hardcoded `production`.

**Check for this project:**
- Do any custom API extensions branch logic on `process.env.NODE_ENV === 'production'`?
- Verify that this still behaves correctly in all environments.

---

### [v11.10.1] TypeScript API Extensions Now Fully Typed
**Auto-migrated:** ❌ Manual (TypeScript compilation fix)
**What changed:** Services in API extensions are now fully typed instead of `any`. This may cause TypeScript build errors:
- `ItemsService` constructor expects `string` (not `string | undefined`)
- `readOne()`/`readMany()` expect `string | number` (not nullable)

**Check for this project:**
- Do any API extensions use TypeScript?
- Run a TypeScript build and fix any new type errors by adding null checks or type assertions where needed.

---

### [v11.11.0] Content Versioning — Deeply Nested Data & Query Parameters
**Auto-migrated:** ✅ N/A (behavior change)
**What changed:**
1. Relational versioned data now requires explicit field expansion (no implicit inclusion)
2. Invalid versioned data will error on query (not silently return)
3. Query parameters now apply to the versioned data, not the main record
4. New relational records in a version return `id: null` until promoted

**Check for this project:**
- Does this project use content versioning with relational fields?
- Update any version queries that relied on implicit relational data inclusion to explicitly expand fields.
- Review any code that checks for `id` on version-only relational records.

---

### [v11.12.0] Content Versioning — Audit Fields Represent Last Actual Change
**Auto-migrated:** ✅ N/A (behavior change)
**What changed:** `USER_CREATED`, `USER_UPDATED`, `DATE_CREATED`, `DATE_UPDATED` fields on versioned items now reflect the last real data change, not the version promotion metadata.

Also: requesting a non-existent version now returns `403 Forbidden` instead of falling back to the main version.

**Check for this project:**
- Does any code rely on `DATE_UPDATED` or `USER_UPDATED` reflecting when a version was *promoted* (rather than when data was last edited)?
- Does any code expect a fallback to main when requesting a non-existent version key? Update those callers to handle `403`.

---

### [v11.13.0] `presentation` and `group` Removed from `RELATIONAL_TYPES`
**Auto-migrated:** ✅ N/A
**What changed:** `presentation` and `group` field types are no longer in the `RELATIONAL_TYPES` constant.

**Check for this project:**
- Do any custom extensions or hooks check `RELATIONAL_TYPES` and expect `presentation` or `group` to be in that set?

---

### [v11.13.0] `<scope>.delete` Hook Now Fires Before Permission Checks
**Auto-migrated:** ❌ Manual (hook logic review)
**What changed:** The `<scope>.delete` hook now fires *before* permission checks. It will trigger even if the user lacks permission to delete. Keys returned from the hook replace the original keys for subsequent processing.

**Check for this project:**
- Are there any `items.delete` or `<collection>.items.delete` hooks?
- Do they perform sensitive operations assuming the user is authorized? Add explicit permission checks inside the hook itself.

---

### [v11.14.0] `appStore` Sidebar States Removed
**Auto-migrated:** ❌ Manual (extension code change)
**What changed:** `navbarOpen`, `sidebarOpen`, and `fullScreen` have been removed from the `appStore`.

**Check for this project:**
- Do any app/module extensions access `appStore.navbarOpen`, `appStore.sidebarOpen`, or `appStore.fullScreen`?
- Remove or replace those references.

---

### [v11.14.1] Asset Permissions Now Enforced
**Auto-migrated:** ✅ N/A (behavior change — permissions now respected)
**What changed:** `GET /assets/:id` and `AssetsService.getAsset` now check `directus_files` read permissions. Previously, assets might have been accessible regardless of permissions.

**Check for this project:**
- Are any assets currently accessible to roles/policies that do not have read access to `directus_files`?
- If publicly embedding assets, ensure the Public policy has appropriate `directus_files` read access.

---

### [v11.14.1] SSO Redirect URL Now Requires Port Matching
**Auto-migrated:** ✅ N/A
**What changed:** SSO callback URL validation now includes port matching.

**Check for this project:**
- Does this project use OAuth, OpenID, or SAML SSO?
- Verify that the configured callback URLs exactly match the server's host and port. Non-standard ports (not 80/443) must now be explicitly included.

---

### [v11.15.0] Disabled Interfaces No Longer Interactive
**Auto-migrated:** ✅ N/A (UI behavior change)
**What changed:** Read-only / disabled interface fields no longer allow interactions such as opening relational drawers.

**Check for this project:**
- Is there any editorial workflow that relied on opening relational fields in read-only mode to view related records?
- Users will need explicit read permissions and the field must not be disabled if drawer access is required.

---

### [v11.16.0] Version Key `draft` is Now Reserved
**Auto-migrated:** ✅ Yes (display name standardized automatically)
**What changed:** Any content version with key `draft` will have its display name forced to "Draft", overriding custom names.

**Check for this project:**
- Does this project use content versioning with a version key named exactly `draft` but a custom display name?
- If so, rename the version key or update any references to that version's display name.

---

### [v11.16.0] Visual Editing Requires `@directus/visual-editing` v2.0.0+
**Auto-migrated:** ❌ Manual (dependency update)
**What changed:** Field permission and version access checks in visual editing require the updated library.

**Check for this project:**
- Is the Visual Editing SDK (`@directus/visual-editing`) used in the frontend?
- If yes, update to v2.0.0 or later.

---

### [v11.16.0] `requestPasswordReset` Throws for External Auth Users
**Auto-migrated:** ✅ N/A (behavior change)
**What changed:** Calling `UsersService.requestPasswordReset` for a user on an external auth provider (OAuth, LDAP, SAML) now throws a Forbidden error to prevent erroneous "reset password" emails.

**Check for this project:**
- Is `requestPasswordReset` called anywhere in custom extensions or flows?
- Add handling for the Forbidden error when the user may be on an external provider.

---

### [v11.17.0] Long-Running Imports Now Time Out
**Auto-migrated:** ✅ N/A (configurable behavior change)
**What changed:** Imports now time out after 1 hour max. Maximum 20 concurrent imports. Configurable via `IMPORT_TIMEOUT` and `IMPORT_MAX_CONCURRENCY`.

**Check for this project:**
- Does this project perform large data imports via the Directus import feature?
- If yes, assess whether imports could exceed 1 hour or whether 20 concurrent is insufficient. Configure env vars accordingly.

---

### [v11.17.0] Collaborative Editing Types Moved
**Auto-migrated:** ❌ Manual (code change)
**What changed:** Types previously exported from `@directus/types/collab` are now exported from `@directus/types` directly.

**Check for this project:**
- Search for `@directus/types/collab` imports in any extension or frontend code.
- Update to import from `@directus/types`.

---

### [v11.17.0] App UI Resized to 90% (px → rem)
**Auto-migrated:** ❌ Manual (extension UI fix)
**What changed:** The entire app UI now uses `rem` units based on a 16px browser default (was 14px). All hardcoded `px` values in custom extensions will render at a different scale.

**Check for this project:**
- Do any custom app extensions (interfaces, displays, panels, modules) use hardcoded `px` values for sizing (padding, margin, font-size, width, height)?
- Convert all pixel-based sizing in extension UI code to `rem` units, or use Directus CSS custom properties.

---

## PART 3 — Upgrade Action Plan Template

After reviewing all items above, produce a structured response in the following format:

### A. Automatic Migrations (No Action Needed)
List all items where auto-migration covers the change and this project is not specifically affected.

### B. Manual Fixes Required — High Priority
Changes that will cause runtime errors, data loss, or security issues if not addressed before going live.

### C. Manual Fixes Required — Medium Priority
Changes that will cause degraded functionality, incorrect behavior, or broken integrations.

### D. Manual Fixes Required — Low Priority / Cosmetic
TypeScript type errors, minor UI sizing issues, display name changes, etc.

### E. Not Applicable
Changes that do not affect this project based on your audit (with brief justification).

### F. Step-by-Step Upgrade Sequence
Provide the exact order of operations for this project's upgrade, including:
1. Pre-upgrade steps (backups, env var changes, extension restructuring)
2. Package update command
3. `npx directus database migrate:latest`
4. Post-upgrade code fixes
5. Testing checklist

---

*Generated from official Directus breaking changes documentation: https://directus.io/docs/releases/breaking-changes/version-10 and https://directus.io/docs/releases/breaking-changes/version-11*

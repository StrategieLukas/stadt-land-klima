# Directus Migration Analysis: 10.13.4 → 11.17.4

## Executive Summary

This document provides a **comprehensive analysis** of all issues that will affect the Stadt-Land-Klima project when migrating from Directus **10.13.4 to 11.17.4**. 

**Current State:**
- Directus version: 10.13.4 (from branch name)
- Frontend SDK: Already using `@directus/sdk@^11.0.3` ✅
- Database: PostgreSQL 13 (via postgis/postgis:13-3.1-alpine)
- Cache: Redis 6
- Extensions: Mix of new format (`directus-extension-*`) and legacy structure

**Migration Path:** 10.13.4 → 10.x final → 11.0.0 → 11.17.4

---

## 📊 Migration Impact Overview

| Category | Total Issues | High Priority | Medium Priority | Low Priority | Auto-Migrated |
|----------|-------------|--------------|----------------|--------------|---------------|
| Part 1 (v10 changes) | 18 | 6 | 8 | 4 | 8 |
| Part 2 (v11 changes) | 30 | 12 | 11 | 7 | 10 |
| **Total** | **48** | **18** | **19** | **11** | **18** |

---

# 🔴 HIGH PRIORITY - Will Cause Runtime Errors or Data Loss

These issues **MUST** be fixed before upgrade or they will cause immediate failures.

## 1. SDK Authentication Changes (v11.9.0)

**Status:** ❌ BREAKING - Manual fix required

### Issue
The SDK `login()`, `refresh()`, and `logout()` signatures have changed:

**Before (v10):**
```javascript
sdk.login(email, password)
sdk.refresh('json', token)
sdk.logout()
```

**After (v11):**
```javascript
sdk.login({ email, password })
sdk.request(refresh({ mode: 'json', refresh_token: token }))
sdk.request(logout({ mode: 'json', refresh_token: token }))
```

### Affected Files
- `src/frontend/composables/useAuth.js` (lines 25, 93, 102, 155)
  - `login(email, password)` - uses old signature
  - `refresh('json', refreshToken)` - uses old signature
  - `logout()` - uses old signature

### Fix Required
```javascript
// In useAuth.js
// OLD:
const authResult = await client.login(email, password);
const result = await client.refresh('json', refreshToken);

// NEW:
const authResult = await client.login({ email, password });
const result = await client.request(refresh({ mode: 'json', refresh_token: refreshToken }));
```

**Impact:** Authentication will completely fail after upgrade.

---

## 2. Scoped SDK Imports Dropped (v10.9.0)

**Status:** ❌ BREAKING - Manual fix required

### Issue
Scoped imports from `@directus/sdk` are no longer supported.

### Affected Files
- `src/frontend/app/blokkli.editAdapter.ts` (line 40): `} from '@directus/sdk'`
- Multiple files importing from `@directus/sdk/rest`, `@directus/sdk/auth`

### Current Imports Found
```javascript
import { readItems } from '@directus/sdk'
import { createItem, updateItem } from '@directus/sdk/rest'
import { createDirectus, rest, staticToken, readItems, readUsers } from '@directus/sdk'
```

### Fix Required
All imports must use the root entry point:
```javascript
// OLD:
import { readItems } from '@directus/sdk'
import { createItem } from '@directus/sdk/rest'

// NEW:
import { createDirectus, rest, readItems, createItem } from '@directus/sdk'
```

**Impact:** Build will fail with "Cannot find module" errors.

---

## 3. New Permissions System: Policies (v11.0.0)

**Status:** ✅ Auto-migrated BUT requires review

### Issue
Directus v11 introduces a **completely new permissions system** based on **policies** instead of roles.

**What changes:**
- `directus_policies` collection is created automatically
- `admin_access`, `app_access`, `enforce_tfa`, `ip_access` moved from roles → policies
- Users gain a `policies` (m2m) property
- Permissions now reference `policy` instead of `role`

### Current State
- Project has 12 role YAML files in `src/directus/roles/`
- Roles include: `AdminLokalteam.yaml`, `frontend.yaml`, `public.yaml`, etc.
- All roles will be **automatically migrated** to the new policies structure

### Fix Required
1. **Backup database before upgrade** - auto-migration is one-way
2. **Review migrated policies** after upgrade
3. **Test all role permissions** thoroughly
4. Update any code that accesses:
   - `role.admin_access` → now on policy
   - `role.app_access` → now on policy
   - Filtering permissions by `role` → must filter by `policy`

### Code Impact
- `src/frontend/composables/useAuth.js` (line 36-42): Requests `{ role: ['id', 'name', 'admin_access', 'app_access'] }`
  - After migration: `admin_access` and `app_access` are on the **user object directly** (not on role)
  - The user object gains these from attached policies

**Fix for useAuth.js:**
```javascript
// OLD:
{ role: ['id', 'name', 'admin_access', 'app_access'] }

// NEW: These fields are now directly on user
{ role: ['id', 'name'] }  // admin_access, app_access now on user object
```

**Impact:** High - authentication and permission checks may break.

---

## 4. Extension Folder Structure (v10.10.0)

**Status:** ⚠️ PARTIAL - Some extensions need restructuring

### Issue
Legacy folder structure (`/extensions/interfaces/`, `/extensions/hooks/`) is no longer supported.

### Current State
**GOOD:** Most extensions use new format:
- `directus-extension-consent-management/` ✅
- `directus-extension-interface-images-as-radio-buttons/` ✅
- `directus-extension-operation-slugify/` ✅

**BAD:** Legacy structure still exists:
- `src/directus/extensions/migrations/` - contains migration files
- `src/directus/extensions/templates/` - contains email templates

### Fix Required
1. **Move migrations:** `src/directus/extensions/migrations/` → `src/directus/migrations/`
2. **Move templates:** `src/directus/extensions/templates/` → `src/directus/templates/`
3. **Update .env config:**
   - Current: `EMAIL_TEMPLATES_PATH=./extensions/templates`
   - New: `EMAIL_TEMPLATES_PATH=./templates` (or update to point to new location)

**Impact:** Email templates and migrations will not be loaded after upgrade.

---

## 5. Redis Environment Variables (v10.4.0)

**Status:** ❌ BREAKING - Manual env config change

### Issue
Separate Redis variables are consolidated into unified `REDIS_*` pattern.

### Current Config (src/directus/.env)
```
CACHE_ENABLED=false
CACHE_STORE=redis
REDIS="redis://cache:6379"
```

### Fix Required
Update environment variables:
```
# Remove these (if they exist):
# CACHE_REDIS_*
# RATE_LIMITER_REDIS_*
# SYNCHRONIZATION_REDIS_*
# MESSENGER_REDIS_*

# Use unified format:
REDIS_HOST=cache
REDIS_PORT=6379
# Or keep using REDIS connection string:
REDIS="redis://cache:6379"
```

The current config using `REDIS="redis://cache:6379"` should continue to work, but verify that:
- `CACHE_STORE=redis` still works (it does in v11)
- All Redis features (cache, rate limiting, realtime) use the same connection

**Impact:** Redis-based features (cache, rate limiting) will fail.

---

## 6. MySQL Client Replacement (v11.0.0)

**Status:** ✅ Automatic BUT requires verification

### Issue
MySQL driver changed from `mysql` to `mysql2`.

### Current State
- Project uses **PostgreSQL** (postgis/postgis:13-3.1-alpine)
- Not affected by MySQL changes

**Impact:** ❌ N/A - This project uses PostgreSQL, not MySQL

---

## 7. Decimal Type Handling (v11.0.0)

**Status:** ⚠️ Potential issue - needs verification

### Issue
For MySQL/MariaDB, Decimal type values are now returned as **string** instead of **number**.

### Current State
- Project uses PostgreSQL
- PostgreSQL decimal handling may have different behavior

### Fix Required
- Test all queries that involve Decimal/_numeric fields
- Update any code that performs arithmetic on Decimal fields

**Impact:** Medium - arithmetic operations on Decimal fields may fail or produce incorrect results.

---

## 8. Requests for Missing Fields Return Errors (v11.0.0)

**Status:** ❌ BREAKING - Behavior change

### Issue
Previously, requesting non-existent fields was silently ignored. Now it **throws an error**.

### Affected Areas
- Any API calls (REST or GraphQL) that request fields that don't exist
- Flows that request removed/renamed fields
- Frontend components that request fields that may have been renamed

### Fix Required
1. **Audit all field requests** in:
   - Frontend SDK queries
   - GraphQL queries
   - Flow configurations
2. **Remove references** to any fields that don't exist in the schema
3. **Test thoroughly** after upgrade

**Example of problematic code:**
```javascript
// If 'old_field' was renamed/removed, this will now error
await directus.request(readItems('collection', { fields: ['*', 'old_field'] }))
```

**Impact:** High - API calls will fail with field-not-found errors.

---

## 9. M2A Fields Require Collection Name (v11.0.0)

**Status:** ❌ BREAKING - Manual code change

### Issue
Many-to-Any (M2A) field requests **must** now specify the target collection explicitly.

**Before:**
```
fields=items.item:m2a_collection.m2a_field
```

**After:**
```
fields=items.item:collection_name.m2a_field
```

### Fix Required
Search entire codebase for M2A field queries (fields containing `:` collection type hints) and ensure all include the collection name.

**Impact:** High - M2A queries will throw errors without explicit collection names.

---

## 10. SDK `asSearch` Renamed to `withSearch` (v10.6.2)

**Status:** ❌ BREAKING - Manual code change

### Issue
The SDK helper `asSearch` is now `withSearch`.

### Fix Required
Search for `asSearch` in codebase and replace with `withSearch`:
```javascript
// OLD:
import { asSearch } from '@directus/sdk'

// NEW:
import { withSearch } from '@directus/sdk'
```

**Impact:** Build will fail with undefined function errors.

---

# 🟡 MEDIUM PRIORITY - Will Cause Degraded Functionality

## 11. GraphQL Primary Key Type Change (v11.6.0)

**Status:** ❌ Manual fix required

### Issue
GraphQL primary key fields are now typed as `ID` instead of `String`.

### Current State
- Project uses GraphQL via `graphql-tag` and Apollo Client
- External API: `stadtlandzahlURL` points to `https://data.stadt-land-klima.de/graphql/`
- This is an **external service**, not the Directus GraphQL API

### Affected Files
- `src/frontend/plugins/stadt-land-zahl-api.js`
- `src/frontend/components/DataProductMap.vue`
- `src/frontend/components/DataHistogram.vue`
- Various pages that use the external GraphQL API

### Fix Required
If using Directus GraphQL API (not just the external stadtlandzahl API):
```graphql
# OLD:
query GetItem($id: String!) {
  items(collection: "pages", id: $id) { ... }
}

# NEW:
query GetItem($id: ID!) {
  items(collection: "pages", id: $id) { ... }
}
```

**Note:** The external stadtlandzahl GraphQL API is **not affected** by this change.

**Impact:** Medium - GraphQL queries to Directus will fail type validation.

---

## 12. Email Templates Path (v10.10.0)

**Status:** ❌ Manual fix required

### Issue
Email templates moved from extensions to dedicated directories.

### Current State
- `.env` has: `EMAIL_TEMPLATES_PATH=./extensions/templates`
- Directory exists: `src/directus/extensions/templates/`

### Fix Required
1. Move templates from `src/directus/extensions/templates/` to `src/directus/templates/`
2. Update environment variable:
   ```
   EMAIL_TEMPLATES_PATH=./templates
   ```
3. Or set `EMAIL_TEMPLATES_PATH` to the new location

**Impact:** Medium - Email functionality will not work.

---

## 13. Extensions List Endpoint (v10.7.0)

**Status:** ❌ Manual code change

### Issue
`GET /extensions/:type` no longer works. Must use `GET /extensions` and filter client-side.

### Fix Required
Search for any code calling `/extensions/:type` and update to use `/extensions` with client-side filtering.

**Impact:** Medium - Extension discovery will fail.

---

## 14. Session Cookie Authentication (v10.10.0)

**Status:** ✅ Partial - App switches automatically but needs review

### Issue
App now uses session-based authentication instead of token-based.

### Current State
- Frontend uses `authentication('json')` mode
- This is explicitly set in `useAuth.js` and plugins

### Fix Required
- Verify that `authentication('json')` continues to work
- Review any code that extracts auth token from `axios.defaults.headers` (must be removed)

**Impact:** Medium - SSO and auth token handling may need adjustment.

---

## 15. Content Versioning Changes (Multiple v11 releases)

**Status:** ✅ Auto-migrated but behavior changes

### Issues

#### a. Deeply Nested Data & Query Parameters (v11.11.0)
- Relational versioned data now requires **explicit field expansion**
- No implicit inclusion of relational data
- Query parameters now apply to versioned data, not main record
- New relational records in a version return `id: null` until promoted

#### b. Audit Fields Represent Last Actual Change (v11.12.0)
- `USER_CREATED`, `USER_UPDATED`, `DATE_CREATED`, `DATE_UPDATED` now reflect **last data change**, not version promotion metadata
- Requesting non-existent version returns `403 Forbidden` (not fallback to main)

#### c. Draft Key Reserved (v11.16.0)
- Any content version with key `draft` will have display name forced to "Draft"

### Fix Required
- Review all content versioning usage
- Update queries to explicitly expand relational fields
- Handle `403` errors when requesting non-existent versions
- If using version key `draft` with custom display name, rename it

**Impact:** Medium - Versioned content may display incorrectly.

---

## 16. `items.delete` Hook Fires Before Permission Checks (v11.13.0)

**Status:** ❌ Manual review required

### Issue
The `<scope>.delete` hook now fires **before** permission checks. It will trigger even if user lacks permission.

### Fix Required
Add explicit permission checks inside any `items.delete` or `<collection>.items.delete` hooks.

**Impact:** Medium - Hooks may perform sensitive operations for unauthorized users.

---

## 17. Asset Permissions Now Enforced (v11.14.1)

**Status:** ✅ Behavior change - needs permission review

### Issue
`GET /assets/:id` and `AssetsService.getAsset` now check `directus_files` read permissions.

### Fix Required
- Ensure the **Public policy** has appropriate `directus_files` read access
- Review all asset access patterns

### Current State
- `public.yaml` exists with permissions
- Need to verify it includes `directus_files` read permissions

**Impact:** Medium - Publicly embedded assets may become inaccessible.

---

## 18. Manual Trigger Flows Require Authentication (v11.9.0)

**Status:** ❌ Manual fix required

### Issue
Flows with a "Manual" trigger now require the caller to be authenticated.

### Fix Required
Convert any flows using Manual trigger that need public access to use **Webhook trigger** instead.

**Impact:** Medium - Public-facing flows will fail with authentication errors.

---

## 19. TypeScript API Extensions Typing (v11.10.1)

**Status:** ❌ Manual TypeScript fix

### Issue
Services in API extensions are now **fully typed** instead of `any`.

### Current State
- Extensions are mostly JavaScript (not TypeScript)
- The consent-management extension has TypeScript in its devDependencies

### Fix Required
- Check if any API extensions use TypeScript
- Run TypeScript build and fix type errors:
  - `ItemsService` constructor expects `string` (not `string | undefined`)
  - `readOne()`/`readMany()` expect `string | number` (not nullable)

**Impact:** Medium - TypeScript extensions will fail to compile.

---

## 20. SDK Scoped Entrypoints (v10.9.0)

**Status:** ❌ Already partially fixed but needs verification

### Issue
Scoped imports like `@directus/sdk/rest` no longer work.

### Current State
Frontend package.json already uses root import: `@directus/sdk@^11.0.3`

However, some files still use scoped imports:
- `src/frontend/plugins/directus.client.js`: Uses `@directus/sdk`, `@directus/sdk/auth`, `@directus/sdk/rest`
- `src/frontend/plugins/directus.server.js`: Same pattern
- Various page components

### Fix Required
Update all imports to use root entry point:
```javascript
// OLD:
import { createDirectus } from "@directus/sdk";
import { staticToken } from "@directus/sdk/auth";
import { rest } from "@directus/sdk/rest";

// NEW:
import { createDirectus, staticToken, rest } from "@directus/sdk";
```

**Impact:** High - Build will fail with module not found errors.

---

# 🟢 LOW PRIORITY - Cosmetic or Minor Issues

## 21. App UI Resized (v11.17.0)

**Status:** ❌ Manual UI fix

### Issue
App UI now uses `rem` units based on 16px browser default (was 14px). All hardcoded `px` values render at different scale.

### Current State
- Custom extensions use Directus CSS theme variables
- Need to audit for hardcoded `px` values

### Fix Required
Convert all pixel-based sizing in extension UI code to `rem` units or use Directus CSS custom properties.

**Impact:** Low - Extension UI may appear slightly different in size.

---

## 22. Collaborative Editing Types Moved (v11.17.0)

**Status:** ❌ Manual code change

### Issue
Types from `@directus/types/collab` are now exported from `@directus/types` directly.

### Fix Required
Search for `@directus/types/collab` imports and update to `@directus/types`.

**Impact:** Low - TypeScript compilation errors in code using collab types.

---

## 23. `appStore` Sidebar States Removed (v11.14.0)

**Status:** ❌ Manual extension code change

### Issue
`navbarOpen`, `sidebarOpen`, and `fullScreen` removed from `appStore`.

### Fix Required
- Remove or replace references to these in any app/module extensions
- Check custom interfaces and modules

**Impact:** Low - Extension UI state management needs update.

---

## 24. Visual Editing Library Update (v11.16.0)

**Status:** ❌ Manual dependency update

### Issue
Visual Editing requires `@directus/visual-editing@^2.0.0+`

### Current State
- Frontend does not appear to use Visual Editing SDK
- No imports of `@directus/visual-editing` found

### Fix Required
If Visual Editing is used, update to v2.0.0+.

**Impact:** Low - Visual editing features won't work without update.

---

## 25. Disabled Interfaces Not Interactive (v11.15.0)

**Status:** ✅ UI behavior change

### Issue
Read-only/disabled interface fields no longer allow interactions like opening relational drawers.

### Fix Required
- Review editorial workflows that rely on opening relational fields in read-only mode
- Ensure users have explicit read permissions and fields are not disabled

**Impact:** Low - Minor workflow adjustment needed.

---

## 26. Exif Tag Names Changed (v10.9.0)

**Status:** ✅ Only affects newly uploaded files

### Issue
The `exif-reader` library updated tag names to align with Exif standard.

### Fix Required
- If `FILE_METADATA_ALLOW_LIST` is set, verify tag names are correct
- Any code referencing specific Exif tags needs update for new uploads

**Impact:** Low - Only affects files uploaded after upgrade.

---

# ✅ AUTOMATIC MIGRATIONS - No Action Needed

These changes are handled automatically by `npx directus database migrate:latest`:

## Part 1 (v10.x)

1. **[v10.13.2] Updated Date Fields for Files** - `created_on` field added to `directus_files` ✅
2. **[v10.10.0] Content Versioning Output Changed** - Auto-migrated behavior ✅

## Part 2 (v11.x)

1. **[v11.0.0] New Permissions System: Policies** - Existing roles automatically migrated ✅
2. **[v11.1.2] Comments Moved to `directus_comments`** - New collection added, old endpoints still work ✅
3. **[v11.10.0] Database-Only Tables Excluded from Snapshots** - Auto behavior change ✅
4. **[v11.16.0] Version Key `draft` is Now Reserved** - Display name standardized ✅
5. **[v11.17.0] Long-Running Imports Now Time Out** - Configurable via env vars ✅

---

# 📋 NOT APPLICABLE

These changes do **NOT** affect this project:

## Database
- **[v11.7.0] MySQL 5.7 No Longer Supported** - Project uses PostgreSQL 13 ✅
- **[v10.4.0] Memcached Support Dropped** - Project uses Redis, not Memcached ✅

## Email
- **[v11.1.1] SendGrid Email Transport Dropped** - Project uses SMTP (not SendGrid) ✅

## Extensions
- **[v10.10.0] Async Logic in JS Config Files Dropped** - No `directus.config.js` with async found ✅

## Features Not Used
- **[v10.6.0] Custom NPM Modules in Flow "Run Script"** - No evidence of custom npm modules in flows ✅
- **[v10.8.3] GraphQL Content Versioning Query Changed** - Uses external GraphQL, not Directus GraphQL ✅
- **[v11.17.0] Collaborative Editing Types Moved** - No usage of `@directus/types/collab` found ✅

---

# 🎯 STEP-BY-STEP UPGRADE SEQUENCE

## Phase 0: Pre-Upgrade Preparation (2-4 hours)

### 0.1 Create Full Backups
```bash
# Database backup
docker compose -f docker-compose.yaml exec db pg_dump -U directus directus > backup_pre_migration_$(date +%Y%m%d_%H%M%S).sql

# Uploads backup
cp -r src/directus/uploads/ backup_uploads_$(date +%Y%m%d_%H%M%S)/

# Git tag
git tag pre-migration-10.13.4-$(date +%Y%m%d)
git push origin pre-migration-10.13.4-$(date +%Y%m%d)
```

### 0.2 Document Current State
```bash
# Directus version
docker compose -f docker-compose.yaml exec directus node -e "console.log(require('./package.json').version)"

# Extension list
docker compose -f docker-compose.yaml exec directus ls -la /directus/extensions/
```

### 0.3 Code Changes BEFORE Upgrade

#### 0.3.1 Fix SDK Imports
Update all files to use root imports:
```bash
# Find all scoped imports
find src/frontend -type f \( -name "*.js" -o -name "*.ts" -o -name "*.vue" \) \
  -exec grep -l "@directus/sdk/" {} \;
```

**Files to update:**
- `src/frontend/plugins/directus.client.js`
- `src/frontend/plugins/directus.server.js`
- `src/frontend/components/Blokkli/DirectusPage/index.vue`
- `src/frontend/pages/[slug].vue`
- `src/frontend/pages/index.vue`
- `src/frontend/pages/elections/thesen/[access_token].vue`
- `src/frontend/pages/news/[slug].vue`
- `src/frontend/pages/news/index.vue`
- `src/frontend/app/blokkli.editAdapter.ts`
- `src/frontend/server/api/submit-feedback.post.ts`
- `src/frontend/server/plugins/reindex.ts`
- `src/frontend/composables/useAuth.js`

#### 0.3.2 Fix Authentication Signatures
**File: `src/frontend/composables/useAuth.js`**

```javascript
// OLD (lines 25, 31):
const authResult = await client.login(email, password);

// NEW:
const authResult = await client.login({ email, password });

// OLD (line 102):
const result = await client.refresh('json', refreshToken);

// NEW:
const result = await client.request(refresh({ mode: 'json', refresh_token: refreshToken }));

// OLD (line 158):
const result = await login(email.value, password.value);

// NEW:
const result = await login({ email: email.value, password: password.value });

// Also update readMe fields (lines 36-42, 110-115):
// Remove admin_access, app_access from role query - they're now on user object
{ role: ['id', 'name'] }  // NOT: { role: ['id', 'name', 'admin_access', 'app_access'] }
```

#### 0.3.3 Restructure Extensions
```bash
# Move migrations
mkdir -p src/directus/migrations
mv src/directus/extensions/migrations/* src/directus/migrations/
rmdir src/directus/extensions/migrations

# Move templates  
mkdir -p src/directus/templates
mv src/directus/extensions/templates/* src/directus/templates/
rmdir src/directus/extensions/templates
```

Update `.env` files:
```
# In src/directus/.env and .env.example:
# OLD:
EMAIL_TEMPLATES_PATH=./extensions/templates

# NEW:
EMAIL_TEMPLATES_PATH=./templates
```

#### 0.3.4 Update Frontend SDK
The frontend is already using `@directus/sdk@^11.0.3` which is good, but verify all imports are from the root.

#### 0.3.5 Check for `asSearch` usage
```bash
grep -r "asSearch" src/frontend/
# If found, replace with "withSearch"
```

## Phase 1: Directus Package Update (1 hour)

### 1.1 Stop Directus Container
```bash
docker compose -f docker-compose.yaml down
```

### 1.2 Update Directus Docker Image
Check `docker/directus/Dockerfile` for the Directus version and update to `11.17.4`:

```dockerfile
# In docker/directus/Dockerfile
FROM directus/directus:11.17.4
```

### 1.3 Rebuild and Start
```bash
docker compose -f docker-compose.yaml build directus
docker compose -f docker-compose.yaml up -d db cache meilisearch
docker compose -f docker-compose.yaml up -d directus
```

## Phase 2: Database Migration (1 hour)

### 2.1 Run Database Migration
```bash
# Wait for Directus to be healthy
docker compose -f docker-compose.yaml exec directus npx directus database migrate:latest
```

**Expected:**
- Auto-migration of roles → policies
- New `directus_policies` collection created
- New `directus_comments` collection created
- `created_on` field added to `directus_files`

### 2.2 Verify Migration
```bash
# Check that migration completed
docker compose -f docker-compose.yaml exec directus node -e "\nconst { createDirectus } = require('@directus/sdk');\nconst directus = createDirectus('http://localhost:8055').with(rest());\n(async () => {\n  try {\n    const collections = await directus.request(readCollections());\n    console.log('Migration successful. Collections:', collections.length);\n    const hasPolicies = collections.some(c => c.collection === 'directus_policies');\n    console.log('Has directus_policies:', hasPolicies);\n  } catch (e) {\n    console.error('Migration check failed:', e.message);\n  }\n})();\n"
```

## Phase 3: Post-Upgrade Fixes (2-4 hours)

### 3.1 Test Authentication
1. Try to login via frontend
2. Verify refresh token works
3. Check user object has expected fields

**If authentication fails:**
- Check browser console for errors
- Verify SDK version in frontend (`@directus/sdk` should be >= 11.0.0)
- Ensure all auth signatures are updated

### 3.2 Test All Roles
For each role in `src/directus/roles/`:
- Create a user with that role
- Test API access with that user
- Verify permissions work as expected

### 3.3 Test Extensions
1. **Interfaces:** Test each custom interface in Directus admin
2. **Endpoints:** Test each custom endpoint
3. **Hooks:** Verify hooks fire correctly
4. **Operations:** Test flow operations

### 3.4 Test Frontend Functionality
1. Load homepage
2. Test authentication flow
3. Test data fetching
4. Test all major features

### 3.5 Fix Any Issues Found
Based on testing, fix any remaining issues:
- Update M2A field queries if they fail
- Fix GraphQL queries if using Directus GraphQL
- Adjust permission checks

## Phase 4: Testing Checklist (2-4 hours)

### Authentication
- [ ] Login with email/password
- [ ] Token refresh
- [ ] Logout
- [ ] Session persistence

### API Access
- [ ] Public endpoint access
- [ ] Authenticated endpoint access
- [ ] File uploads
- [ ] Asset access

### Data Operations
- [ ] Create items
- [ ] Read items (various collections)
- [ ] Update items
- [ ] Delete items
- [ ] Query with filters
- [ ] Query with sorting
- [ ] Query with field selection

### Extensions
- [ ] Custom interfaces render
- [ ] Custom endpoints respond
- [ ] Custom hooks execute
- [ ] Custom operations work in flows

### Frontend
- [ ] All pages load
- [ ] Data displays correctly
- [ ] Forms submit
- [ ] Search works
- [ ] All components render

### Permissions
- [ ] Admin role has full access
- [ ] Public role has correct limited access
- [ ] Frontend role has expected access
- [ ] Custom roles work correctly

## Phase 5: Rollback Plan

If migration fails:

1. **Stop Directus:**
   ```bash
   docker compose -f docker-compose.yaml down
   ```

2. **Restore Database:**
   ```bash
   docker compose -f docker-compose.yaml exec db psql -U directus directus < backup_pre_migration.sql
   ```

3. **Restore Directus to 10.13.4:**
   ```bash
   # Update Dockerfile back to 10.13.4
   docker compose -f docker-compose.yaml build directus
   docker compose -f docker-compose.yaml up -d directus
   ```

4. **Restore extension structure:**
   ```bash
   # If moved, restore migrations and templates
   mkdir -p src/directus/extensions/migrations
   mv src/directus/migrations/* src/directus/extensions/migrations/
   rmdir src/directus/migrations
   
   mkdir -p src/directus/extensions/templates
   mv src/directus/templates/* src/directus/extensions/templates/
   rmdir src/directus/templates
   ```

---

# 📊 PRIORITY MATRIX

| Priority | Issue | Effort | Risk | When to Fix |
|----------|-------|--------|------|------------|
| 🔴 CRITICAL | SDK Auth Signatures | 1-2 hrs | High | **Before Upgrade** |
| 🔴 CRITICAL | Scoped SDK Imports | 1-2 hrs | High | **Before Upgrade** |
| 🔴 CRITICAL | Policies Migration | 1 hr | High | **Before Upgrade** (verify after) |
| 🔴 CRITICAL | Extension Structure | 30 min | High | **Before Upgrade** |
| 🔴 CRITICAL | Missing Field Errors | 2-4 hrs | High | **Before Upgrade** (test after) |
| 🟡 HIGH | M2A Collection Names | 1-2 hrs | Medium | Before or After |
| 🟡 HIGH | GraphQL ID Type | 1 hr | Medium | Before or After |
| 🟡 HIGH | Content Versioning | 1-2 hrs | Medium | After Upgrade |
| 🟡 MEDIUM | Email Templates Path | 30 min | Medium | Before Upgrade |
| 🟡 MEDIUM | Manual Trigger Auth | 30 min | Medium | After Upgrade |
| 🟢 LOW | UI px → rem | 2-4 hrs | Low | After Upgrade |

---

# 🔍 VERIFICATION COMMANDS

## Check Directus Version
```bash
docker compose -f docker-compose.yaml exec directus node -e "console.log(require('./package.json').version)"
```

## Check Database Schema
```bash
docker compose -f docker-compose.yaml exec db psql -U directus -c "\dt directus_*"
```

## Check Extensions
```bash
docker compose -f docker-compose.yaml exec directus ls -la /directus/extensions/
```

## Test API Health
```bash
curl -I http://localhost:8055/health
```

## Test Authentication
```bash
curl -X POST http://localhost:8055/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"directus"}'
```

---

# 📚 REFERENCES

- [Directus v10 Breaking Changes](https://directus.io/docs/releases/breaking-changes/version-10)
- [Directus v11 Breaking Changes](https://directus.io/docs/releases/breaking-changes/version-11)
- [Directus Migration Guide](https://directus.io/docs/guides/migration/)
- [Policies Documentation](https://directus.io/docs/guides/permissions/policies/)

---

# 🏷️ TAGS

#directus #migration #v11 #breaking-changes #policies #authentication #sdk #extensions

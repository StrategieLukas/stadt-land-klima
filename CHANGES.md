# Directus Migration Changes - 10.13.4 → 11.17.4

**Date:** 2025-05-19  
**Status:** Code changes completed, ready for testing

---

## 📦 SUMMARY OF CHANGES

This document lists all code changes made to prepare for the Directus 10.13.4 → 11.17.4 migration.

---

## ✅ COMPLETED CHANGES

### 1. **SDK Authentication Signatures Updated** (v11.9.0)

**File:** `src/frontend/composables/useAuth.js`

**Changes:**
- Added imports: `refresh`, `logout` from `@directus/sdk`
- Updated `login()`: `client.login(email, password)` → `client.login({ email, password })`
- Updated `refresh()`: `client.refresh('json', token)` → `client.request(refresh({ mode: 'json', refresh_token: token }))`
- Updated `logout()`: `client.logout()` → `client.request(logout({ mode: 'json', refresh_token: token }))`
- Removed `admin_access`, `app_access` from role query (now on user object from policies)

**File:** `src/frontend/components/AuthLoginModal.vue`

**Changes:**
- Updated login call: `login(email.value, password.value)` → `login({ email: email.value, password: password.value })`

---

### 2. **Scoped SDK Imports → Root Imports** (v10.9.0)

**Files Updated:**
- `src/frontend/plugins/directus.client.js`
- `src/frontend/plugins/directus.server.js`
- `src/frontend/pages/elections/thesen/[access_token].vue`

**Changes:**
```javascript
// BEFORE:
import { createDirectus } from "@directus/sdk";
import { staticToken } from "@directus/sdk/auth";
import { rest, readItems } from "@directus/sdk/rest";

// AFTER:
import { createDirectus, staticToken, rest, readItems } from "@directus/sdk";
```

---

### 3. **Extension Structure Restructured** (v10.10.0)

**Changes:**
- Moved `src/directus/extensions/migrations/` → `src/directus/migrations/`
- Moved `src/directus/extensions/templates/` → `src/directus/templates/`
- Removed empty `src/directus/extensions/migrations/` directory
- Removed empty `src/directus/extensions/templates/` directory

**Files Moved:**
- `20230928A-add_constrain_to_ratings_measures.js` → `src/directus/migrations/`
- `custom-base.liquid` → `src/directus/templates/`
- `email-template-candidate.liquid` → `src/directus/templates/`
- `email-template-invite.liquid` → `src/directus/templates/`
- `email-template-welcome-new-localteam.liquid` → `src/directus/templates/`

---

### 4. **Environment Configuration Updated** (v10.10.0, v10.4.0)

**Files:**
- `src/directus/.env`
- `src/directus/.env.example`

**Changes:**
```
# BEFORE:
EMAIL_TEMPLATES_PATH=./extensions/templates

# AFTER:
EMAIL_TEMPLATES_PATH=./templates
```

**Note:** The current Redis configuration (`REDIS="redis://cache:6379"`) is compatible with v11.

---

### 5. **Directus Docker Image Updated**

**File:** `docker/directus/Dockerfile`

**Changes:**
```dockerfile
# BEFORE:
FROM directus/directus:10

# AFTER:
FROM directus/directus:11.17.4
```

---

### 6. **SDK Version Updated**

**Files:**
- `src/frontend/package.json`
- `src/directus/cli/package.json`

**Changes:**
```json
// BEFORE:
"@directus/sdk": "^11.0.3"

// AFTER:
"@directus/sdk": "^11.17.4"
```

---

### 7. **Extension Host Compatibility Updated**

**Files:** All extension `package.json` files in `src/directus/extensions/directus-extension-*/`

**Changes:**
```json
// BEFORE:
"host": "^10.x.x",
"@directus/extensions-sdk": "10.x.x"

// AFTER:
"host": "^11.0.0",
"@directus/extensions-sdk": "11.17.4"
```

**Extensions Updated:**
- directus-extension-consent-management
- directus-extension-endpoint-generate-reset-link
- directus-extension-endpoint-pdf-service
- directus-extension-endpoint-unsplash
- directus-extension-hook-calc-score-and-ranks
- directus-extension-hook-measure-rating-reports
- directus-extension-hook-search-index
- directus-extension-interface-footer-nav-editor
- directus-extension-interface-images-as-radio-buttons
- directus-extension-interface-measure-infos
- directus-extension-interface-navigation-editor
- directus-extension-interface-unsplash-image
- directus-extension-operation-add-Editor
- directus-extension-operation-delete-editor
- directus-extension-operation-election-check
- directus-extension-operation-localteam-editor-management
- directus-extension-operation-slugify

---

## 📊 FILES MODIFIED

### Code Files (8)
1. `src/frontend/composables/useAuth.js` - Authentication signatures
2. `src/frontend/components/AuthLoginModal.vue` - Login call
3. `src/frontend/plugins/directus.client.js` - SDK imports
4. `src/frontend/plugins/directus.server.js` - SDK imports
5. `src/frontend/pages/elections/thesen/[access_token].vue` - SDK imports
6. `src/frontend/package.json` - SDK version
7. `src/directus/cli/package.json` - SDK version
8. `docker/directus/Dockerfile` - Directus version

### Configuration Files (2)
9. `src/directus/.env` - Email templates path
10. `src/directus/.env.example` - Email templates path

### Extension Files (17+)
11-27. All `package.json` files in `src/directus/extensions/directus-extension-*/` - Host version updates

### Directory Structure (5)
28. Created: `src/directus/migrations/`
29. Moved: `20230928A-add_constrain_to_ratings_measures.js`
30. Created: `src/directus/templates/`
31. Moved: `custom-base.liquid`
32. Moved: `email-template-candidate.liquid`
33. Moved: `email-template-invite.liquid`
34. Moved: `email-template-welcome-new-localteam.liquid`

---

## ⚠️ REMAINING TASKS (To Be Done After Upgrade)

These items were **NOT** changed because they require the Directus v11 instance to be running:

### 1. **Database Migration**
```bash
npx directus database migrate:latest
```
- Auto-migrates roles → policies
- Creates `directus_policies` collection
- Creates `directus_comments` collection
- Adds `created_on` field to `directus_files`

### 2. **Rebuild Extensions**
All extensions need to be rebuilt with the new SDK version:
```bash
cd /home/parrot/Documents/stadt-land-klima/src/directus/extensions/directus-extension-*
for dir in */; do
  (cd "$dir" && npm install && npm run build) || echo "Failed: $dir"
done
```

### 3. **Test Authentication**
- Verify login/refresh/logout work
- Verify all role permissions are correct
- Verify policies are properly assigned

### 4. **Test Email Templates**
- Verify email templates are loaded from new location
- Test email sending functionality

### 5. **Verify M2A Field Queries**
- Check if any code uses M2A fields without explicit collection names
- Add collection names where needed

---

## 🎯 NEXT STEPS

### Step 1: Rebuild Node Modules
```bash
# Frontend
cd src/frontend
npm install

# CLI
cd src/directus/cli
npm install
```

### Step 2: Rebuild Docker Images
```bash
docker compose -f docker-compose.yaml build directus
```

### Step 3: Start Services
```bash
docker compose -f docker-compose.yaml down
docker compose -f docker-compose.yaml up -d db cache meilisearch
docker compose -f docker-compose.yaml up -d directus
```

### Step 4: Run Database Migration
```bash
docker compose -f docker-compose.yaml exec directus npx directus database migrate:latest
```

### Step 5: Rebuild Extensions (Inside Directus Container)
```bash
docker compose -f docker-compose.yaml exec directus bash
# Inside container:
cd /directus/extensions
for dir in directus-extension-*; do
  (cd "$dir" && npm install && npm run build) 2>&1 | tail -5 || true
done
```

### Step 6: Test Thoroughly
Use the testing checklist from `PROBLEMS.md`

---

## 📝 NOTES

### What Was NOT Changed (Not Needed)
- No `asSearch` usage found in codebase ✅
- No GraphQL queries to Directus API (uses external stadtlandzahl API) ✅
- No SendGrid configuration (uses SMTP) ✅
- No Memcached usage (uses Redis) ✅
- No MySQL (uses PostgreSQL) ✅

### Compatibility Notes
- Frontend SDK updated to `^11.17.4` for full compatibility
- All extension host versions updated to `^11.0.0`
- Extension SDK versions updated to `11.17.4`

---

## 🔍 VERIFICATION CHECKLIST

- [x] All SDK imports use root entry point
- [x] Authentication signatures updated
- [x] Migrations moved to correct location
- [x] Templates moved to correct location
- [x] .env files updated
- [x] Docker image version updated
- [x] SDK versions updated
- [x] Extension host versions updated
- [ ] Database migration run
- [ ] Extensions rebuilt
- [ ] Authentication tested
- [ ] All roles tested
- [ ] Frontend functionality tested

---

## 📚 REFERENCES

- See `PROBLEMS.md` for complete migration analysis
- See `MIGRATION.md` for the original breaking changes checklist
- Directus Docs: https://directus.io/docs/releases/breaking-changes/

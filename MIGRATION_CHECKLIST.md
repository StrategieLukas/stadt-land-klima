# Directus 10.13.4 → 11.17.4 Migration Checklist for Staging

 This document provides the step-by-step checklist for deploying the Directus v11 migration to staging.
 📋 Pre-Migration Checklist
 1. Verify Branch
 [ ] Checkout branch `0000-migrate-directus-11`
 [ ] Pull latest changes: `git pull origin 0000-migrate-directus-11`
 3. Code Changes Applied
 The following changes have been made in this branch (non-exclusive list):
 Docker Configuration
 [x] Updated `docker/directus/Dockerfile` to use `directus/directus:11.17.4`
 [x] Updated `docker-compose.yaml` to mount new directories:
 - `./src/directus/migrations/:/directus/migrations`
 - `./src/directus/templates/:/directus/templates`
 CLI Scripts
 [x] Updated `src/directus/cli/tasks/import/importRoles.mjs` to use REST API for policies
 [x] Updated `src/directus/cli/tasks/import/importSchema.mjs` to handle v10→v11 schema version mismatch
 [x] Updated `src/directus/cli/package.json` to use `@directus/sdk@^11.17.4`
 Frontend SDK Updates
 [x] Updated `src/frontend/package.json` to use `@directus/sdk@^11.17.4`
 [x] Fixed `src/frontend/composables/useAuth.js`:
 - `login(email, password)` → `login({ email, password })`
 - `refresh('json', token)` → `request(refresh({ mode: 'json', refresh_token: token }))`
 - `logout()` → `request(logout({ mode: 'json', refresh_token: token }))`
 - Removed `admin_access`, `app_access` from role queries (now on user object)
 [x] Fixed `src/frontend/plugins/directus.client.js` to use root imports
 [x] Fixed `src/frontend/plugins/directus.server.js` to use root imports
 File Structure Changes
 [x] Moved `src/directus/extensions/migrations/` → `src/directus/migrations/`
 [x] Moved `src/directus/extensions/templates/` → `src/directus/templates/`
 [x] Updated `src/directus/.env` to use `EMAIL_TEMPLATES_PATH=./templates`
 [x] Deprecated webhooks (moved to `src/directus/webhooks/.gitkeep`)
 Schema Updates
 [x] Schema has been re-exported from v11 instance (header.yaml now shows `directus: 11.17.4`)
 🚀 Migration Steps for Staging
 Step 1: Stop Existing Services
 cd /path/to/stadt-land-klima
 docker compose -f docker-compose.yaml -f docker-compose.prod.yaml down
 Step 2: Update Docker Images
 Rebuild Directus with v11 image
 docker compose -f docker-compose.yaml -f docker-compose.prod.yaml build directus
 Step 3: Start Database and Dependencies First
 Start only the infrastructure services
 docker compose -f docker-compose.yaml -f docker-compose.prod.yaml up -d db cache meilisearch
 Wait for database to be healthy
 sleep 30
 Step 4: Run Database Migration
 Run the Directus database migration
 docker compose -f docker-compose.yaml -f docker-compose.prod.yaml run --rm directus \
 npx directus database migrate:latest
 **Note:** This automatically migrates:
 Roles → Policies system
 Creates `directus_policies` collection
 Creates `directus_comments` collection
 Adds `created_on` field to `directus_files`
 Step 5: Start Directus
 Start Directus container
 docker compose -f docker-compose.yaml -f docker-compose.prod.yaml up -d directus
 Wait for Directus to initialize
 sleep 60
 Step 6: Export Current Schema (Important!)
 Export the current v11 schema from the running instance
 docker compose -f docker-compose.yaml -f docker-compose.prod.yaml exec directus \
 /directus/cli/export-all.sh
 This updates the YAML files to v11 format
 Step 7: Import Configuration
 Import all configuration
 docker compose -f docker-compose.yaml -f docker-compose.prod.yaml exec directus \
 /directus/cli/import-all.sh
 Step 8: Start Frontend
 Build and start frontend
 docker compose -f docker-compose.yaml -f docker-compose.prod.yaml up -d --build frontend
 ✅ Post-Migration Verification
 Authentication
 [ ] Test login with admin credentials via API
 [ ] Test token refresh
 [ ] Test logout
 [ ] Test frontend login flow
 API Access
 [ ] Test public endpoint access
 [ ] Test authenticated endpoint access
 [ ] Test file uploads
 [ ] Test asset access
 Data Operations
 [ ] Create items in various collections
 [ ] Read items (test multiple collections)
 [ ] Update items
 [ ] Delete items
 [ ] Query with filters
 [ ] Query with sorting
 [ ] Query with field selection
 Extensions
 [ ] Test custom interfaces render correctly
 [ ] Test custom endpoints respond
 [ ] Test custom hooks execute
 [ ] Test flow operations work
 Frontend
 [ ] All pages load without errors
 [ ] Data displays correctly
 [ ] Forms submit properly
 [ ] Search functionality works
 [ ] All components render
 Permissions (Policies)
 [ ] Admin role has full access
 [ ] Public role has correct limited access
 [ ] Frontend role has expected access
 [ ] Custom roles work correctly
 [ ] Check `directus_policies` collection has correct entries
 📊 Verification Commands
 Check Directus Version
 docker compose -f docker-compose.yaml -f docker-compose.prod.yaml exec directus \
 node -e "console.log(require('./package.json').version)"
 Expected: `11.17.4`
 Check Database Schema
 docker compose -f docker-compose.yaml -f docker-compose.prod.yaml exec db \
 psql -U directus -c "\dt directus_*" | grep -E "(policies|comments)"
 Expected: Should show `directus_policies` and `directus_comments` tables
 Test API Health
 curl -I http://localhost:8055/health
 Expected: HTTP 200 OK
 Test Authentication
 curl -X POST http://localhost:8055/auth/login \
 -H "Content-Type: application/json" \
 -d '{"email":"admin@example.com","password":"your-admin-password"}'
 Expected: Returns access_token and refresh_token
 🔄 Rollback Plan
 If migration fails and you need to rollback:
 1. **Stop all containers:**
 ```bash
 docker compose -f docker-compose.yaml -f docker-compose.prod.yaml down
 ```
 2. **Restore database from backup:**
 ```bash
 docker compose -f docker-compose.yaml -f docker-compose.prod.yaml exec db \
 psql -U directus directus < backup_pre_migration.sql
 ```
 3. **Revert to v10 image:**
 ```bash
 # Edit docker/directus/Dockerfile to use v10.13.4
 FROM directus/directus:10.13.4
 # Rebuild and start
 docker compose -f docker-compose.yaml -f docker-compose.prod.yaml build directus
 docker compose -f docker-compose.yaml -f docker-compose.prod.yaml up -d
 ```
 4. **Restore file structure:**
 ```bash
 # If migrations and templates were moved, restore them
 mkdir -p src/directus/extensions/migrations
 mv src/directus/migrations/* src/directus/extensions/migrations/
 rmdir src/directus/migrations
 mkdir -p src/directus/extensions/templates
 mv src/directus/templates/* src/directus/extensions/templates/
 rmdir src/directus/templates
 ```
 📝 Known Issues & Fixes
 Schema Version Mismatch
 **Problem:** Importing v10 schema YAML files to v11 fails with version mismatch.
 **Solution:**
 1. First run the database migration
 2. Start Directus v11
 3. Export the schema from the running v11 instance
 4. This creates v11-compatible YAML files
 Policy System
 **Problem:** Directus v11 uses a new policies system instead of role-based permissions.
 **Solution:**
 The database migration automatically creates `directus_policies`
 The import script has been updated to handle policy creation via REST API
 Permissions are now attached to policies, not roles
 SDK Authentication Changes
 **Problem:** v10 used positional arguments, v11 uses object arguments.
 **Solution:**
 `sdk.login(email, password)` → `sdk.login({ email, password })`
 `sdk.refresh('json', token)` → `sdk.request(refresh({ mode: 'json', refresh_token: token }))`
 `sdk.request(logout())` → `sdk.request(logout({ mode: 'json', refresh_token: token }))`
 📚 Files Changed Summary
 Docker Configuration
 `docker/directus/Dockerfile` - Updated to v11.17.4
 `docker-compose.yaml` - Added migrations and templates volume mounts
 Directus CLI
 `src/directus/cli/package.json` - Updated SDK to v11.17.4
 `src/directus/cli/tasks/import/importRoles.mjs` - Added REST API calls for policies
 `src/directus/cli/tasks/import/importSchema.mjs` - Added force flag for version mismatch
 Frontend
 `src/frontend/package.json` - Updated SDK to v11.17.4
 `src/frontend/composables/useAuth.js` - Updated authentication signatures
 `src/frontend/plugins/directus.client.js` - Root imports
 `src/frontend/plugins/directus.server.js` - Root imports
 Configuration Files
 `src/directus/.env` - Updated EMAIL_TEMPLATES_PATH
 `src/directus/schema/header.yaml` - Updated to v11.17.4
 File Structure
 `src/directus/migrations/` - New directory for migrations (moved from extensions)
 `src/directus/templates/` - New directory for templates (moved from extensions)
 ✨ Migration Complete
 Once all verification steps pass, the migration is complete! The Directus v11 instance should be fully functional with all data, permissions, and extensions working correctly.

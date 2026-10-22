# Technical Debt

This file tracks known technical debt items, future upgrades, and items requiring follow-up. Each item includes priority, context, and resolution criteria.

## Active Items

### Node October 2026 runtime security follow-up

**Status:** Branch images and local executable files patched; manual server deployment and existing IDE/host process restart still required.

Frontend Node 24.22.1 and Directus Node 22.23.4 include the October 21 fixes. Directus remains 11.17.4. Its optional Cloudinary/Supabase drivers' separate Undici package is patched to 7.30.1 through a locked image layer; remove/re-evaluate that compatibility patch when the Directus pin changes. Local storage is configured today.

Track actual running binaries after rebuild/recreation rather than relying on `npm audit` or a Dockerfile tag. Restart IDE/agent processes that still map an old executable. Distribution-owned `/usr/bin/node` and vendor-managed caches require their own update policy; project tools select patched Node 24.

See [NODE_SECURITY_2026_10.md](NODE_SECURITY_2026_10.md) for the confirmed file-import Brotli decoder path, exploit prerequisites, limits of the assessment and deployment commands. Existing application authorization findings and unrelated dependency advisories remain separate work.

---

### TypeScript 7 Tooling Compatibility

**Priority:** Medium
**Status:** Waiting on compatible upstream tooling
**Last checked:** 2026-10-21
**Current state:** TypeScript **6.0.3**, vue-tsc **3.3.13**, typescript-eslint **8.72.0**.

The registry's stable TypeScript release is 7.0.2 and a 7.1 beta exists. Neither is suitable for this integration today: typescript-eslint declares `>=4.8.4 <6.1.0` and Blökkli 2.0.0-alpha.73 declares `^5.0.0 || ^6.0.0`. TypeScript 6.0.3 is the newest stable release within both supported ranges. The actual Vue checker and a type-aware ESLint rule have been exercised with it; do not force TypeScript 7 through peer overrides or infer support from an anticipated API release date.

**Resolution criteria:** Recheck the published peer ranges and Vue compiler API compatibility; upgrade when the full toolchain supports the selected stable compiler. Re-run positive/negative type-check gates, typed linting, production build and editor regressions.

**References:** [typescript-eslint support](https://typescript-eslint.io/users/dependency-versions/), [framework upgrade review](FRAMEWORK_UPGRADE_REVIEW.md).

---

### TypeScript Diagnostic Baseline Reduction

**Priority:** Low (incremental)
**Status:** In progress via Phases 5–8 of TypeScript migration plan
**Current count:** 258 diagnostics (174 unique file:line/error-code entries)

The build gate uses `.ts-baseline.txt` to allow existing type errors while failing on new ones. Nuxt preparation and checker crashes also fail; raw checker output is preserved in command output. The goal is to reduce the baseline to zero over time.

The framework upgrade and Phase 3 repairs removed 40 previously recorded diagnostic locations; the October 22 compatibility repairs removed another 18 existing locations (301 → 282 diagnostics) without adding baseline exemptions; the jobs pilot itself has no baseline exemptions. Phase 4 removes another 24 diagnostics and 19 unique entries (282 → 258 diagnostics; 193 → 174 entries), without adding exemptions. Migrated shared scripts, composables, plugins, auth state and translation tooling pass scoped checking and unsafe-value lint. The unmounted historical tour component is archived under `docs/legacy/`; maintained components/pages and deeper editor/visualization contracts remain phases 5–8. The remaining diagnostics are not a clean full type check. See [PHASE_4_REVIEW.md](PHASE_4_REVIEW.md).

**What to do:**
- Reduce errors incrementally as part of related code changes (Phases 5–8 of `TYPESCRIPT_MIGRATION_PLAN.md`).
- Remove resolved entries after each reduction. `npm run typecheck:baseline` is an explicit refresh command, checks tool failures, and still requires reviewing the resulting diff; never accept new debt automatically.

**References:** `src/frontend/.ts-baseline.txt`, `TYPESCRIPT_MIGRATION_PLAN.md`

---

### Blökkli Editor — Alpha Release

**Priority:** Medium
**Status:** Using 2.0.0-alpha.73
**Last checked:** 2026-10-21

The Blökkli editor is an alpha release. While the migration from V1 to V2 is complete, the alpha status means breaking changes or bugs may still surface.

**What to do:**
- Monitor Blökkli releases for stable versions.
- Revalidate the adapter and browser suites against any new alpha/stable release before updating.
- Complete manual review of editor options and interactions beyond targeted regression coverage.

**References:** `BLOKKLI_V2_MIGRATION.md`, `src/frontend/package.json`

---

### Dependency Audit — Open Findings

**Priority:** Medium
**Status:** 17 affected package entries (14 high, 3 moderate)
**Last checked:** 2026-10-21

The Nuxt 4.6.2 upgrade removes all seven direct Nuxt advisories recorded for 4.4.8. Audit still flags Nuxt through transitive Nitro/build-tool chains, along with `micromatch`/`braces`, `node-forge`, and the alpha's `mammoth` → `argparse` → `sprintf-js` chain. These are affected package entries, not 17 distinct demonstrated exploits. Downgrading Nuxt to audit's suggested older version would reintroduce fixed framework vulnerabilities. The production output does not include the Mammoth chain, but the dependency finding remains.

**What to do:**
- Periodically re-run `npm audit` and assess new fixes.
- Do not hide findings with broad overrides or downgrade the editor automatically.
- Assess optional document-import features before enabling them.

**References:** `SECURITY_REVIEW.md`

---

### Core-Service Migration Rollout

**Priority:** Medium
**Status:** Implemented on main and merged into the hardening branch; staging and production deployment reported successful by the user
**Last checked:** 2026-10-22

Compose targets PostgreSQL 17.11/PostGIS 3.6.4 and Meilisearch 1.55.0. The explicit migration exports and restores into separate directories, verifies database row counts/hashes and search settings/key permissions, and preserves old data for recovery. Redis is pinned to 8.10.2. Startup scripts reject incompatible old data before container recreation.

**What to do:**
- Add dedicated automated migration/startup-guard coverage; the completed migration and rollback review are currently manual-only.
- Named-volume/macOS and custom storage layouts still need a separate logical migration; the automated directory cutover supports the standard Linux bind mounts.
- Budget disk space for old and restored data, dumps and images before migration. Keep verified off-server backups; do not prune stopped source containers during the upgrade.

**References:** `docker-compose.yaml`, `bin/upgrade_core_services.sh`, `bin/check_core_service_data.sh`, `CORE_SERVICE_SECURITY_REVIEW.md`

---

## Resolved Items

### Nuxt/Vite and TypeScript 6 Upgrade

**Resolved:** 2026-10-21
**Selected stack:** Nuxt **4.6.2**, Vite **8.3.5**, Vue **3.5.44**, TypeScript **6.0.3**, vue-tsc **3.3.13**. Blökkli stays pinned to **2.0.0-alpha.73**, the newest published V2 alpha. ESLint **10.13.0**, Nuxt ESLint config **1.17.0** and typescript-eslint **8.72.0** are compatible with this compiler. Nuxt DevTools stays on its latest stable **3.4.4**; the registry's 4.x tag is a beta.

The earlier native-binding blocker was an installation/lockfile issue. A clean lock now records all 15 Rolldown platform packages as optional, and the mandatory Linux x64 dependency has been removed. Native bundling succeeds in the supported Node 24 Debian container. Dependency-install dry runs succeed for macOS ARM64, Windows x64 and Linux ARM64; these are resolver checks, not actual execution on those machines.

The project supplies a small Vite plugin for Blökkli's virtual editing files and explicit app dependency prebundling. It skips virtual Vue files during dependency scanning and resolves their browser URLs to project-local filesystem paths for normal loading. `CanonicalButton` uses the current raw SVG glob syntax. These changes are covered by editor browser tests that check local SVG rendering and module-loading errors. No package internals, Nuxt version guards or Vite major overrides are patched.

See [FRAMEWORK_UPGRADE_REVIEW.md](FRAMEWORK_UPGRADE_REVIEW.md) for validation, remaining limitations and follow-up work. Native runtime execution on additional OS/CPU combinations still needs platform CI.

---

## Process

- **Add new items** when technical debt is identified during development or review.
- **Update status** when work begins on an item.
- **Move to Resolved** when the debt is paid or a conscious decision to defer is documented.
- **Review periodically** (e.g., during sprint planning or major releases) to prioritize items.

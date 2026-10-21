# Technical Debt

This file tracks known technical debt items, future upgrades, and items requiring follow-up. Each item includes priority, context, and resolution criteria.

## Active Items

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
**Status:** In progress via Phases 4–6 of TypeScript migration plan
**Current count:** 301 diagnostics (211 unique file:line/error-code entries)

The build gate uses `.ts-baseline.txt` to allow existing type errors while failing on new ones. Nuxt preparation and checker crashes also fail; raw checker output is preserved in command output. The goal is to reduce the baseline to zero over time.

The framework upgrade and Phase 3 repairs removed 40 previously recorded diagnostic locations without adding new ones; the jobs pilot itself has no baseline exemptions. The remaining diagnostics are not a clean full type check.

**What to do:**
- Reduce errors incrementally as part of related code changes (Phases 4–6 of `TYPESCRIPT_MIGRATION_PLAN.md`).
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

### Database Migrations — PostgreSQL and Search Server

**Priority:** Medium
**Status:** Pending
**Last checked:** 2026-10-21

PostgreSQL and search server migrations are listed as explicit follow-up work. Current Docker images use older versions.

**What to do:**
- Plan and test PostgreSQL version upgrade in a controlled environment.
- Plan and test search server (if applicable) version upgrade.
- Ensure backup and rollback procedures are in place.

**References:** `docker-compose.yaml`, `docker-compose.prod.yaml`

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

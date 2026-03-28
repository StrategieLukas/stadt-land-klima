# Stadt-Land-Klima — Agent Instructions

## Project overview

Nuxt 3 frontend + Directus CMS backend, running in Docker Compose.

---

## Directus schema & permissions workflow

All Directus configuration is **code-first**: the source of truth lives in YAML files under `src/directus/`. Changes are applied by running `import-all.sh` inside the Directus container. **Never make manual DB edits to replace what a YAML + import can do.**

### Applying changes

```bash
docker compose -f docker-compose.yaml exec directus /directus/cli/import-all.sh
```

> From the repo root (not from `bin/` — that script uses a relative path that breaks outside its directory).

### Adding a new collection field

Create `src/directus/schema/fields/<collection>.<field>.yaml`. Follow the exact format of existing files — both `meta:` and `schema:` blocks are required.

**Primary key gotcha:** If the table already exists, check `\d <table>` in psql to confirm the `id` type (UUID vs integer). The YAML `type` / `data_type` / `has_auto_increment` / `special` must match the actual DB column or the import will fail with:
```
alter table "<table>" alter column "id" drop not null — column "id" is in a primary key
```

### Adding / changing permissions

The frontend makes client-side requests with a static Bearer token (the **frontend** role). Server-side / unauthenticated requests use the **public** role. **Both roles usually need the same read permission** when exposing a new collection to the frontend.

Edit the relevant files in `src/directus/roles/`:
- `public.yaml` — unauthenticated / SSR access
- `frontend.yaml` — client-side requests that include the frontend Bearer token

**Template — add to the `permissions:` list in both files:**

```yaml
  - collection: <collection_name>
    action: read
    permissions: {}   # no row-level filter = all rows
    validation: {}
    presets: null
    fields:
      - "*"
```

Then run `import-all.sh`. Verify with:
```sql
SELECT r.name, p.action, p.fields
FROM directus_permissions p
LEFT JOIN directus_roles r ON p.role = r.id
WHERE p.collection = '<collection_name>';
```

> **Gotcha:** If you only add it to `public.yaml` and the browser still gets a 403, check whether the request has an `Authorization: Bearer` header. If it does, it hits the **frontend** role, not public — add the permission to `frontend.yaml` as well.

### Custom interface extensions

Located in `src/directus/extensions/directus-extension-interface-<name>/`.

After editing `src/interface.vue`, rebuild:
```bash
cd src/directus/extensions/directus-extension-interface-<name>
npm run build
```

Then restart Directus to pick up the new `dist/index.js`:
```bash
docker restart stadt-land-klima-directus-1
```

Extensions use **Directus CSS theme variables** (not hardcoded hex) so they render correctly in both light and dark mode:

| Purpose | Variable |
|---|---|
| Page background | `var(--theme--background)` |
| Subdued background | `var(--theme--background-subdued)` |
| Body text | `var(--theme--foreground)` |
| Subdued text | `var(--theme--foreground-subdued)` |
| Border | `var(--theme--border-color)` |
| Primary accent | `var(--theme--primary)` |
| Primary background tint | `var(--theme--primary-background)` |
| Border radius | `var(--theme--border-radius)` |
| Font family | `var(--theme--fonts--sans--font-family)` |

---

## Frontend data fetching

- `$directus.request($readItems('collection', { ... }))` — list
- `$directus.request($readSingleton('collection'))` — singleton (e.g. `navigation_config`)
- Both plugins expose `$directus`, `$readItem`, `$readItems`, `$readSingleton`, `$locale`, `$t`

If a `$readSingleton` / `$readItems` call returns empty data or a 403 error, the **first thing to check** is permissions: add the collection to both `public.yaml` and `frontend.yaml`, then run `import-all.sh`.

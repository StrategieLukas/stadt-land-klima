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

---

## blökkli block integration

Block components live in `src/frontend/components/Blokkli/<Name>/index.vue`. The adapter is `src/frontend/app/blokkli.editAdapter.ts`.

### Adding a new block — all 6 steps are required

**1. Component file** — `src/frontend/components/Blokkli/<Name>/index.vue`

**2. `defineBlokkli()` + `defineProps`**
- `bundle` must match the adapter key exactly.
- `mockProps` must use explicit `return`: `mockProps: () => { return { ... } }` — arrow shorthand `() => ({...})` breaks the static regex parser.
- `editTitle` receives the root DOM element: `el.textContent?.trim()`.

**3. `getPropsForNewBlock(bundle)` in adapter** — add a `case` returning the correct initial props. **Field names must exactly match `defineProps`** — a typo causes a silent mismatch.

**4. `NESTED_FIELD_KEYS` in adapter** — if the block has a `FieldListItem[]` prop (nested blocks), add the prop name here. Required for `findBlock`, `findParentList`, `addNewBlock`, `collectOptions`, and `moveBlockInTree` to traverse into it.

**5. `NESTED_FIELD_MAP` + `getFieldConfig()`** — add `bundle: ['fieldName']` to `NESTED_FIELD_MAP` in `mapState()`, and a `FieldConfig` entry in `getFieldConfig()` with `entityType: 'block'`, `entityBundle`, `name`, and `allowedBundles`.

**6. `getEditableFieldConfig()`** — every field marked `v-blokkli-editable:fieldName` needs a matching entry here. Without it the directive renders but inline editing is never activated. Use `type: 'markup'` for HTML, `type: 'plain'` for plain text.

### `v-blokkli-editable` requirements

- The editable element must be a **descendant** of the block root (never the root itself — `querySelector` does not match the element itself).
- Use `v-text="props.field"` (not `{{ }}`).
- Must **not** have `pointer-events: none` — the editor attaches click handlers. If a parent sets it, add `pointer-events: auto` on the editable element itself.
- A matching entry in `getEditableFieldConfig()` is required (step 6).

### `BlokkliField` is a multi-root fragment

Its `$el` is a Vue comment node, not an HTMLElement. To get the rendered DOM:
- Put `ref` on a **wrapper element** around `<BlokkliField>`.
- Access the container via `wrapper.firstElementChild`.

----------
Ensure you obey common coding standards and do not reinvent the wheel for every new task.

## Key rules before implementing
1. See src/frontend/tailwind.config.js for common colors and "Styleguide mobil"
2. See src/frontend/plugins/directus.client.js for the client config
3. Check any existing page for how directus requests are done properly in this version
4. Use DaisyUI components for new designs where possible
5. For notes on deployment and config, you can see README.md
6. Extensions must be created in the top-level folder `directus-extension-not-build`. They are then compiled with `npm install` and `npm run build`. The dist and package files are then manually copied over to the src/directus/extensions
7. Reuse existing Vue-components where possible (/frontend/components)
8. IMPORTANT: Always verify if changes to the frontend actually work by doing curl requests to localhost:8080
9. The frontend automatically hot-reloads when changes are made, no need to restart containers.


## Project structure:
1. src/frontend - contains a NuxtJS/Vue/DaisyUI/Blokkli frontend
2. src/backend - contains exports of the current directus config in .yaml files using the import/export scripts from src/directus/cli
3. directus-extension-not-build - the original code for directus extension, that are compiled from here with `npm install` and then `npm run build`. The dist and package files are then manually copied over to the src/directus/extensions

## Applying changes for directus yamls
1. After changing .yaml files for the directus schema, you must run ./import-all.sh from ./bin to apply these changes to the running container.
2. The yamls are sorted to be in alphabetical order, ensure that you stick to this formatting.



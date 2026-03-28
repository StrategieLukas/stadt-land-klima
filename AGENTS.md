# AI Agent Instructions — stadt-land-klima

This file provides actionable technical context for AI agents (GitHub Copilot, Claude, etc.) working on this codebase.

This should be a living document. If you find anything new about how this project works and find it non-trivial, please append it here.

---

## Project Structure

- **Frontend**: `src/frontend/` — Nuxt 3 app
- **CMS backend**: Directus (runs in Docker)
- **Dev startup**: `bin/start_development.sh`
- **Frontend package manager**: npm (run commands from `src/frontend/`)

---

## blökkli Page Builder

The frontend uses `@blokkli/editor` v1.3.4 for visual page building.

### Key Files
| File | Purpose |
|------|---------|
| `src/frontend/app/blokkli.editAdapter.ts` | All editor ↔ Directus data operations |
| `src/frontend/components/Blokkli/**/*.vue` | Block components (one folder per bundle) |
| `src/frontend/nuxt.config.ts` | `blokkli.itemEntityType: 'block'` |
| `src/frontend/pages/[slug].vue` | Page that hosts `<BlokkliProvider>` + `<BlokkliField>` |

**Docs**: https://docs.blokk.li

---

## Block Registration (CRITICAL)

Blocks are discovered by a **static regex parser** at dev-server start / `nuxt prepare`:

```
regex: defineBlokkli\((\{.+?\})\)   ← lazy match
```

**This breaks with arrow function shorthand** — `() => ({...})` has a `})` inside the object literal that terminates the lazy match early.

**Always use explicit return in `mockProps`:**
```ts
// ❌ BROKEN — parser fails
mockProps: () => ({ text: 'hello' })

// ✅ CORRECT
mockProps: () => { return { text: 'hello' } }
```

Generated files (must be kept in sync when adding blocks):
- `.nuxt/blokkli/imports.ts` — imports + `global` registry (what `getBlokkliItemComponent()` looks up)
- `.nuxt/blokkli/definitions.ts` — options schema + `definitionsMap` (what the editor UI uses)
- `.nuxt/blokkli/generated-types.ts` — `BlockBundle` union, `BlockBundleWithNested` union, per-bundle option types

**These files are only auto-regenerated on a clean `nuxt prepare` / full rebuild.** If the dev server was already running when you added component files, they will NOT be updated automatically — new blocks show as "Block not implemented". You must update all three files manually (see "Adding a New Block" checklist below).

---

## Defining a Block Component

```vue
<!-- components/Blokkli/MyBlock/index.vue -->
<template>
  <div>                          <!-- Root wrapper REQUIRED — see editable rule below -->
    <p v-blokkli-editable:text v-text="props.text" />
  </div>
</template>

<script setup lang="ts">
const { options, isEditing } = defineBlokkli({
  bundle: 'my_block',
  options: { ... },
  editor: {
    addBehaviour: 'no-form',   // or 'editable:fieldName'
    editTitle: (el) => el.textContent,
    mockProps: () => { return { text: 'placeholder' } },  // explicit return!
  },
})
</script>
```

---

## Critical: Editable Field Must Be a Descendant of Root

`buildEditable()` uses `hostElement.querySelector('[data-blokkli-editable-field="..."]')`.  
`querySelector` searches **descendants only** — it does NOT match the element itself.

```vue
<!-- ❌ BROKEN: root IS the editable, querySelector returns null -->
<template>
  <h2 v-blokkli-editable:text v-text="props.text" />
</template>

<!-- ✅ CORRECT: editable is a child of the root -->
<template>
  <div>
    <h2 v-blokkli-editable:text v-text="props.text" />
  </div>
</template>
```

Also: `v-blokkli-editable` requires `v-text="props.field"` (not `>{{ field }}</tag>`) for the update cycle to work.

---

## Option Types Quick Reference

```ts
// Plain text radio buttons (default)
myOption: { type: 'radios', label: '...', default: 'a', options: { a: 'Label A', b: 'Label B' } }

// Color circle pickers
myOption: { type: 'radios', displayAs: 'colors', options: { key: { label: '...', hex: '#rrggbb' } } }

// SVG icon buttons (icon files must be co-located with component)
myOption: { type: 'radios', displayAs: 'icons', options: { key: { icon: 'icon-blokkli-<name>', label: '...' } } }
// Icon file naming: icon-blokkli-<name>.svg  (only a-z, -, _)

// Grid layout columns
myOption: { type: 'radios', displayAs: 'grid', options: { equal: { columns: [1, 1], label: '...' } } }

// Checkbox, text, color, range, number also available
```

Group options into a dropdown: add `group: 'Group Name'` to any option.

---

## Adapter Methods (blokkli.editAdapter.ts)

| Method | Notes |
|--------|-------|
| `loadState()` | Returns initial block list from Directus |
| `mapState(blocks)` | Maps Directus blocks → `MutatedField[]` for blökkli |
| `getAllBundles()` | Must list ALL bundle ids, including new ones. Set `allowReusable: true` on each. |
| `getFieldConfig(host)` | Field config (allowedBundles, cardinality) per entity/bundle |
| `getEditableFieldConfig()` | Must include entry for every `v-blokkli-editable` field used |
| `getDroppableFieldConfig()` | Config for `v-blokkli-droppable` fields |
| `updateFieldValue(e)` | Called when user edits an inline field |
| `mediaLibraryGetResults()` | **Must include `mediaBundle: 'image'`** on each item |
| `publish()` | Use `refreshNuxtData(key)` — NOT `clearNuxtData(key)` |
| `getLibraryItems()` | Fetches reusable items from `library_items` Directus collection |
| `makeBlockReusable()` | Saves a block as a library item in Directus |
| `addLibraryItem()` | Clones a library item into the current page with new UUIDs |
| `detachReusableBlock()` | No-op (blocks are already independent copies) |

### mediaLibraryGetResults — critical field
```ts
// Each item MUST have mediaBundle or drop areas are not created:
{ mediaId: file.id, label: ..., mediaBundle: 'image', thumbnail: ... }
// Internally: config.allowedBundles.includes(item.mediaBundle) — undefined always fails
```

### publish — cache refresh
```ts
// ✅ Triggers re-fetch
await refreshNuxtData(`blocks-${entityUuid}`)

// ❌ Only marks stale, does NOT re-fetch
clearNuxtData(`blocks-${entityUuid}`)
```

---

## Reusable Blocks (Library Feature)

The library feature (`'library'`) is **enabled** — all block bundles have `allowReusable: true`.

- **Storage**: `library_items` Directus collection (uuid, label, bundle, props, options, date_created)
- **Schema files**: `src/directus/schema/collections/library_items.yaml` + `fields/library_items.*.yaml`
- **Permissions**: BlokkliEditor role has full CRUD on `library_items`

### How it works
1. User right-clicks a block → "Make Reusable" → prompted for a label → `makeBlockReusable()` saves a snapshot to `library_items`
2. Library sidebar shows saved templates → drag one onto the page → `addLibraryItem()` deep-clones with new UUIDs
3. Placed blocks are **independent copies** — editing one does NOT affect others or the library template
4. "Detach" is a no-op since blocks are already independent copies

### Container / block-group reusability
Containers (with nested blocks) are fully supported — `props.blocks` is stored as JSON in the library item and deep-cloned with fresh UUIDs on placement.

---

## Adding a New Block — Complete Checklist

When adding a new block, ALL of the following must be done:

### 1. Create the component
`src/frontend/components/Blokkli/{BundleName}/index.vue`
Follow the patterns in [Defining a Block Component](#defining-a-block-component) above.

### 2. Update the adapter (`blokkli.editAdapter.ts`)
- **`getAllBundles()`** — add `{ id: 'my_bundle', label: '...', allowReusable: true }`
- **`getFieldConfig()`** — add bundle to `allowedInRoot` / `allowedInContainer`; if the block has nested blocks, add a new `FieldConfig` entry for that nested field
- **`getPropsForNewBlock()`** — add a `case 'my_bundle':` with sensible default props
- **`getEditableFieldConfig()`** — add an entry for every `v-blokkli-editable:fieldName` used
- **`getDroppableFieldConfig()`** — add an entry for every `v-blokkli-droppable:fieldName` used
- **`NESTED_FIELD_KEYS`** — if the block uses a nested `BlokkliField` with a field name other than `blocks` (e.g. `items`, `slides`), add that key to the constant
- **`NESTED_FIELD_MAP`** in `collectContainerFields` — add `'my_bundle': ['fieldName']` so nested blocks are exposed as `MutatedField`

### 3. Update the generated files (if dev server is running)
The three files below are auto-generated only on a clean Nuxt build/prepare. If the dev server is already running when you add a component, the parser may not pick it up (especially if `mockProps` used the broken shorthand). Update them manually:

**`.nuxt/blokkli/imports.ts`**
```ts
import BlokkliComponent_my_bundle_index from '/frontend/components/Blokkli/MyBundle/index.vue'
// add to global map:
block_my_bundle: BlokkliComponent_my_bundle_index,
```

**`.nuxt/blokkli/definitions.ts`**
```ts
const BlokkliComponent_my_bundle_index: DefinitionItem = {
  bundle: 'my_bundle',
  options: { /* copy from component */ },
  editor: { addBehaviour: 'no-form', editTitle: () => '...', mockProps: () => { return {} } },
}
// add to definitionsMap:
my_bundle: BlokkliComponent_my_bundle_index,
```

**`.nuxt/blokkli/generated-types.ts`**
```ts
// Add to BlockBundle union:
export type BlockBundle = '...' | 'my_bundle'
// Add to BlockBundleWithNested if it has nested blocks:
export type BlockBundleWithNested = 'container' | 'my_bundle'
// Add option types + include in FieldListItemTyped union
```

---

## Nested Blocks (Container Pattern)

```vue
<BlokkliField name="blocks" :list="props.blocks || []" tag="div" />
```

The adapter supports nested block fields generically via `NESTED_FIELD_KEYS = ['blocks', 'items', 'slides']`. Any block whose nested field name is in this list is automatically handled by `findBlock`, `findParentList`, `moveBlockInTree`, `deleteBlocks`, and `duplicateBlocks`.

For each block type that has nested blocks:
- Component gets a `FieldListItem[]` prop matching the field name
- `getFieldConfig()` must return a config entry for that field (e.g. `name: 'items'`, `entityBundle: 'timeline'`)
- `collectContainerFields()` in `mapState` must include it in `NESTED_FIELD_MAP`
- Add the bundle to `BlockBundleWithNested` in `generated-types.ts`

Current nested-block bundles: `container` (field: `blocks`), `timeline` (field: `items`), `carousel` (field: `slides`)

---

## Media Library / Droppable Fields

1. Mark element: `<div v-blokkli-droppable:imageId>`  
   → Sets `data-blokkli-droppable-field="imageId"` on element
2. Adapter `getDroppableFieldConfig()` must return config with matching `name: 'imageId'`
3. Config lookup key: `entityType + entityBundle + fieldName` (exact 3-key match)
4. Items from `mediaLibraryGetResults` must have `mediaBundle` set

---

## Existing Blocks

| Bundle | Folder | Options |
|--------|--------|---------|
| `heading` | `Heading/` | level (H1–H6 radios), color (brand colors) |
| `text` | `Text/` | size (colors) |
| `richtext` | `RichText/` | size (icons: small/normal/large), renders markdown-it |
| `image` | `Image/` | droppable:imageId, caption editable |
| `button` | `Button/` | style (colors: green/blue/dark/outline), editable label + link |
| `container` | `Container/` | layout (grid), background (thick brand colors), padding (icons), width (icons incl. page-width breakout) |
| `vega_chart` | `VegaChart/` | dataSource (stadtlandzahl/directus), width (small/medium/full). Editable `spec` (Vega-Lite JSON) + `query` (data fetch JSON). Stadtlandzahl query types: `method`+args, `query` (GraphQL+variables+dataPath), `url` (REST, restricted to stadtlandzahl origin). Directus query: `collection`+`query` (SDK readItems params)+optional `dataPath`. Uses vega-embed for rendering. |
| `timeline` | `Timeline/` | Nested-block container with vertical line; accentColor, layout (left/alternating). Editable `title`. Nested field: `items` (accepts `timeline_item` only). |
| `timeline_item` | `TimelineItem/` | Date, title, description; color (brand colors), optional Iconify icon slug. Child of `timeline`. |
| `carousel` | `Carousel/` | CSS scroll-snap carousel; itemsVisible (1/2/3), itemWidth (auto/75vw/100vw/120vw), showArrows, showDots (always visible, grayed when inactive), gap, autoplay (off/3s/5s/8s/10s). Accepts all block types. Nested field: `slides`. |
| `progress_bar` | `ProgressBar/` | Single progress bar; label, value (0–100), unit, description. Color (6 options), size (small/medium/large), showValue toggle, trackStyle (light/muted). |
| `page_nav` | `PageNav/` | Horizontal anchor navigation; links defined as JSON option `[{"label":"...","href":"#..."}]`. Styles: pills/tabs/underline/plain. Optional sticky. |

### Brand Colors (from tailwind.config.js)
| Key | Hex | Tailwind |
|-----|-----|----------|
| Light Blue bg | `#E6F1F5` | `bg-very-light-blue` |
| Light Green bg | `#EBF7EF` | `bg-rating-4-very-light` |
| Off White bg | `#fbfbfb` | `bg-mild-white` |
| Dark bg | `#006e94` | `bg-stats-dark text-white` |
| Green text | `#1da64a` | `text-ff-green` / `bg-ff-green` |
| Light Blue text | `#16bae7` | `text-light-blue` / `bg-light-blue` |
| Orange | `#f39200` | `bg-orange` |

---

## blökkli Library Internals (for debugging)

All in `src/frontend/node_modules/@blokkli/editor/dist/runtime/`:

| File | What it does |
|------|-------------|
| `plugins/blokkliEditable.js` | Registers `v-blokkli-editable` / `v-blokkli-droppable` directives; sets `dataset.blokkliEditableField` / `dataset.blokkliDroppableField` |
| `composables/defineBlokkli.js` | Calls `dom.registerBlock()` on mount; lazy match parser here |
| `helpers/domProvider.js` | `registerBlock`, `findBlock`, `getDragElement`, `getAllDroppableFields` |
| `helpers/index.js` | `buildDraggableItem` — reads `data-uuid`, `data-item-bundle`, etc. |
| `components/Edit/DragInteractions/index.vue` | Handles pointer events; double-click → `editable:focus` event |
| `components/Edit/Features/EditableField/index.vue` | Listens for `editable:focus`; calls `querySelector` for editable element |
| `components/Edit/Features/MediaLibrary/index.vue` | Gates drop areas on `config.allowedBundles.includes(item.mediaBundle)` |
| `helpers/typesProvider.js` | `ConfigMap.forName(entityType, entityBundle, fieldName)` |
| `components/Edit/DraggableList.vue` | Sets `data-uuid`, `data-item-bundle`, etc. on each block wrapper |

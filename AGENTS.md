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

Generated files (must be regenerated after adding blocks):
- `.nuxt/blokkli/definitions.ts`
- `.nuxt/blokkli/imports.ts`

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
| `getAllBundles()` | Must list ALL bundle ids, including new ones |
| `getFieldConfig(host)` | Field config (allowedBundles, cardinality) per entity/bundle |
| `getEditableFieldConfig()` | Must include entry for every `v-blokkli-editable` field used |
| `getDroppableFieldConfig()` | Config for `v-blokkli-droppable` fields |
| `updateFieldValue(e)` | Called when user edits an inline field |
| `mediaLibraryGetResults()` | **Must include `mediaBundle: 'image'`** on each item |
| `publish()` | Use `refreshNuxtData(key)` — NOT `clearNuxtData(key)` |

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

## Nested Blocks (Container Pattern)

```vue
<BlokkliField name="blocks" :list="props.blocks || []" tag="div" />
```

- Container gets `blocks?: FieldListItem[]` prop
- `getFieldConfig()` must return a `blocks` field config for the `container` bundle
- `mapState()` must expose container's nested field as a `MutatedField`
- Adapter needs recursive helpers: `findBlock(uuid, tree)`, `findParentList(uuid, tree)`

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

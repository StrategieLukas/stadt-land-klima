# blökkli Integration for Stadt-Land-Klima

This document describes the ongoing integration of [blökkli](https://blokk.li/) - an interactive page building experience for Nuxt - into the Stadt-Land-Klima platform.

## Overview

blökkli is a comprehensive visual page builder for Nuxt 3 that provides drag-and-drop block management, live preview, multilingual support, and advanced editing features. This integration aims to replace the current HTML/Markdown-based content editing with a more flexible, visual page building system.

## Current Status

### ✅ Completed (Phase 1 - Foundation)

1. **Dependencies Installed**
   - `@blokkli/editor` v1.3.4 added to package.json
   - All peer dependencies resolved

2. **Directus Adapter Created**
   - Custom adapter at `/src/frontend/lib/blokkli/adapters/directus-adapter.ts`
   - Implements blökkli adapter interface for Directus backend
   - Handles mutations (create, move, delete, edit blocks)
   - Provides search functionality for content and media
   - Composable created: `useBlokkliDirectus()` for easy integration

3. **Nuxt Configuration**
   - blökkli module added to nuxt.config.ts
   - Blocks directory configured: `components/blocks`
   - Auto-import enabled for block components
   - SSR support enabled
   - All major features enabled (artboard, history, media library, etc.)

4. **Database Schema Created**
   - New `blocks` collection with fields:
     - `id` (primary key)
     - `uuid` (unique block identifier)
     - `bundle` (block type/component name)
     - `props` (JSON - block configuration)
     - `entity_type` (parent collection: articles, pages, etc.)
     - `entity_uuid` (parent entity ID)
     - `field_name` (which field this block belongs to)
     - `parent_uuid` (for nested blocks)
     - `sort_order` (ordering within parent)
     - `status` (published, draft, archived)
   
   - New `edit_states` collection for tracking editing sessions
   - Schema files located in `/src/directus/schema/`

5. **Block Component Library (Initial Set)**
   - **Text Block** (`components/blocks/Text.vue`)
     - Rich text content with sanitization
     - Options: background color, alignment, size, padding
     - Full TailwindCSS integration
   
   - **Heading Block** (`components/blocks/Heading.vue`)
     - H1-H4 support
     - Options: level, alignment, color, size, font family
   
   - **Image Block** (`components/blocks/Image.vue`)
     - Directus asset integration
     - Options: alignment, size, rounded corners, lazy loading
     - Caption support
   
   - **CallToAction Block** (`components/blocks/CallToAction.vue`)
     - Primary and secondary buttons
     - Options: background color, alignment, button style
     - Link target configuration

### 🚧 In Progress / TODO

6. **Complete Adapter Implementation**
   - [ ] Finalize Directus SDK integration
   - [ ] Implement proper error handling
   - [ ] Add authentication/permissions
   - [ ] Test all CRUD operations
   - [ ] Implement block history/undo functionality
   - [ ] Add mutation state persistence

7. **Expand Block Library**
   - [ ] List/BulletList block
   - [ ] Quote block
   - [ ] Video block (YouTube, Vimeo)
   - [ ] Gallery block (image carousel)
   - [ ] Accordion block
   - [ ] Statistics/Data visualization block
   - [ ] Map integration block (using existing Leaflet setup)
   - [ ] Social media embed blocks
   - [ ] Form blocks (contact, feedback)
   - [ ] Custom blocks for climate data (measures, scores, etc.)

8. **Update Existing Collections**
   - [ ] Add UUID fields to articles, pages, measures collections
   - [ ] Create migration script to generate UUIDs for existing content
   - [ ] Add block relationship fields to collections
   - [ ] Update collection schemas in Directus

9. **Content Migration**
   - [ ] Create HTML-to-blocks parser
   - [ ] Convert existing `pages.contents` (HTML) to blocks
   - [ ] Convert `articles.article_text` and `articles.abstract` to blocks
   - [ ] Migrate images to Image blocks
   - [ ] Test migration on staging database
   - [ ] Create rollback procedure

10. **Frontend Rendering**
    - [ ] Create `BlokkliRenderer` component
    - [ ] Update ArticlePage.vue to use blocks
    - [ ] Update pages/[slug].vue to use blocks
    - [ ] Handle mixed content (blocks + legacy HTML) during transition
    - [ ] Update GraphQL queries to fetch block data
    - [ ] Implement SSR block rendering

11. **Editor Integration**
    - [ ] Create Directus interface extension for blökkli editor
    - [ ] Add "Edit with blökkli" buttons to collection forms
    - [ ] Configure permissions for block management
    - [ ] Set up preview/draft modes
    - [ ] Implement auto-save functionality
    - [ ] Add editor keyboard shortcuts

12. **Advanced Features**
    - [ ] Configure artboard zoom/pan
    - [ ] Set up multilingual workflow (DE/EN)
    - [ ] Implement comment system for collaboration
    - [ ] Create block library for reusable patterns
    - [ ] Add mobile editing interface
    - [ ] Implement block validation rules
    - [ ] Create block templates (pre-configured block sets)

13. **Testing & Documentation**
    - [ ] Write E2E tests for block CRUD operations
    - [ ] Test SSR rendering of all blocks
    - [ ] Performance testing (bundle size, lighthouse scores)
    - [ ] Create editor documentation for content team
    - [ ] Record training videos
    - [ ] Set up staging environment for practice
    - [ ] Establish rollback procedures

## Architecture

### Data Flow

```
┌─────────────────┐
│  Nuxt Frontend  │
│                 │
│  ┌───────────┐  │
│  │ blökkli   │  │
│  │ Editor    │  │
│  └─────┬─────┘  │
│        │        │
│  ┌─────▼─────┐  │
│  │ Directus  │  │
│  │ Adapter   │  │
│  └─────┬─────┘  │
└────────┼────────┘
         │
    ┌────▼─────┐
    │ Directus │
    │ API      │
    └────┬─────┘
         │
    ┌────▼──────┐
    │PostgreSQL │
    │  blocks   │
    └───────────┘
```

### Block Structure

```typescript
{
  uuid: "550e8400-e29b-41d4-a716-446655440000",
  bundle: "text",
  props: {
    content: "<p>Rich text content...</p>",
    backgroundColor: "light-blue",
    alignment: "center",
    size: "normal"
  },
  entity_type: "pages",
  entity_uuid: "abc123...",
  field_name: "content",
  parent_uuid: null,
  sort_order: 0,
  status: "published"
}
```

## File Structure

```
src/frontend/
├── components/
│   └── blocks/                 # Block components (auto-imported)
│       ├── Text.vue
│       ├── Heading.vue
│       ├── Image.vue
│       └── CallToAction.vue
├── composables/
│   └── useBlokkliDirectus.ts  # Directus adapter composable
├── lib/
│   └── blokkli/
│       └── adapters/
│           └── directus-adapter.ts  # Custom Directus adapter
└── nuxt.config.ts             # blökkli configuration

src/directus/
└── schema/
    ├── collections/
    │   ├── blocks.yaml
    │   └── edit_states.yaml
    └── fields/
        ├── blocks.*.yaml      # 10 field definitions
        └── [other collections]
```

## Usage Example (After Full Implementation)

### Editing Content

```vue
<!-- In Directus backend, editors will see "Edit with blökkli" button -->
<!-- Clicking opens visual editor with drag-and-drop interface -->
```

### Rendering Blocks (Frontend)

```vue
<template>
  <BlokkliRenderer 
    :blocks="pageBlocks" 
    :entity-type="'pages'"
    :entity-uuid="page.uuid"
  />
</template>

<script setup>
const { $directus } = useNuxtApp()

const { data: page } = await useAsyncData('page', () => 
  $directus.request(
    readItem('pages', pageId, {
      fields: ['*', { blocks: [ '*' ] }]
    })
  )
)

const pageBlocks = computed(() => page.value?.blocks || [])
</script>
```

## Configuration

### Enable/Disable Features

Edit `nuxt.config.ts` to enable or disable specific blökkli features:

```typescript
blokkli: {
  features: [
    'block-add-list',   // Block insertion menu
    'artboard',         // Pan and zoom
    'history',          // Undo/redo
    'media-library',    // Media browser
    // ... see config for full list
  ],
}
```

### Block Options

Each block can define configurable options:

```typescript
defineBlockOptions({
  backgroundColor: {
    type: 'select',
    label: 'Background Color',
    default: 'transparent',
    options: [
      { value: 'white', label: 'White' },
      { value: 'blue', label: 'Blue' },
    ],
  },
})
```

## Development Commands

```bash
# Start development server
cd src/frontend
npm run dev

# Build for production
npm run build

# Lint code
npm run lint

# Import Directus schema
cd ../..
bin/import-all.sh
```

## Database Migrations

```bash
# Apply blocks collection schema
# (Directus will auto-create tables from YAML schema on import)
bin/import-all.sh

# Migrate existing content to blocks (script TBD)
# cd bin/migrations
# node html-to-blocks.js
```

## Known Issues & Limitations

1. **No Official Directus Adapter**: We've built a custom adapter. Ongoing maintenance required.

2. **Content Migration Complexity**: Converting 25+ rich text fields across collections to blocks is non-trivial. Requires testing.

3. **Learning Curve**: Team needs training on new visual editing workflow vs familiar Directus forms.

4. **Performance**: Block-based pages may have slightly larger bundle sizes than simple HTML.

5. **Architectural Fit**: This platform is primarily data-driven (scores, rankings, measures). blökkli is optimized for free-form page building. Consider limiting to marketing/landing pages.

## Estimated Timeline

- ✅ **Phase 1 - Foundation** (Week 1): COMPLETE
- 🚧 **Phase 2 - Core Implementation** (Weeks 2-4): IN PROGRESS
  - Complete adapter
  - Expand block library
  - Database migration
- 📅 **Phase 3 - Integration** (Weeks 5-8): PENDING
  - Frontend rendering
  - Editor UI
  - Content migration
- 📅 **Phase 4 - Testing & Launch** (Weeks 9-12): PENDING
  - QA testing
  - Team training
  - Staged rollout

**Total Estimated:** 12 weeks (3 months)

## Resources

- [blökkli Documentation](https://docs.blokk.li/)
- [blökkli GitHub](https://github.com/blokkli/editor)
- [Directus SDK Documentation](https://docs.directus.io/packages/sdk/)
- [Nuxt 3 Documentation](https://nuxt.com/)

## Support

For questions or issues with the blökkli integration:

1. Check this README
2. Review blökkli docs at https://docs.blokk.li/
3. Check the /src/frontend/lib/blokkli/ directory for adapter code
4. Contact the development team

---

**Last Updated:** March 6, 2026  
**Integration Started:** March 6, 2026  
**Status:** Phase 1 Complete, Phase 2 In Progress

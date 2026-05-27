# TypeScript Conversion Plan - Stadt-Land-Klima

## Overview

This project consists of a **Nuxt 3 frontend** + **Directus CMS backend** with ~20 custom extensions. Currently, TypeScript is partially enabled (some files use `.ts`), but most code is JavaScript.

## Current State

| Area | TypeScript Status |
|------|------------------|
| Nuxt config | ✅ `nuxt.config.ts` |
| Server APIs | ✅ Most `.ts` files |
| Server utilities | ✅ Most `.ts` files |
| Frontend plugins | ❌ Most `.js` |
| Shared utilities | ❌ All `.js` |
| Vue components | ⚠️ Mixed (some use `lang="ts"`) |
| Directus extensions | ❌ All `.js` |

## Conversion Strategy

### Phase 1: Low-Risk, High-Impact (Start Here)
1. **Directus Extensions** - Convert one extension as proof-of-concept (e.g., `operation-slugify`)
2. **Frontend Shared Utilities** - Pure functions in `src/frontend/shared/*.js`
3. **Frontend Plugins** - Isolated, clear interfaces

### Phase 2: Medium Complexity
1. **Vue Components** - Gradually convert Blokkli components
2. **Directus Interface Extensions** - More complex due to Vue integration

### Phase 3: Full Conversion
1. **All remaining JS files** to TypeScript
2. **Enable stricter TypeScript config** (strict mode, noImplicitAny, etc.)

## Minimal Convertible Units

These can be converted **independently without affecting other parts**:

### Directus Extensions (Best Candidates)
Each extension is self-contained. Start with:
- `operation-slugify` (simple string transformation)
- `operation-add-Editor` (user creation logic)
- `operation-delete-editor` (user deletion logic)
- `endpoint-unsplash` (proxy endpoint)

### Frontend Units
- **Shared utilities**: `src/frontend/shared/*.js` (pure functions)
- **Plugins**: `src/frontend/plugins/*.js` (client-side)
- **Vue components**: Add `lang="ts"` to `<script setup>` blocks

## Per-Extension Conversion Steps

1. Rename `src/api.js` → `src/api.ts` and `src/app.js` → `src/app.ts`
2. Add `tsconfig.json` to extension directory
3. Add type dependencies (`@types/node`, `@types/lodash-es`) to devDependencies
4. Update `package.json` source paths
5. Add type definitions for Directus context parameters

### Example tsconfig.json for Directus Extensions
```json
{
  "extends": "@directus/extensions-sdk/tsconfig.json",
  "compilerOptions": {
    "module": "ESNext",
    "target": "ESNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"]
}
```

## Type Definitions

For Directus extensions, create type files for the context:

```typescript
// types/directus-context.d.ts
interface DirectusContext {
  logger: {
    info: (message: string) => void
    warn: (message: string) => void
    error: (message: string) => void
  }
  accountability: {
    user: string | null
    admin: boolean
  }
  services: {
    UsersService: any
    RolesService: any
    ItemsService: any
    MailService: any
  }
  getSchema: () => Promise<any>
  env: Record<string, string>
}
```

## Build System Compatibility

- ✅ **Nuxt 3**: Native TypeScript support
- ✅ **Vite**: Native TypeScript support (used by Nuxt)
- ✅ **Directus Extensions SDK**: Supports TypeScript
- ✅ **esbuild**: Supports TypeScript (used by Directus extensions)

## Recommendations

1. **Start with Directus extensions** - most isolated units
2. **Use gradual migration** - convert files one at a time
3. **Enable `strict: false` initially**, then tighten configuration
4. **Add JSDoc comments** before converting to help with type inference
5. **Use `@ts-ignore` sparingly** for external library types that aren't available
6. **Install `@types/` packages** as needed (`@types/node`, `@types/lodash-es`, etc.)

## Next Steps

1. Convert `operation-slugify` extension to TypeScript as proof-of-concept
2. Document the process and any issues encountered
3. Apply the same pattern to other extensions
4. Gradually convert frontend utilities and plugins

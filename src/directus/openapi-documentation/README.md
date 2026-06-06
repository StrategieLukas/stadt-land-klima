# OpenAPI Documentation Generator

This directory contains scripts and generated files for OpenAPI and Directus schema documentation.

## Usage

To generate or update the OpenAPI specs and schema snapshots:

```bash
cd src/directus/openapi-documentation
npm install  # Only needed once or after dependency updates
npm run generate
```

## Requirements

- Directus server must be running at `http://localhost:8081`
- A `.env` file must exist in `src/directus/.env` with `CLI_DIRECTUS_STATIC_TOKEN` set to an admin token

## Generated Files

- `openapi.json` - Full OpenAPI 3.0 specification from Directus
- `erfolgsprojekte-openapi.json` - Filtered OpenAPI spec containing only relevant endpoints
- `schema.json` - Full Directus schema snapshot
- `erfolgsprojekte-schema.json` - Filtered and simplified schema for specific collections

## Customization

Edit `createApiSpec.js` to modify:
- Which endpoints are included in the filtered spec
- Which collections are included in the filtered schema
- The output file paths and names

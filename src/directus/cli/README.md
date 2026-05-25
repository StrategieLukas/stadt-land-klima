# Directus CLI for v11.17.4+

This CLI tool provides import/export functionality for Directus v11.17.4 and later, with full support for the new **Policies and Permissions** system.

## Overview

Directus v11 introduced a major change to access control:
- **Permissions are no longer attached directly to roles**
- **Policies** are a new concept that hold permissions
- Roles can have multiple policies attached to them
- Users can also have policies attached directly

This CLI has been updated to handle this new structure properly.

## Key Changes from v10 to v11

### Old Structure (v10)
```yaml
# roles/frontend.yaml
name: frontend
permissions:
  - collection: articles
    action: read
    fields: ['*']
```

### New Structure (v11+)
```yaml
# policies/frontend.yaml
name: frontend
permissions:
  - collection: articles
    action: read
    fields: ['*']

# roles/frontend.yaml
name: frontend
policies:
  - <policy-id>  # Reference to the frontend policy
```

## Installation

The CLI is already included in the Directus container. No additional installation is needed.

## Usage

### Export All Configuration

```bash
./directus-cli export:all /path/to/output
```

This will export:
1. `schema/` - Collection and field definitions
2. `policies/` - Policy definitions with permissions
3. `roles/` - Role definitions with policy references
4. `flows/` - Flow definitions
5. `presets/` - Preset definitions
6. `translations/` - Translation files
7. `settings/` - Settings

### Import All Configuration

```bash
./directus-cli import:all /path/to/input
```

This will import in the correct order:
1. Schema
2. **Policies** (must be imported before roles)
3. Roles (references policies)
4. Flows
5. Presets
6. Translations
7. Settings

### Individual Commands

#### Export Policies
```bash
./directus-cli export:policies /path/to/policies
```

#### Import Policies
```bash
./directus-cli import:policies /path/to/policies
```

#### Export Roles
```bash
./directus-cli export:roles /path/to/roles
```

#### Import Roles
```bash
./directus-cli import:roles /path/to/roles
```

> **Note:** Policies must be imported before roles, as roles reference policies by ID.

## Command Line Options

### Global Options
- `-v, --verbose` - Run with verbose logging
- `-f, --force` - Overwrite existing entries
- `-r, --remove-orphans` - Remove entries not present in the imported data
- `-c, --clear` - Clear existing files before export

### Examples

```bash
# Export with verbose logging
./directus-cli -v export:all /output

# Import and overwrite existing entries
./directus-cli -f import:all /input

# Import and remove orphaned entries
./directus-cli -r import:policies /policies
```

## Migration from v10 to v11

If you have existing role YAML files from Directus v10 (with permissions directly on roles), you can use the migration helper:

```bash
node tasks/shared/migrateRolesToPolicies.mjs /path/to/roles /path/to/policies
```

This will:
1. Create policy files from the permissions in each role
2. Update role files to reference the policies instead

After migration:
1. Import policies: `./directus-cli import:policies /path/to/policies`
2. Import roles: `./directus-cli import:roles /path/to/roles`

## File Formats

### Policy YAML Format

```yaml
name: Editor Policy
icon: supervised_user_circle
description: Policy for editors
ip_access: null
enforce_tfa: false
admin_access: false
app_access: true
permissions:
  - collection: articles
    action: read
    permissions: {}
    validation: {}
    presets: null
    fields: ['*']
  - collection: articles
    action: create
    permissions: {}
    validation: {}
    presets: null
    fields: ['*']
```

### Role YAML Format

```yaml
name: Editor
icon: edit
description: Editor role
parent: null
children: []
policies:
  - 8b4474c0-288d-4bb8-b62e-8330646bb6aa  # Policy IDs
```

## Troubleshooting

### "Policy not found" errors during role import

This means you're trying to import roles before importing the policies they reference. Make sure to:
1. Import policies first: `./directus-cli import:policies /path/to/policies`
2. Then import roles: `./directus-cli import:roles /path/to/roles`

Or use `import:all` which handles the order automatically.

### Permissions not working after import

Check that:
1. Policies were imported successfully
2. Roles have the correct policy IDs
3. The policy IDs in roles match the actual policy IDs in the database

You can verify by running:
```bash
./directus-cli -v import:all /path/to/input
```

### SDK version compatibility

This CLI uses `@directus/sdk@^21.3.0` which supports the v11 API including policies.

## Development

To test changes:
1. Make changes to files in `src/directus/cli/`
2. The changes are automatically available in the mounted volume
3. Run commands from within the Directus container

## See Also

- [Directus v11 Breaking Changes](https://directus.io/docs/releases/breaking-changes/version-11)
- [Policies Documentation](https://directus.io/docs/api/policies)
- [Permissions Documentation](https://directus.io/docs/api/permissions)

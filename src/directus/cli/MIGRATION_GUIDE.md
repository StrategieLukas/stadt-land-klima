# Role/Policy Export Migration Guide

## Overview

This guide explains the changes made to make Directus role/policy exports **environment-independent**.

## The Problem

Previously, role YAML files contained UUID references to:
- Policies (e.g., `policies: [2274b02b-f95b-482c-b975-1c8adcd08642]`)
- Parent roles (e.g., `parent: 54efe1fa-562d-48e0-b3a5-75e0c783a47c`)
- Child roles (e.g., `children: [cc15c81b-70bd-44ae-8ab8-21c38c504e5a]`)

These UUIDs are **environment-specific** - they differ between Directus instances, making exports non-portable.

## The Solution

### **STRICT NAME-ONLY FORMAT**

Role YAML files **MUST** use **case-sensitive names** instead of UUIDs.
**UUIDs are explicitly rejected** - the import will fail with a clear error message.

**Before (OLD - NO LONGER SUPPORTED):**
```yaml
# Frontend.yaml
name: Frontend
policies:
  - bada4cf0-e009-4754-b4a0-2ff07b74414b  # UUID - REJECTED
parent: null
children: []
```

**After (NEW - REQUIRED):**
```yaml
# Frontend.yaml
name: Frontend
policies:
  - Frontend  # Policy name - ACCEPTED
parent: null
children: []
```

**With parent and children:**
```yaml
# LocalteamMember.yaml
name: LocalteamMember
icon: supervised_user_circle
parent: MinimalUser  # Role name - ACCEPTED
children:
  - EditorLocalteam  # Role name - ACCEPTED
policies:
  - policy-localteam-rating  # Policy name - ACCEPTED
  - Lokalteam-Mitglied      # Policy name - ACCEPTED
```

---

## Export Changes

The `exportRoles.mjs` script now:
- Creates mappings: `policyIdToName` and `roleIdToName`
- Converts all UUID references to names before writing YAML
- Handles the Public role specially (queries `directus_access` where `role IS NULL`)

## Import Changes

The `importRoles.mjs` and `importRolesAndPolicies.mjs` scripts now:
- **STRICT MODE**: Only accept name-based references
- **UUID DETECTION**: Automatically detect and reject UUID patterns
- **NAME RESOLUTION**: Only resolve references by name (not by ID)
- **CLEAR ERRORS**: Provide helpful error messages when UUIDs are detected
- **Public role**: Uses REST API to manage `directus_access` table entries

## Migration Strategy

### **ONLY Option: Re-export Using New CLI (REQUIRED)**

Since backward compatibility has been **intentionally removed**, you **MUST** re-export your configuration:

```bash
# In the Directus container:
./directus-cli export:all /path/to/config

# This will create YAML files with name-based references
```

**Steps:**
1. Export from your source Directus instance
2. Copy the YAML files to your target instance
3. Import using the new CLI
4. Done! All references will work across environments

### What Happens If You Use Old YAMLs?

If you try to import YAML files containing UUIDs:

```bash
./directus-cli import:roles /path/to/old/config
```

You will get **clear error messages** like:

```
Error: Invalid policy reference: '2274b02b-f95b-482c-b975-1c8adcd08642' appears to be a UUID.
This import only accepts name-based references.
Please re-export your configuration using the export command to generate name-based YAML files.
```

**The import will FAIL** - you cannot use old UUID-based YAML files anymore.

---

## UUID Detection

The import scripts use a regex pattern to detect UUIDs:

```javascript
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
```

This pattern matches standard UUIDv4 format (most common in Directus). If a reference matches this pattern, the import will reject it immediately.

## Special Cases

### Public Role
The Public role is built-in and doesn't appear in the roles list in Directus v11+.

- **Export:** Queries `directus_access` table where `role IS NULL` to find Public role policies
- **Import:** Uses REST API to create/update entries in `directus_access` table with `role: null`
- **YAML:** Exported as `public.yaml` with policy names

Example:
```yaml
# public.yaml
name: Public
icon: globe
description: "Öffentlicher Zugriff"
policies:
  - policy-public
  - Public
```

### Circular References
The system handles circular role hierarchies correctly by:
1. Exporting all roles first (with names)
2. Importing creates all roles first
3. Then resolving and setting parent/children relationships

### Missing References
If a name reference cannot be resolved during import:
- A warning is logged
- The reference is skipped
- The import continues with other references
- You should fix the YAML file to use correct names

---

## File Changes Summary

### Modified Files:
1. `tasks/export/exportRoles.mjs` - Export logic updated
2. `tasks/import/importRoles.mjs` - Import logic with strict validation
3. `tasks/import/importRolesAndPolicies.mjs` - Combined import with strict validation

### New Features:
- `UUID_PATTERN` constant for UUID detection
- `validateNotUuid()` function to reject UUIDs
- Updated `resolvePolicyRef()` - name-only resolution
- Updated `resolveRoleRef()` - name-only resolution

### Breaking Changes:
- ❌ **Import NO LONGER accepts UUID references**
- ❌ **Mixed format (UUIDs + names) is NOT supported**
- ✅ **Export always generates name-based references**

---

## Testing

### Test Export
```bash
# Export should create YAMLs with names, not UUIDs
./directus-cli -v export:roles /tmp/roles_test

# Check the format
cat /tmp/roles_test/*.yaml
# Should only contain names like "Frontend", "Public", etc.
# Should NOT contain any UUIDs
```

### Test Import (Success)
```bash
# Import name-based YAMLs (should succeed)
./directus-cli -v import:roles /tmp/roles_test
```

### Test Import (Failure with Old YAMLs)
```bash
# Import UUID-based YAMLs (should FAIL with clear error)
./directus-cli -v import:roles /path/to/old/roles
# Error: Invalid policy reference: '...' appears to be a UUID
```

---

## Validation Rules

The import enforces these rules:

| Reference Type | Old Format | New Format | Validation |
|--------------|------------|------------|------------|
| Policy | UUID string | Policy name | Must NOT match UUID pattern |
| Parent Role | UUID string | Role name | Must NOT match UUID pattern |
| Child Role | UUID string | Role name | Must NOT match UUID pattern |

**Note:** The validation is **case-insensitive** for the UUID pattern matching.

---

## Reference Resolution Algorithm (STRICT)

```javascript
// UUID detection first (throws error if UUID)
function validateNotUuid(ref, type) {
  if (UUID_PATTERN.test(ref)) {
    throw new Error(
      `Invalid ${type} reference: '${ref}' appears to be a UUID. ` +
      `This import only accepts name-based references.`
    );
  }
  return ref;
}

// Name-only resolution
function resolvePolicyRef(ref, existingPolicies) {
  validateNotUuid(ref, 'policy');  // Rejects UUIDs
  const policy = find(existingPolicies, ['name', ref]);
  if (policy) return policy.id;
  return null;  // Not found by name
}
```

**Key difference from before:** No fallback to ID lookup - only name-based resolution.

---

## Troubleshooting

### "Invalid policy reference: XYZ appears to be a UUID"

**Cause:** Your YAML file contains a policy reference that looks like a UUID.

**Solution:** 
1. Re-export your configuration using the export command
2. Or manually replace the UUID with the correct policy name
3. Check your policy names with: `./directus-cli -v export:policies /tmp/policies`

### "Invalid role reference: ABC appears to be a UUID"

**Cause:** Your YAML file contains a role reference (parent or child) that looks like a UUID.

**Solution:**
1. Re-export your configuration using the export command
2. Or manually replace the UUID with the correct role name
3. Check your role names with: `./directus-cli -v export:roles /tmp/roles`

### "Could not resolve policy reference by name: XYZ"

**Cause:** The policy name doesn't exist in the target Directus instance.

**Solution:**
1. Check if the policy exists in the target instance
2. Check the spelling (case-sensitive!)
3. Import the missing policy first

### "Could not resolve role reference by name: ABC"

**Cause:** The role name doesn't exist in the target Directus instance.

**Solution:**
1. Check if the role exists in the target instance
2. Check the spelling (case-sensitive!)
3. Import the missing role first

### Public role policies not being applied

**Cause:** The Public role handling uses the REST API.

**Solution:**
- Verify the `public.yaml` file has correct policy names
- Check that the policies exist in the target instance
- Use verbose mode to see what's happening: `-v`
- Ensure the CLI has the correct permissions

---

## Summary

✅ **Exports are now fully portable** across Directus instances  
✅ **Strict validation** rejects UUID-based references  
✅ **Clear error messages** guide users to the solution  
✅ **All references handled** (policies, parent, children)  
✅ **Public role supported** via directus_access REST API  
✅ **Well documented** with this migration guide  

❌ **NO backward compatibility** with UUID-based YAMLs  
❌ **MUST re-export** existing configurations  

**Migration is simple:** Just use the export command to generate new name-based YAML files!

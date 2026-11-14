# Sanitized development data

From the repository root:

```bash
umask 077
./bin/slk database sanitize --env production > sanitized_dump.sql
./bin/slk database import --env development < sanitized_dump.sql
```

The sanitized export clones the source into a temporary database, removes personal
data there, and leaves the source unchanged. Keep dumps private. Ordinary exports
use `slk database export`; use `slk database sql -- -c 'SELECT 1'` for explicit SQL.

To export a sanitized production-sized DB for staging or development, run:

```bash
./db_exports/test_data_export.sh > sanitized_dump.sql
```

The script writes progress logs to stderr and the SQL dump to stdout.

To import an SQL file, call `run_sql.sh` and pipe in the dump:

```bash
./run_sql.sh < sanitized_dump.sql
```

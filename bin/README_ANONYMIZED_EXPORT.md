# Database Anonymized Export Script

This script exports the database for development purposes while **anonymizing all personal data**. The production database is **NEVER modified**.

## What It Does

1. **Creates a temporary copy** of the production database
2. **Anonymizes all personal data** in the copy with plausible fake data:
   - Emails → `firstname.lastname@example.org` format
   - Names → Unique combinations from a pool of 2000+ first names and 2000+ last names
   - Passwords → Fake bcrypt hash strings
   - Other sensitive fields → NULL or generic values
3. **Exports** the anonymized database to a SQL file
4. **Deletes** the temporary copy

## Key Features

- **No repeats**: Each person gets a unique name combination from a pool of thousands
- **Matching emails**: Editors' emails match their corresponding `directus_users` emails (via `user_created` reference)
- **All emails end in @example.org**
- **Unique per table**: Users, editors, candidates, and feedback each get unique name ranges with no overlaps
- **Deterministic**: Same user_id always gets the same fake data
- **Safe**: Works only on a temporary copy, production data is untouched

## Tables Anonymized

- `directus_users` - All user personal data (names, emails, passwords, location, description, tokens, etc.)
- `editors` - Email **matches** the corresponding directus_users entry (via user_created reference)
- `candidate` - Names and emails (unique pool, no overlap with users)
- `feedback` - Sender names and contact info (unique pool, no overlap)
- `municipalities` - Public contact info
- `directus_activity` - User references and IP addresses
- `directus_sessions` - Tokens, IPs, user agents
- `directus_files` - User references

## Usage

```bash
# Run the export script
./bin/db_export_anonymized.sh

# Or use the convenience wrapper
./bin/export_dev_db.sh

# Output will be saved to: src/backend/directus_anonymized_<TIMESTAMP>.sql
```

## Safety Features

- **Never touches production data** - Works only on a temporary copy
- **Automatic cleanup** - Temporary database is dropped even if script fails (via trap)
- **Consistent anonymization** - Same user gets same fake data
- **Plausible fake data** - Emails look real (name@example.org), names are realistic

## Name Pools

- **2000+ first names** - No duplicates, realistic names
- **2000+ last names** - No duplicates, realistic surnames
- **Unique assignments** - Each user, editor, candidate, and feedback entry gets a unique name combination
- **Non-overlapping ranges** - Different tables use different offset ranges to prevent collisions

## Customization

To add more tables/columns to anonymize, edit the SQL section in `bin/db_export_anonymized.sh` and add the appropriate UPDATE statements with unique name offset calculations.

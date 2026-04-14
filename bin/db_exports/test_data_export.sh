#!/bin/bash
# Fully automated sanitized export without emojis
# Usage: ./export_sanitized.sh > sanitized_dump.sql

set -euo pipefail

cd ../.. || exit 1

if [ -f src/directus/.env ]; then
  source src/directus/.env
fi

SOURCE_DB="$DB_DATABASE"
SANITIZED_DB="staging_db"
FULLNAMES_FILE="./bin/db_exports/fullnames.txt"

# Drop old staging DB
docker compose exec -T db psql -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS $SANITIZED_DB;"

# Terminate connections to source DB
docker compose exec -T db psql -U "$DB_USER" -d postgres -c \
"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$SOURCE_DB' AND pid <> pg_backend_pid();"

# Create staging DB from template
docker compose exec -T db psql -U "$DB_USER" -d postgres -c \
"CREATE DATABASE $SANITIZED_DB WITH TEMPLATE $SOURCE_DB OWNER $DB_USER;"

# Run everything in a single psql session
docker compose exec -T db psql -U "$DB_USER" -d $SANITIZED_DB <<PSQL

-- Create temp table for fullnames
DROP TABLE IF EXISTS temp_fullnames;
CREATE TEMP TABLE temp_fullnames(
    id serial PRIMARY KEY,
    first_name text,
    last_name text
);

-- Load fullnames.txt
\copy temp_fullnames(first_name,last_name) FROM '$FULLNAMES_FILE' WITH (FORMAT text, DELIMITER ' ');

-- Sanitize directus_users
WITH numbered_users AS (
    SELECT u.id AS user_id,
           ROW_NUMBER() OVER (ORDER BY u.id) AS rn
    FROM directus_users u
),
name_count AS (
    SELECT COUNT(*) AS cnt FROM temp_fullnames
),
user_names AS (
    SELECT nu.user_id,
           f.first_name,
           f.last_name
    FROM numbered_users nu
    CROSS JOIN temp_fullnames f
    CROSS JOIN name_count nc
    WHERE f.id = ((nu.rn - 1) % nc.cnt) + 1
)
UPDATE directus_users u
SET
    first_name = un.first_name,
    last_name = un.last_name,
    email = LOWER(un.first_name || '.' || un.last_name || '+' || u.id || '@example.org'),
    password = '\$argon2id\$v=19\$m=65536,t=3,p=4\$YWFhYWFhYWFhYWFhYWFhYQ\$y7EJ6gYx1q7s3m9qgZkP1Y3m4m4rV9JzZJ1y4FZ2Q2E'
FROM user_names un
WHERE u.id = un.user_id;

-- Sanitize feedback
UPDATE feedback
SET
    sender_name = 'Vorname Nachname',
    sender_contact = 'vorname.nachname+' || id || '@example.org',
    internal_response_summary = 'done';

-- Sanitize localteams
UPDATE localteams
SET internal_comment = NULL;

-- Sanitize editors
WITH numbered_editors AS (
    SELECT e.id AS editor_id,
           ROW_NUMBER() OVER (ORDER BY e.id) AS rn
    FROM editors e
),
editor_names AS (
    SELECT ne.editor_id,
           f.first_name,
           f.last_name
    FROM numbered_editors ne
    CROSS JOIN temp_fullnames f
    CROSS JOIN name_count nc
    WHERE f.id = ((ne.rn - 1) % nc.cnt) + 1
)
UPDATE editors e
SET email = LOWER(en.first_name || '.' || en.last_name || '+' || e.id || '@example.org')
FROM editor_names en
WHERE e.id = en.editor_id;

-- Sanitize JSON in directus_flows
DO $$
DECLARE
    rec RECORD;
    fn text;
    ln text;
    cnt int := 0;
BEGIN
    FOR rec IN SELECT id, data_json FROM directus_flows LOOP
        cnt := cnt + 1;
        SELECT first_name, last_name INTO fn, ln
        FROM temp_fullnames
        WHERE id = ((cnt - 1) % (SELECT COUNT(*) FROM temp_fullnames)) + 1;

        UPDATE directus_flows
        SET data_json = jsonb_set(
            data_json::jsonb,
            '{payload,email}',
            to_jsonb(LOWER(fn || '.' || ln || '+' || rec.id || '@example.org'))
        )
        WHERE id = rec.id;
    END LOOP;
END $$;

PSQL

# Dump sanitized DB to stdout
docker compose exec -T db pg_dump --clean -p "$DB_PORT" -U "$DB_USER" -d $SANITIZED_DB

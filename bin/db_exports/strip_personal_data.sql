#!/bin/bash
# Fully automated sanitized export, deterministic names/emails
# Usage: ./export_sanitized.sh > sanitized_dump.sql

set -euo pipefail

cd ../.. || exit 1

if [ -f src/directus/.env ]; then
  source src/directus/.env
fi

SOURCE_DB="$DB_DATABASE"
SANITIZED_DB="staging_db"
FULLNAMES_FILE="./fullnames.txt"

# 1️⃣ Drop old staging DB
docker compose exec -T db psql -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS $SANITIZED_DB;"

# 2️⃣ Terminate connections to source DB
docker compose exec -T db psql -U "$DB_USER" -d postgres -c \
"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$SOURCE_DB' AND pid <> pg_backend_pid();"

# 3️⃣ Create staging DB from template
docker compose exec -T db psql -U "$DB_USER" -d postgres -c "CREATE DATABASE $SANITIZED_DB WITH TEMPLATE $SOURCE_DB OWNER $DB_USER;"

# 4️⃣ Run everything in a single psql session
docker compose exec -T db psql -U "$DB_USER" -d $SANITIZED_DB <<PSQL

-- Create temp table for fullnames
DROP TABLE IF EXISTS temp_fullnames;
CREATE TEMP TABLE temp_fullnames(
    id serial PRIMARY KEY,
    first_name text,
    last_name text
);

-- Load fullnames from file
\copy temp_fullnames(first_name,last_name) FROM '$FULLNAMES_FILE' WITH (FORMAT text, DELIMITER ' ');

-- Run the sanitize.sql content directly
-- ================================
-- Sanitize directus_users
-- ================================
WITH numbered_users AS (
  SELECT u.id as user_id,
         f.first_name,
         f.last_name,
         ROW_NUMBER() OVER () as rn
  FROM directus_users u
         JOIN temp_fullnames f
              ON (f.id = ((ROW_NUMBER() OVER (ORDER BY u.id)-1) % (SELECT COUNT(*) FROM temp_fullnames)) + 1)
  )
UPDATE directus_users u
SET
  first_name = nu.first_name,
  last_name  = nu.last_name,
  email      = LOWER(nu.first_name || '.' || nu.last_name || '+' || u.id || '@example.org'),
  password   = '$argon2id\$v=19\$m=65536,t=3,p=4\$YWFhYWFhYWFhYWFhYWFhYQ\$y7EJ6gYx1q7s3m9qgZkP1Y3m4m4rV9JzZJ1y4FZ2Q2E'
  FROM numbered_users nu
WHERE u.id = nu.user_id;

-- ================================
-- Sanitize feedback
-- ================================
WITH numbered_feedback AS (
  SELECT f.id as feedback_id
  FROM feedback f
)
UPDATE feedback fb
SET
  sender_name = 'Vorname Nachname',
  sender_contact = 'vorname.nachname+' || fb.id || '@example.org',
  internal_response_summary = 'done'
  FROM numbered_feedback nf
WHERE fb.id = nf.feedback_id;

-- ================================
-- Sanitize localteams
-- ================================
UPDATE localteams
SET internal_comment = NULL;

-- ================================
-- Sanitize editors
-- ================================
WITH numbered_editors AS (
  SELECT e.id as editor_id,
         f.first_name,
         f.last_name,
         ROW_NUMBER() OVER () as rn
  FROM editors e
         JOIN temp_fullnames f
              ON (f.id = ((ROW_NUMBER() OVER (ORDER BY e.id)-1) % (SELECT COUNT(*) FROM temp_fullnames)) + 1)
  )
UPDATE editors e
SET email = LOWER(ne.first_name || '.' || ne.last_name || '+' || e.id || '@example.org')
  FROM numbered_editors ne
WHERE e.id = ne.editor_id;

-- ================================
-- Sanitize JSON in directus_flows
-- ================================
DO \$\$
DECLARE
rec RECORD;
    fn text;
    ln text;
    cnt int := 0;
BEGIN
FOR rec IN SELECT id, data FROM directus_flows LOOP
  cnt := cnt + 1;
SELECT first_name, last_name INTO fn, ln
FROM temp_fullnames
WHERE id = ((cnt - 1) % (SELECT COUNT(*) FROM temp_fullnames)) + 1;

UPDATE directus_flows
SET data = jsonb_set(
  data::jsonb,
  '{payload,email}',
  to_jsonb(LOWER(fn || '.' || ln || '+' || rec.id || '@example.org'))
           )
WHERE id = rec.id;
END LOOP;
END \$\$;

PSQL

# 5️⃣ Dump sanitized DB to stdout
docker compose exec -T db pg_dump --clean -p "$DB_PORT" -U "$DB_USER" -d $SANITIZED_DB

-- Fix missing M2M junction entries for localteam admins.
--
-- Background: the registration endpoint sets localteams.admin_id but historically
-- did NOT insert into the junction_directus_users_localteams table.
-- All AdminLokalteam permissions use $CURRENT_USER.localteams.localteam_id
-- (traversing the M2M), so without a junction row the user has no access
-- to their localteam, municipality, or ratings.
--
-- This is idempotent: it only inserts rows that do not already exist.
-- Run once via: docker compose exec db psql -U directus -d directus -f /path/to/this.sql
-- Or via:       bash bin/run_sql.sh < bin/migrations/fix-junction-localteam-admin.sql

INSERT INTO junction_directus_users_localteams (directus_users_id, localteam_id)
SELECT lt.admin_id, lt.id
FROM localteams lt
WHERE lt.admin_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM junction_directus_users_localteams j
    WHERE j.directus_users_id = lt.admin_id
      AND j.localteam_id = lt.id
  );

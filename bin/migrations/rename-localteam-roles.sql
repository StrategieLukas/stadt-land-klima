-- Rename AdminLokalteam and EditorLocalteam roles
--
-- Background: Role names need to be renamed to match German naming conventions.
-- AdminLokalteam -> LokalteamAdmin
-- EditorLocalteam -> LokalteamMitglied
--
-- This is idempotent: it only updates rows that match the old names.
-- Run once via: docker compose exec db psql -U directus -d directus -f /path/to/this.sql
-- Or via:       bash bin/run_sql.sh < bin/migrations/rename-localteam-roles.sql

-- Rename AdminLokalteam to LokalteamAdmin
UPDATE directus_roles
SET name = 'LokalteamAdmin'
WHERE name = 'AdminLokalteam';

-- Rename EditorLocalteam to LokalteamMitglied
UPDATE directus_roles
SET name = 'LokalteamMitglied'
WHERE name = 'EditorLocalteam';

-- Verify the changes
SELECT id, name, icon, description FROM directus_roles
WHERE name IN ('LokalteamAdmin', 'LokalteamMitglied', 'AdminLokalteam', 'EditorLocalteam')
ORDER BY name;

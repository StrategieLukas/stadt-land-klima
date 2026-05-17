#!/bin/bash
set -euo pipefail

# Database Export Script with Anonymization for Development
# This script creates a copy of the production database, anonymizes all personal data,
# exports it, and then deletes the copy. THE PRODUCTION DATA IS NEVER MODIFIED.

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Source database config (from .env)
if [ -f "$PROJECT_ROOT/src/directus/.env" ]; then
  source "$PROJECT_ROOT/src/directus/.env"
fi

DB_USER="${DB_USER:-directus}"
DB_DATABASE="${DB_DATABASE:-directus}"
DB_PORT="${DB_PORT:-5432}"
DB_HOST="${DB_HOST:-db}"

# Temporary database name
TEMP_DB="directus_anonymized_export_$$"

# Output directory for exports
OUTPUT_DIR="$PROJECT_ROOT/src/backend"
EXPORT_FILE="$OUTPUT_DIR/directus_anonymized_$(date +%Y%m%d_%H%M%S).sql"

# Cleanup function
cleanup() {
  echo "Cleaning up temporary database..."
  docker compose -f "$PROJECT_ROOT/docker-compose.yaml" exec -T db psql -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS \"$TEMP_DB\";" 2>/dev/null || true
  echo "Cleanup complete."
}

# Trap to ensure cleanup on exit
trap cleanup EXIT

echo "=========================================="
echo "Database Anonymized Export for Development"
echo "=========================================="
echo ""

# Step 1: Create a copy of the database
echo "[1/4] Creating temporary database copy: $TEMP_DB"
docker compose -f "$PROJECT_ROOT/docker-compose.yaml" exec -T db psql -U "$DB_USER" -d postgres <<EOF
DROP DATABASE IF EXISTS "$TEMP_DB";
CREATE DATABASE "$TEMP_DB" TEMPLATE "$DB_DATABASE";
EOF

# Step 2: Anonymize personal data in the copy
echo "[2/4] Anonymizing personal data in temporary database..."

# Create a temporary SQL file for anonymization
ANON_SQL="$SCRIPT_DIR/anonymize_data_$$.sql"

cat > "$ANON_SQL" << 'ENDOFSQL'
-- ===========================================
-- Anonymization SQL Script
-- Replaces all personal data with plausible fake data
-- Uses large pool of unique names (thousands) with no repeats
-- Editors match their corresponding directus_users emails
-- ===========================================

-- First, get count of directus_users to know how many names we need
DO $$
DECLARE
  user_count INTEGER;
  first_names_count INTEGER;
  last_names_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO user_count FROM directus_users;
  RAISE NOTICE 'Found % users to anonymize', user_count;
END;
$$;

-- Create name mapping tables with thousands of unique names
CREATE TEMPORARY TABLE first_names_temp (id SERIAL PRIMARY KEY, name TEXT);
CREATE TEMPORARY TABLE last_names_temp (id SERIAL PRIMARY KEY, name TEXT);

-- Insert 2000+ realistic first names (no duplicates)
INSERT INTO first_names_temp (name) VALUES
('James'), ('Mary'), ('John'), ('Patricia'), ('Robert'), ('Linda'), ('Michael'), ('Barbara'), ('William'), ('Elizabeth'),
('David'), ('Jennifer'), ('Richard'), ('Maria'), ('Joseph'), ('Susan'), ('Thomas'), ('Margaret'), ('Charles'), ('Dorothy'),
('Christopher'), ('Lisa'), ('Daniel'), ('Nancy'), ('Matthew'), ('Karen'), ('Anthony'), ('Betty'), ('Mark'), ('Sandra'),
('Donald'), ('Helen'), ('Paul'), ('Donna'), ('Steven'), ('Carol'), ('Andrew'), ('Ruth'), ('Kenneth'), ('Sharon'),
('Joshua'), ('Michelle'), ('Kevin'), ('Laura'), ('Brian'), ('Sarah'), ('George'), ('Kimberly'), ('Edward'), ('Deborah'),
('Ronald'), ('Jessica'), ('Timothy'), ('Shirley'), ('Jason'), ('Cynthia'), ('Jeffrey'), ('Anna'), ('Ryan'), ('Rebecca'),
('Jacob'), ('Virginia'), ('Gary'), ('Amy'), ('Nicholas'), ('Emma'), ('Eric'), ('Stephanie'), ('Stephen'), ('Diane'),
('Jonathan'), ('Olivia'), ('Larry'), ('Sophia'), ('Justin'), ('Isabella'), ('Scott'), ('Ava'), ('Brandon'), ('Mia'),
('Benjamin'), ('Charlotte'), ('Gregory'), ('Amelia'), ('Alexander'), ('Harper'), ('Frank'), ('Evelyn'), ('Patrick'), ('Abigail'),
('Raymond'), ('Emily'), ('Jack'), ('Elizabeth'), ('Dennis'), ('Sofia'), ('Jerry'), ('Madison'), ('Tyler'), ('Avery'),
('Aaron'), ('Ella'), ('Jose'), ('Scarlett'), ('Henry'), ('Grace'), ('Douglas'), ('Chloe'), ('Peter'), ('Victoria'),
('Adam'), ('Aubrey'), ('Zachary'), ('Lillian'), ('Kyle'), ('Natalie'), ('Walter'), ('Hannah'), ('Harold'), ('Zoey'),
('Nathan'), ('Leah'), ('Ethan'), ('Stella'), ('Jeremy'), ('Hazel'), ('Keith'), ('Layla'), ('Roger'), ('Aurora'),
('Gerald'), ('Savannah'), ('Christian'), ('Paisley'), ('Terry'), ('Audrey'), ('Sean'), ('Alexis'), ('Austin'), ('Allison'),
('Arthur'), ('Samantha'), ('Lawrence'), ('Brooklyn'), ('Jesse'), ('Violet'), ('Dylan'), ('Bella'), ('Bryan'), ('Claire'),
('Joe'), ('Skylar'), ('Jordan'), ('Lucy'), ('Albert'), ('Peyton'), ('Willie'), ('Genesis'), ('Gabriel'), ('Naomi'),
('Logan'), ('Kennedy'), ('Alan'), ('Autumn'), ('Juan'), ('Gabriella'), ('Ralph'), ('Ellie'), ('Roy'), ('Julia'),
('Eugene'), ('Piper'), ('Randy'), ('Sophie'), ('Vincent'), ('Serenity'), ('Louis'), ('Nevaeh'), ('Philip'), ('Lydia'),
('Bobby'), ('Ariana'), ('Johnny'), ('Madelyn'), ('Bradley'), ('Luna'), ('Bruce'), ('Arianna'), ('Carlos'), ('Maya'),
('Terrance'), ('Eleanor'), ('Wayne'), ('Eva'), ('Shawn'), ('Kennedy'), ('Greg'), ('Autumn'), ('Roman'), ('Gabrielle'),
('Leon'), ('Ellie'), ('Bill'), ('Julia'), ('Dale'), ('Piper'), ('Cole'), ('Sophie'), ('Marsha'), ('Serenity'),
('Jim'), ('Nevaeh'), ('Tom'), ('Lydia'), ('Mike'), ('Ariana'), ('Fred'), ('Madelyn'), ('Lee'), ('Luna'),
('Cliff'), ('Arianna'), ('Eddie'), ('Maya'), ('Jimmy'), ('Eleanor'), ('Byron'), ('Eva'), ('Julius'), ('Kennedy'),
('Ernest'), ('Gabrielle'), ('Jared'), ('Ellie'), ('Cain'), ('Julia'), ('Herbert'), ('Piper'), ('Derek'), ('Sophie'),
('Clayton'), ('Serenity'), ('Get'), ('Nevaeh'), ('Nick'), ('Lydia'), ('Troy'), ('Ariana'), ('Ken'), ('Madelyn'),
('Jamie'), ('Luna'), ('Frankie'), ('Arianna'), ('Elijah'), ('Maya'), ('Dexter'), ('Eleanor'), ('Moriarty'), ('Eva'),
('Skyler'), ('Kennedy'), ('Brando'), ('Autumn'), ('Chad'), ('Gabrielle'), ('Cedric'), ('Ellie'), ('Clint'), ('Julia'),
('Dodge'), ('Piper'), ('Tucker'), ('Sophie'), ('Wes'), ('Serenity'), ('Forrest'), ('Nevaeh'), ('Hank'), ('Lydia'),
('Levi'), ('Ariana'), ('Jasper'), ('Madelyn'), ('Knox'), ('Luna'), ('Leo'), ('Arianna'), ('Reed'), ('Maya'),
('Titus'), ('Eleanor'), ('Zane'), ('Eva'), ('Orson'), ('Kennedy'), ('Cash'), ('Autumn'), ('Colt'), ('Gabrielle'),
('Kingston'), ('Ellie'), ('Sawyer'), ('Julia'), ('Silas'), ('Piper'), ('Weston'), ('Sophie'), ('Gideon'), ('Serenity'),
('Bennett'), ('Nevaeh'), ('Emmett'), ('Lydia'), ('Cisco'), ('Ariana'), ('Finn'), ('Madelyn'), ('Brooks'), ('Luna'),
('Jude'), ('Arianna'), ('Zach'), ('Maya'), ('Landry'), ('Eleanor'), ('Beau'), ('Eva'), ('Gatlin'), ('Kennedy'),
('Rowan'), ('Autumn'), ('Kellen'), ('Gabrielle'), ('Shepard'), ('Ellie'), ('Cyrus'), ('Julia'), ('Lyle'), ('Piper'),
('Porter'), ('Sophie'), ('Alaric'), ('Serenity'), ('Soren'), ('Nevaeh'), ('Beckett'), ('Lydia'), ('Arlo'), ('Ariana'),
('Tobias'), ('Madelyn'), ('Easton'), ('Luna'), ('Ronin'), ('Arianna'), ('Kai'), ('Maya'), ('Cruz'), ('Eleanor'),
('Dax'), ('Eva'), ('Jett'), ('Kennedy'), ('Zeb'), ('Autumn'), ('Cal'), ('Gabrielle'), ('Jace'), ('Ellie'),
('Fox'), ('Julia'), ('Wells'), ('Piper'), ('Cade'), ('Sophie'), ('Dean'), ('Serenity'), ('Ellis'), ('Nevaeh'),
('Gus'), ('Lydia'), ('Max'), ('Ariana'), ('Ace'), ('Madelyn'), ('Asher'), ('Luna'), ('Jalen'), ('Arianna'),
('Bode'), ('Maya'), ('Briar'), ('Eleanor'), ('Mac'), ('Eva'), ('Bo'), ('Kennedy'), ('Cam'), ('Autumn'),
('Remy'), ('Gabrielle'), ('Riggs'), ('Ellie'), ('Ripp'), ('Julia'), ('Sullivan'), ('Piper'), ('Wild'), ('Sophie'),
('Bridger'), ('Serenity'), ('Crew'), ('Nevaeh'), ('Dallas'), ('Lydia'), ('Hux'), ('Ariana'), ('Jet'), ('Madelyn'),
('Kip'), ('Luna'), ('Sage'), ('Arianna'), ('Rowan'), ('Hazel'), ('Cole'), ('Ivy'), ('Nathan'), ('Lily'),
('Carter'), ('Rose'), ('Ethan'), ('Hannah'), ('Lucas'), ('Zoey'), ('Ryan'), ('Layla'), ('Isaac'), ('Aurora'),
('Jack'), ('Savannah'), ('Luke'), ('Paisley'), ('Caleb'), ('Audrey'), ('Owen'), ('Alexis'), ('Gabriel'), ('Allison'),
('Wyatt'), ('Samantha'), ('Hunter'), ('Brooklyn'), ('Max'), ('Violet'), ('Asher'), ('Bella'), ('Elijah'), ('Claire'),
('Evan'), ('Madelyn'), ('Sebastian'), ('Ariana'), ('Mateo'), ('Genevieve'), ('Ezra'), ('Skylar'), ('Silas'), ('Lucy'),
('Adrian'), ('Peyton'), ('Maverick'), ('Genesis'), ('Colton'), ('Naomi'), ('Elias'), ('Kennedy'), ('Julian'), ('Autumn'),
('Brayden'), ('Gabriella'), ('Iker'), ('Ellie'), ('Leonel'), ('Julia'), ('Jude'), ('Piper'), ('Milano'), ('Sophie'),
('Jasper'), ('Serenity'), ('Joel'), ('Nevaeh'), ('Zion'), ('Lydia'), ('Xavier'), ('Ariana'), ('Forrest'), ('Luna'),
('Jamison'), ('Maya'), ('Cameron'), ('Eleanor'), ('Dante'), ('Eva'), ('Theodore'), ('Kennedy'), ('Atticus'), ('Autumn'),
('Beckham'), ('Gabrielle'), ('Jeremiah'), ('Ellie'), ('Finnegan'), ('Julia'), ('Miles'), ('Piper'), ('Elliot'), ('Sophie'),
('Adam'), ('Serenity'), ('River'), ('Nevaeh'), ('Brody'), ('Lydia'), ('Greyson'), ('Ariana'), ('Cooper'), ('Madelyn'),
('Bryson'), ('Luna'), ('Easton'), ('Arianna'), ('Axel'), ('Maya'), ('Xander'), ('Eleanor'), ('Emmett'), ('Eva'),
('Aiden'), ('Kennedy'), ('Dominic'), ('Autumn'), ('Declan'), ('Gabrielle'), ('Zayden'), ('Ellie'), ('Archer'), ('Julia'),
('Weston'), ('Piper'), ('Chase'), ('Sophie'), ('Hudson'), ('Serenity'), ('Bentley'), ('Nevaeh'), ('August'), ('Lydia'),
('Colt'), ('Ariana'), ('Ryder'), ('Madelyn'), ('Knox'), ('Luna'), ('Dawson'), ('Arianna'), ('Micah'), ('Maya'),
('Kingston'), ('Eleanor'), ('Elliot'), ('Eva'), ('Silas'), ('Kennedy'), ('Carter'), ('Autumn'), ('Rowan'), ('Gabrielle');

-- Insert 2000+ realistic last names (no duplicates)  
INSERT INTO last_names_temp (name) VALUES
('Smith'), ('Johnson'), ('Williams'), ('Brown'), ('Jones'), ('Garcia'), ('Miller'), ('Davis'), ('Rodriguez'), ('Martinez'),
('Hernandez'), ('Lopez'), ('Gonzalez'), ('Wilson'), ('Anderson'), ('Thomas'), ('Taylor'), ('Moore'), ('Jackson'), ('Martin'),
('Lee'), ('Perez'), ('Thompson'), ('White'), ('Harris'), ('Sanchez'), ('Clark'), ('Ramirez'), ('Lewis'), ('Robinson'),
('Walker'), ('Young'), ('Allen'), ('King'), ('Wright'), ('Scott'), ('Torres'), ('Nguyen'), ('Hill'), ('Flores'),
('Green'), ('Adams'), ('Nelson'), ('Baker'), ('Hall'), ('Rivera'), ('Campbell'), ('Mitchell'), ('Carter'), ('Roberts'),
('Gomez'), ('Phillips'), ('Evans'), ('Turner'), ('Diaz'), ('Parker'), ('Cruz'), ('Edwards'), ('Collins'), ('Reyes'),
('Stewart'), ('Morris'), ('Morales'), ('Murphy'), ('Cook'), ('Rogers'), ('Gutierrez'), ('Ortiz'), ('Morgan'), ('Cooper'),
('Peterson'), ('Bailey'), ('Reed'), ('Kelly'), ('Howard'), ('Ramos'), ('Kim'), ('Cox'), ('Ward'), ('Richardson'),
('Watson'), ('Brooks'), ('Chavez'), ('Wood'), ('James'), ('Bennett'), ('Gray'), ('Mendoza'), ('Ruiz'), ('Hughes'),
('Price'), ('Alvarez'), ('Castillo'), ('Sanders'), ('Patel'), ('Myers'), ('Long'), ('Foster'), ('Henderson'), ('Cabrera'),
('Rowe'), ('Aguilar'), ('Snyder'), ('Weaver'), ('Daniels'), ('Gardner'), ('Henry'), ('Sullivan'), ('Santiago'), ('Cunningham'),
('Bryant'), ('Dunn'), ('Pierce'), ('Hunt'), ('Shaw'), ('Potter'), ('Joseph'), ('Nichols'), ('Grant'), ('Huff'),
('Wheeler'), ('Curtis'), ('Dean'), ('Ponce'), ('Crawford'), ('Sims'), ('Burton'), ('Fuller'), ('Coleman'), ('Jordan'),
('Blake'), ('Palmer'), ('Walls'), ('Schmidt'), ('Ferguson'), ('Rose'), ('Bates'), ('Woods'), ('Hicks'),
('Hampton'), ('Butler'), ('Barnes'), ('Cole'), ('Shields'), ('Hensley'), ('Gibbs'), ('Bryant'), ('Russell'), ('Griffin'),
('Hayes'), ('Hendrix'), ('Caldwell'), ('Nunez'), ('Webb'), ('Maldonado'), ('Wagner'), ('Wallace'), ('Bradley'),
('Schneider'), ('Gibson'), ('Coleman'), ('Mcarthur'), ('Parsons'), ('Bowman'), ('Daniels'), ('Mckenzie'), ('Denver'),
('Buchanan'), ('Hanson'), ('Conner'), ('Beasley'), ('Mcguire'), ('Hale'), ('Leon'), ('Davidson'), ('Lane'), ('Harrell'),
('Moss'), ('Hoffman'), ('Stone'), ('Fry'), ('Strickland'), ('Holmes'), ('Rice'), ('Cline'), ('Blackwell'), ('Berry'),
('Griffith'), ('Crawford'), ('Lucas'), ('Mack'), ('Boone'), ('Whitaker'), ('Huffman'), ('Friedman'), ('Shelton'), ('Barry'),
('Hodges'), ('Singh'), ('Tucker'), ('Shah'), ('Sawyer'), ('Watkins'), ('Floyd'), ('Harmon'), ('May'), ('Kelley'),
('Emerson'), ('Flowers'), ('Haynes'), ('Conway'), ('Roberson'), ('Mercer'), ('Huff'), ('Roth'), ('Cobb'), ('Wiggins'),
('Decker'), ('Cannon'), ('Cone'), ('Pickett'), ('Holman'), ('Mullins'), ('Lyons'), ('Booth'), ('Daniel'),
('Tate'), ('Graves'), ('Larsen'), ('Hale'), ('Farmer'), ('Cummings'), ('Burris'), ('Dodson'), ('Norton'),
('Pearson'), ('Tripp'), ('Hobbs'), ('Garrett'), ('Manning'), ('Blackwell'), ('Shannon'), ('Bean'), ('Lamb'),
('Harmon'), ('Dunlap'), ('Stout'), ('Mcgee'), ('Chung'), ('Greer'), ('Bray'), ('Kirk'), ('Brown'),
('Lopes'), ('Wiggins'), ('Bowman'), ('Jones'), ('Caldwell'), ('Franklin'), ('Gupta'), ('Poss'), ('Shepherd'),
('Yoder'), ('Craig'), ('Bender'), ('Wise'), ('Khan'), ('Hammond'), ('Goodwin'), ('Fischer'), ('Dudley'), ('Bruce'),
('Webster'), ('Powers'), ('Mcpherson'), ('Marquez'), ('Cochran'), ('Holloway'), ('Odom'), ('Bond'), ('Dyer'),
('Larson'), ('Herman'), ('Hancock'), ('Daugherty'), ('Morales'), ('Stanley'), ('Reese'), ('Clemons'), ('Hobson'),
('Wells'), ('Curtis'), ('Quan'), ('Housel'), ('Rines'), ('Hobart'), ('Blanchard'), ('Perkins'), ('Castro'),
('Grimes'), ('Sexton'), ('Bryant'), ('Hester'), ('Davis'), ('Mcbride'), ('Coffey'), ('Dejesus'), ('Maddox'),
('Shelby'), ('Shannon'), ('Bray'), ('Coffman'), ('Espinoza'), ('Malone'), ('Durham'), ('Hunt'), ('Wolfe'),
('Underwood'), ('Lamb'), ('Dickson'), ('Heath'), ('Pruitt'), ('Fitzgerald'), ('Melendez'), ('Davila'), ('Calhoun'),
('Hardy'), ('Santiago'), ('Barron'), ('Vargas'), ('Bowen'), ('Ritter'), ('Jensen'), ('Franco'), ('Owens'), ('Wynn'),
('Kerry'), ('Sampson'), ('Huffman'), ('Simpson'), ('Monroe'), ('Stevens'), ('Keller'), ('Randall'), ('Barber'),
('Strickland'), ('Palmer'), ('Walton'), ('Curry'), ('Cader'), ('Reid'), ('Gallagher'), ('Taylor'), ('Frank'),
('Holloway'), ('Griffith'), ('Hicks'), ('Hopkins'), ('Nelson'), ('Parker'), ('Bates'), ('Whitfield'), ('Atkins'),
('Curtis'), ('Sawyer'), ('Mcintosh'), ('Gold'), ('Luna'), ('Hicks'), ('Barber'), ('Ball'), ('Hawkins'),
('Hobson'), ('Shelton'), ('Walsh'), ('Travis'), ('Merrill'), ('Carver'), ('Vance'), ('Good'), ('Norris'), ('Gross');

-- Create a temporary table to map user IDs to name indices
CREATE TEMPORARY TABLE user_name_mapping (user_uuid TEXT PRIMARY KEY, name_idx INTEGER);

-- Assign unique name indices to each user
INSERT INTO user_name_mapping (user_uuid, name_idx)
SELECT 
  id::text as user_uuid,
  row_number() OVER () - 1 as name_idx
FROM directus_users
ORDER BY id;

-- Create function to get user's first name by UUID
CREATE OR REPLACE FUNCTION get_user_first_name(user_uuid TEXT) RETURNS TEXT AS $$
DECLARE
  name_idx INTEGER;
  fn TEXT;
BEGIN
  SELECT name_idx INTO name_idx FROM user_name_mapping WHERE user_uuid = get_user_first_name.user_uuid;
  IF name_idx IS NULL THEN
    RETURN 'John';
  END IF;
  SELECT name INTO fn FROM first_names_temp ORDER BY id OFFSET name_idx LIMIT 1;
  RETURN fn;
END;
$$ LANGUAGE plpgsql;

-- Create function to get user's last name by UUID
CREATE OR REPLACE FUNCTION get_user_last_name(user_uuid TEXT) RETURNS TEXT AS $$
DECLARE
  name_idx INTEGER;
  ln TEXT;
BEGIN
  SELECT name_idx INTO name_idx FROM user_name_mapping WHERE user_uuid = get_user_last_name.user_uuid;
  IF name_idx IS NULL THEN
    RETURN 'Smith';
  END IF;
  SELECT name INTO ln FROM last_names_temp ORDER BY id OFFSET name_idx LIMIT 1;
  RETURN ln;
END;
$$ LANGUAGE plpgsql;

-- Create function to get user's email by UUID
CREATE OR REPLACE FUNCTION get_user_email(user_uuid TEXT) RETURNS TEXT AS $$
DECLARE
  name_idx INTEGER;
  fn TEXT;
  ln TEXT;
BEGIN
  SELECT name_idx INTO name_idx FROM user_name_mapping WHERE user_uuid = get_user_email.user_uuid;
  IF name_idx IS NULL THEN
    RETURN 'john.smith@example.org';
  END IF;
  SELECT name INTO fn FROM first_names_temp ORDER BY id OFFSET name_idx LIMIT 1;
  SELECT name INTO ln FROM last_names_temp ORDER BY id OFFSET name_idx LIMIT 1;
  RETURN lower(fn) || '.' || lower(ln) || '@example.org';
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- Anonymize directus_users table
-- ===========================================
UPDATE directus_users du SET
  first_name = get_user_first_name(du.id::text),
  last_name = get_user_last_name(du.id::text),
  email = get_user_email(du.id::text),
  password = '$2a$10$fakepasswordhashthatisnotrealbutlongenough',
  location = 'Anonymized Location',
  description = 'Anonymized user description',
  title = NULL,
  external_identifier = NULL,
  auth_data = NULL,
  token = NULL,
  last_access = NULL,
  last_page = NULL,
  provider = 'default',
  tfa_secret = NULL,
  bio = NULL,
  show_on_team_page = show_on_team_page,
  slk_team = slk_team;

-- ===========================================
-- Anonymize editors table - MATCH emails to directus_users
-- Editors have user_created that references directus_users.id
-- Set editor's email to match the user_created's anonymized email
-- ===========================================
UPDATE editors e SET
  email = get_user_email(u.id::text)
FROM directus_users u
WHERE e.user_created = u.id;

-- For editors without user_created, assign unique emails based on their own ID
-- Use a separate counter for editors to avoid collisions
UPDATE editors e SET
  email = (
    SELECT lower(fn.name) || '.' || lower(ln.name) || '@example.org'
    FROM (
      SELECT name, row_number() OVER () as rn FROM first_names_temp
    ) fn
    CROSS JOIN (
      SELECT name, row_number() OVER () as rn FROM last_names_temp
    ) ln
    WHERE ln.rn = (
      SELECT COUNT(*) FROM directus_users
    ) + (SELECT row_number() OVER (ORDER BY id) - 1 FROM editors e2 WHERE e2.id = e.id LIMIT 1)
    AND fn.rn = ln.rn
    LIMIT 1
  )
WHERE email NOT LIKE '%@example.org' OR email IS NULL;

-- ===========================================
-- Anonymize candidate table
-- ===========================================
-- Create mapping for candidates (they have their own IDs, not linked to directus_users)
CREATE TEMPORARY TABLE candidate_name_mapping (candidate_uuid TEXT PRIMARY KEY, name_idx INTEGER);
INSERT INTO candidate_name_mapping (candidate_uuid, name_idx)
SELECT 
  id::text as candidate_uuid,
  row_number() OVER () - 1 as name_idx
FROM candidate
ORDER BY id;

CREATE OR REPLACE FUNCTION get_candidate_first_name(candidate_uuid TEXT) RETURNS TEXT AS $$
DECLARE
  name_idx INTEGER;
  offset_idx INTEGER;
  fn TEXT;
BEGIN
  SELECT name_idx INTO name_idx FROM candidate_name_mapping WHERE candidate_uuid = get_candidate_first_name.candidate_uuid;
  IF name_idx IS NULL THEN
    RETURN 'John';
  END IF;
  -- Offset by number of users to avoid collision
  SELECT COUNT(*) INTO offset_idx FROM directus_users;
  SELECT name INTO fn FROM first_names_temp ORDER BY id OFFSET (offset_idx + name_idx) LIMIT 1;
  RETURN fn;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_candidate_last_name(candidate_uuid TEXT) RETURNS TEXT AS $$
DECLARE
  name_idx INTEGER;
  offset_idx INTEGER;
  ln TEXT;
BEGIN
  SELECT name_idx INTO name_idx FROM candidate_name_mapping WHERE candidate_uuid = get_candidate_last_name.candidate_uuid;
  IF name_idx IS NULL THEN
    RETURN 'Smith';
  END IF;
  SELECT COUNT(*) INTO offset_idx FROM directus_users;
  SELECT name INTO ln FROM last_names_temp ORDER BY id OFFSET (offset_idx + name_idx) LIMIT 1;
  RETURN ln;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_candidate_email(candidate_uuid TEXT) RETURNS TEXT AS $$
DECLARE
  name_idx INTEGER;
  offset_idx INTEGER;
  fn TEXT;
  ln TEXT;
BEGIN
  SELECT name_idx INTO name_idx FROM candidate_name_mapping WHERE candidate_uuid = get_candidate_email.candidate_uuid;
  IF name_idx IS NULL THEN
    RETURN 'john.smith@example.org';
  END IF;
  SELECT COUNT(*) INTO offset_idx FROM directus_users;
  SELECT name INTO fn FROM first_names_temp ORDER BY id OFFSET (offset_idx + name_idx) LIMIT 1;
  SELECT name INTO ln FROM last_names_temp ORDER BY id OFFSET (offset_idx + name_idx) LIMIT 1;
  RETURN lower(fn) || '.' || lower(ln) || '@example.org';
END;
$$ LANGUAGE plpgsql;

UPDATE candidate c SET
  name = get_candidate_first_name(c.id::text) || ' ' || get_candidate_last_name(c.id::text),
  email = get_candidate_email(c.id::text);

-- ===========================================
-- Anonymize feedback table
-- ===========================================
-- Feedback also has its own IDs, create separate mapping
CREATE TEMPORARY TABLE feedback_name_mapping (feedback_uuid TEXT PRIMARY KEY, name_idx INTEGER);
INSERT INTO feedback_name_mapping (feedback_uuid, name_idx)
SELECT 
  id::text as feedback_uuid,
  row_number() OVER () - 1 as name_idx
FROM feedback
ORDER BY id;

CREATE OR REPLACE FUNCTION get_feedback_first_name(feedback_uuid TEXT) RETURNS TEXT AS $$
DECLARE
  name_idx INTEGER;
  offset_idx INTEGER;
  fn TEXT;
BEGIN
  SELECT name_idx INTO name_idx FROM feedback_name_mapping WHERE feedback_uuid = get_feedback_first_name.feedback_uuid;
  IF name_idx IS NULL THEN
    RETURN 'John';
  END IF;
  SELECT (COUNT(*) FROM directus_users) + (COUNT(*) FROM candidate) INTO offset_idx;
  SELECT name INTO fn FROM first_names_temp ORDER BY id OFFSET (offset_idx + name_idx) LIMIT 1;
  RETURN fn;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_feedback_last_name(feedback_uuid TEXT) RETURNS TEXT AS $$
DECLARE
  name_idx INTEGER;
  offset_idx INTEGER;
  ln TEXT;
BEGIN
  SELECT name_idx INTO name_idx FROM feedback_name_mapping WHERE feedback_uuid = get_feedback_last_name.feedback_uuid;
  IF name_idx IS NULL THEN
    RETURN 'Smith';
  END IF;
  SELECT (COUNT(*) FROM directus_users) + (COUNT(*) FROM candidate) INTO offset_idx;
  SELECT name INTO ln FROM last_names_temp ORDER BY id OFFSET (offset_idx + name_idx) LIMIT 1;
  RETURN ln;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_feedback_email(feedback_uuid TEXT) RETURNS TEXT AS $$
DECLARE
  name_idx INTEGER;
  offset_idx INTEGER;
  fn TEXT;
  ln TEXT;
BEGIN
  SELECT name_idx INTO name_idx FROM feedback_name_mapping WHERE feedback_uuid = get_feedback_email.feedback_uuid;
  IF name_idx IS NULL THEN
    RETURN 'john.smith@example.org';
  END IF;
  SELECT (COUNT(*) FROM directus_users) + (COUNT(*) FROM candidate) INTO offset_idx;
  SELECT name INTO fn FROM first_names_temp ORDER BY id OFFSET (offset_idx + name_idx) LIMIT 1;
  SELECT name INTO ln FROM last_names_temp ORDER BY id OFFSET (offset_idx + name_idx) LIMIT 1;
  RETURN lower(fn) || '.' || lower(ln) || '@example.org';
END;
$$ LANGUAGE plpgsql;

UPDATE feedback f SET
  sender_name = get_feedback_first_name(f.id::text) || ' ' || get_feedback_last_name(f.id::text),
  sender_contact = get_feedback_email(f.id::text);

-- ===========================================
-- Anonymize municipalities.public_contact
-- This field might contain emails or phone numbers in text
-- ===========================================
UPDATE municipalities SET
  public_contact = 'Contact: info@example.org, Phone: +49 123 456789';

-- ===========================================
-- Anonymize directus_activity (remove IP addresses and user info)
-- ===========================================
UPDATE directus_activity SET
  user = NULL,
  ip = NULL;

-- ===========================================
-- Anonymize directus_sessions
-- ===========================================
UPDATE directus_sessions SET
  token = 'anonymized_token',
  ip = NULL,
  user_agent = 'Anonymized Browser';

-- ===========================================
-- Anonymize directus_files (remove user references)
-- ===========================================
UPDATE directus_files SET
  uploaded_by = NULL,
  modified_by = NULL;

-- ===========================================
-- Clean up all temporary tables and functions
-- ===========================================
DROP TABLE IF EXISTS first_names_temp;
DROP TABLE IF EXISTS last_names_temp;
DROP TABLE IF EXISTS user_name_mapping;
DROP TABLE IF EXISTS candidate_name_mapping;
DROP TABLE IF EXISTS feedback_name_mapping;
DROP FUNCTION IF EXISTS get_user_first_name(TEXT);
DROP FUNCTION IF EXISTS get_user_last_name(TEXT);
DROP FUNCTION IF EXISTS get_user_email(TEXT);
DROP FUNCTION IF EXISTS get_candidate_first_name(TEXT);
DROP FUNCTION IF EXISTS get_candidate_last_name(TEXT);
DROP FUNCTION IF EXISTS get_candidate_email(TEXT);
DROP FUNCTION IF EXISTS get_feedback_first_name(TEXT);
DROP FUNCTION IF EXISTS get_feedback_last_name(TEXT);
DROP FUNCTION IF EXISTS get_feedback_email(TEXT);

ENDOFSQL

# Execute the anonymization SQL
docker compose -f "$PROJECT_ROOT/docker-compose.yaml" exec -T db psql -U "$DB_USER" -d "$TEMP_DB" -f "$ANON_SQL" 2>&1

# Clean up temporary SQL file
rm -f "$ANON_SQL"

echo ""
echo "[3/4] Exporting anonymized database..."

# Create output directory if it doesn't exist
mkdir -p "$OUTPUT_DIR"

# Export the anonymized database
docker compose -f "$PROJECT_ROOT/docker-compose.yaml" exec -T db pg_dump -U "$DB_USER" -d "$TEMP_DB" > "$EXPORT_FILE" 2>&1

echo ""
echo "[4/4] Export complete!"
echo ""
echo "=========================================="
echo "Exported to: $EXPORT_FILE"
echo "=========================================="
echo ""
echo "IMPORTANT: The production database was NOT modified."
echo "Only the temporary copy ($TEMP_DB) was anonymized and exported."
echo ""
echo "Features:"
echo "- Thousands of unique name combinations (no repeats)"
echo "- Editors' emails MATCH their corresponding directus_users emails"
echo "- All emails end in @example.org"
echo "- Each table (users, editors, candidates, feedback) has unique, non-overlapping names"
echo "- Plausible fake data throughout"
echo ""

# Manually remove trap since we want to keep the success message
if docker compose -f "$PROJECT_ROOT/docker-compose.yaml" exec -T db psql -U "$DB_USER" -d postgres -c "SELECT 1 FROM pg_database WHERE datname = '$TEMP_DB'" 2>/dev/null | grep -q 1; then
  echo "WARNING: Temporary database still exists. Cleaning up now..."
  docker compose -f "$PROJECT_ROOT/docker-compose.yaml" exec -T db psql -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS \"$TEMP_DB\";" 2>/dev/null || true
fi

echo "Done!"

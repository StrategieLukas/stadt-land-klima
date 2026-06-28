-- Publish all municipality score rows whose catalog version is rated above 95%.
-- Run after importing the schema that adds municipality_scores.published:
--   bash bin/run_sql.sh < bin/migrations/publish-all-municipality-scores-over-95.sql

UPDATE municipality_scores
SET published = true
WHERE percentage_rated > 95;

UPDATE municipality_scores
SET rank = -1
WHERE published IS DISTINCT FROM true;

WITH ranked AS (
  SELECT
    id,
    RANK() OVER (
      PARTITION BY catalog_version
      ORDER BY score_total DESC
    ) AS next_rank
  FROM municipality_scores
  WHERE published IS true
)
UPDATE municipality_scores scores
SET rank = ranked.next_rank
FROM ranked
WHERE scores.id = ranked.id;
